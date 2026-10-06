import { prisma } from "@/lib/db";

export const MAKETY_SOFTPROOF_REMINDER_KEY = "makety_softproof_reminder";
export const MAKETY_SOFTPROOF_REMINDER_MODULE = "makety";

export type SoftproofReminderSettings = {
  /** Globálně zapnuté automatické připomínky (cron). */
  enabled: boolean;
  /** Výchozí stav checkboxu při odeslání softproofu. */
  default_on_send: boolean;
  /** Notifikovat prohlížeče klienta při odeslání softproofu. */
  notify_prohlizec: boolean;
};

export const DEFAULT_SOFTPROOF_REMINDER_SETTINGS: SoftproofReminderSettings = {
  enabled: false,
  default_on_send: true,
  notify_prohlizec: false,
};

export function parseSoftproofReminderSettings(
  raw: string | null | undefined
): SoftproofReminderSettings {
  if (!raw?.trim()) return { ...DEFAULT_SOFTPROOF_REMINDER_SETTINGS };
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    return {
      enabled: data.enabled === true,
      default_on_send: data.default_on_send !== false,
      notify_prohlizec: data.notify_prohlizec === true,
    };
  } catch {
    return { ...DEFAULT_SOFTPROOF_REMINDER_SETTINGS };
  }
}

export async function loadSoftproofReminderSettings(): Promise<SoftproofReminderSettings> {
  const row = await prisma.system_settings.findUnique({
    where: { setting_key: MAKETY_SOFTPROOF_REMINDER_KEY },
    select: { setting_value: true },
  });
  return parseSoftproofReminderSettings(row?.setting_value);
}

export async function saveSoftproofReminderSettings(
  settings: SoftproofReminderSettings,
  updatedBy?: number
): Promise<SoftproofReminderSettings> {
  const next: SoftproofReminderSettings = {
    enabled: settings.enabled === true,
    default_on_send: settings.default_on_send !== false,
    notify_prohlizec: settings.notify_prohlizec === true,
  };
  await prisma.system_settings.upsert({
    where: { setting_key: MAKETY_SOFTPROOF_REMINDER_KEY },
    create: {
      setting_key: MAKETY_SOFTPROOF_REMINDER_KEY,
      setting_value: JSON.stringify(next),
      module: MAKETY_SOFTPROOF_REMINDER_MODULE,
      description: "Automatické připomínky softproofu a notifikace prohlížečům",
      updated_by: updatedBy ?? null,
    },
    update: {
      setting_value: JSON.stringify(next),
      module: MAKETY_SOFTPROOF_REMINDER_MODULE,
      updated_by: updatedBy ?? null,
      updated_at: new Date(),
    },
  });
  return next;
}
