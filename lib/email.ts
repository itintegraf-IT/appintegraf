import nodemailer from "nodemailer";
import { getEmailSettings } from "./email-settings";

/**
 * Kanonická URL aplikace pro absolutní odkazy v e-mailech.
 * Priorita: AUTH_URL → NEXTAUTH_URL → APP_URL → VERCEL_URL (nasazení na Vercel) → localhost.
 * Pozor: dříve se kvůli vazbě ?? a ?: při nastaveném AUTH_URL používal špatně jen VERCEL_URL → https://undefined.
 */
function getBaseUrl(): string {
  const explicit =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.APP_URL?.trim();

  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const withProto =
      vercel.startsWith("http://") || vercel.startsWith("https://")
        ? vercel
        : `https://${vercel}`;
    return withProto.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

export type SendCalendarApprovalEmailParams = {
  toEmail: string;
  toName: string;
  subject: string;
  message: string;
  eventTitle: string;
  eventId: number;
};

/**
 * Odešle e-mail schvalovateli události kalendáře.
 * Používá nastavení z system_settings (admin).
 */
export async function sendCalendarApprovalEmail(
  params: SendCalendarApprovalEmailParams
): Promise<{ success: boolean; error?: string }> {
  const settings = await getEmailSettings();
  if (!settings.enabled) {
    return { success: true }; // E-mail vypnutý – nepovažujeme za chybu
  }

  if (!settings.user || !settings.password || !settings.from) {
    return {
      success: false,
      error: "E-mail není nakonfigurován (chybí SMTP údaje nebo odesílatel)",
    };
  }

  const link = `${getBaseUrl()}/calendar/${params.eventId}`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
  <p>Dobrý den, ${params.toName},</p>
  <p>${params.message}</p>
  <p><strong>Událost:</strong> ${params.eventTitle}</p>
  <p><a href="${link}" style="display: inline-block; padding: 10px 20px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px;">Otevřít událost ke schválení</a></p>
  <p style="color: #666; font-size: 12px;">Pokud tlačítko nefunguje, zkopírujte odkaz: ${link}</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 11px;">Tento e-mail byl odeslán automaticky z aplikace INTEGRAF.</p>
</body>
</html>
  `.trim();

  try {
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: {
        user: settings.user,
        pass: settings.password,
      },
      tls:
        settings.host.includes("office365") || settings.host.includes("outlook")
          ? { ciphers: "SSLv3", rejectUnauthorized: false }
          : undefined,
    });

    await transporter.sendMail({
      from: settings.fromName
        ? `"${settings.fromName}" <${settings.from}>`
        : settings.from,
      to: params.toEmail,
      subject: params.subject,
      text: `${params.message}\n\nUdálost: ${params.eventTitle}\nOdkaz: ${link}`,
      html,
    });

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sendCalendarApprovalEmail error:", msg);
    return { success: false, error: msg };
  }
}

export type SendUkolEmailParams = {
  toEmail: string;
  toName: string;
  subject: string;
  intro: string;
  bodyPreview: string;
  orderNumber: string | null;
  ukolId: number;
};

/**
 * E-mail o zadání / změně termínu úkolu (modul Úkoly).
 */
export async function sendUkolEmail(
  params: SendUkolEmailParams
): Promise<{ success: boolean; error?: string }> {
  const settings = await getEmailSettings();
  if (!settings.enabled) {
    return { success: true };
  }

  if (!settings.user || !settings.password || !settings.from) {
    return {
      success: false,
      error: "E-mail není nakonfigurován (chybí SMTP údaje nebo odesílatel)",
    };
  }

  const link = `${getBaseUrl()}/ukoly/${params.ukolId}`;
  const zak = params.orderNumber
    ? `<p><strong>Zakázka:</strong> ${params.orderNumber}</p>`
    : "";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
  <p>Dobrý den, ${params.toName},</p>
  <p>${params.intro}</p>
  ${zak}
  <p><strong>Úkol:</strong> ${params.bodyPreview.slice(0, 500)}</p>
  <p><a href="${link}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Otevřít úkol</a></p>
  <p style="color: #666; font-size: 12px;">Pokud tlačítko nefunguje, zkopírujte odkaz: ${link}</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 11px;">Tento e-mail byl odeslán automaticky z aplikace INTEGRAF.</p>
</body>
</html>
  `.trim();

  try {
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: {
        user: settings.user,
        pass: settings.password,
      },
      tls:
        settings.host.includes("office365") || settings.host.includes("outlook")
          ? { ciphers: "SSLv3", rejectUnauthorized: false }
          : undefined,
    });

    await transporter.sendMail({
      from: settings.fromName
        ? `"${settings.fromName}" <${settings.from}>`
        : settings.from,
      to: params.toEmail,
      subject: params.subject,
      text: `${params.intro}\n\n${params.bodyPreview.slice(0, 500)}\n\nOdkaz: ${link}`,
      html,
    });

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sendUkolEmail error:", msg);
    return { success: false, error: msg };
  }
}

export type SendTestEmailParams = {
  toEmail: string;
  toName?: string;
  /** Volitelné přepsání nastavení (pro test před uložením) */
  settingsOverride?: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    password?: string;
    from?: string;
    fromName?: string;
  };
};

/**
 * Odešle testovací e-mail. Používá uložená nastavení nebo override z parametrů.
 */
export async function sendTestEmail(
  params: SendTestEmailParams
): Promise<{ success: boolean; error?: string }> {
  const saved = await getEmailSettings();
  const override = params.settingsOverride ?? {};
  const settings = {
    host: override.host ?? saved.host,
    port: override.port ?? saved.port,
    secure: override.secure ?? saved.secure,
    user: override.user ?? saved.user,
    password: override.password ?? saved.password,
    from: override.from ?? saved.from,
    fromName: override.fromName ?? saved.fromName,
  };

  if (!settings.user || !settings.password || !settings.from) {
    return {
      success: false,
      error: "Pro odeslání testu vyplňte SMTP uživatele, heslo a odesílatele.",
    };
  }

  const toName = params.toName ?? "Uživateli";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
  <p>Dobrý den, ${toName},</p>
  <p>Toto je <strong>testovací e-mail</strong> z aplikace INTEGRAF.</p>
  <p>Pokud jste ho obdrželi, konfigurace SMTP funguje správně.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 11px;">Odesláno ${new Date().toLocaleString("cs-CZ")}</p>
</body>
</html>
  `.trim();

  try {
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: {
        user: settings.user,
        pass: settings.password,
      },
      tls:
        settings.host.includes("office365") || settings.host.includes("outlook")
          ? { ciphers: "SSLv3", rejectUnauthorized: false }
          : undefined,
    });

    await transporter.sendMail({
      from: settings.fromName
        ? `"${settings.fromName}" <${settings.from}>`
        : settings.from,
      to: params.toEmail,
      subject: "Testovací e-mail – INTEGRAF",
      text: "Toto je testovací e-mail z aplikace INTEGRAF. Konfigurace SMTP funguje správně.",
      html,
    });

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sendTestEmail error:", msg);
    return { success: false, error: msg };
  }
}
