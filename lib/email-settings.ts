import { prisma } from "@/lib/db";

const EMAIL_MODULE = "email";
const KEYS = {
  enabled: "email_enabled",
  host: "email_smtp_host",
  port: "email_smtp_port",
  secure: "email_smtp_secure",
  user: "email_smtp_user",
  password: "email_smtp_password",
  from: "email_from",
  fromName: "email_from_name",
  fromMakety: "email_from_makety",
  fromNameMakety: "email_from_name_makety",
} as const;

export type EmailSettings = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  fromName: string;
  fromMakety: string;
  fromNameMakety: string;
};

const DEFAULTS: EmailSettings = {
  enabled: false,
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  user: "",
  password: "",
  from: "",
  fromName: "INTEGRAF",
  fromMakety: "",
  fromNameMakety: "",
};

async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.system_settings.findUnique({
    where: { setting_key: key },
    select: { setting_value: true },
  });
  return row?.setting_value ?? null;
}

export async function getEmailSettings(): Promise<EmailSettings> {
  const [enabled, host, port, secure, user, password, from, fromName, fromMakety, fromNameMakety] =
    await Promise.all([
      getSetting(KEYS.enabled),
      getSetting(KEYS.host),
      getSetting(KEYS.port),
      getSetting(KEYS.secure),
      getSetting(KEYS.user),
      getSetting(KEYS.password),
      getSetting(KEYS.from),
      getSetting(KEYS.fromName),
      getSetting(KEYS.fromMakety),
      getSetting(KEYS.fromNameMakety),
    ]);

  return {
    enabled: enabled === "true" || enabled === "1",
    host: host ?? DEFAULTS.host,
    port: port ? parseInt(port, 10) : DEFAULTS.port,
    secure: secure === "true" || secure === "1",
    user: user ?? DEFAULTS.user,
    password: password ?? DEFAULTS.password,
    from: from ?? DEFAULTS.from,
    fromName: fromName ?? DEFAULTS.fromName,
    fromMakety: fromMakety ?? DEFAULTS.fromMakety,
    fromNameMakety: fromNameMakety ?? DEFAULTS.fromNameMakety,
  };
}

/** From pro klientské e-maily maket/grafiky (fallback na globální odesílatele). */
export function formatSmtpFrom(
  settings: EmailSettings,
  kind: "default" | "makety" = "default"
): string {
  const addr =
    kind === "makety" && settings.fromMakety.trim()
      ? settings.fromMakety.trim()
      : settings.from;
  const name =
    kind === "makety" && settings.fromNameMakety.trim()
      ? settings.fromNameMakety.trim()
      : settings.fromName;
  return name ? `"${name}" <${addr}>` : addr;
}

/** Vrátí nastavení bez hesla (pro zobrazení v adminu) */
export async function getEmailSettingsSafe(): Promise<
  Omit<EmailSettings, "password"> & { passwordSet: boolean }
> {
  const settings = await getEmailSettings();
  const { password, ...rest } = settings;
  return {
    ...rest,
    passwordSet: password.length > 0,
  };
}

export async function saveEmailSettings(
  data: Partial<EmailSettings>,
  updatedBy?: number
): Promise<void> {
  const upsert = async (
    key: string,
    value: string | number | boolean | undefined
  ) => {
    if (value === undefined) return;
    const str =
      typeof value === "boolean" ? (value ? "true" : "false") : String(value);
    await prisma.system_settings.upsert({
      where: { setting_key: key },
      create: {
        setting_key: key,
        setting_value: str,
        module: EMAIL_MODULE,
        updated_by: updatedBy ?? null,
      },
      update: {
        setting_value: str,
        module: EMAIL_MODULE,
        updated_by: updatedBy ?? null,
        updated_at: new Date(),
      },
    });
  };

  const tasks: Promise<void>[] = [
    upsert(KEYS.enabled, data.enabled),
    upsert(KEYS.host, data.host),
    upsert(KEYS.port, data.port),
    upsert(KEYS.secure, data.secure),
    upsert(KEYS.from, data.from),
    upsert(KEYS.fromName, data.fromName),
    upsert(KEYS.fromMakety, data.fromMakety),
    upsert(KEYS.fromNameMakety, data.fromNameMakety),
  ];
  if (data.user !== undefined) tasks.push(upsert(KEYS.user, data.user));
  if (data.password !== undefined && data.password !== "")
    tasks.push(upsert(KEYS.password, data.password));
  await Promise.all(tasks);
}
