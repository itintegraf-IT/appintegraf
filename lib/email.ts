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

export type SendCalendarReminderEmailParams = {
  toEmail: string;
  toName: string;
  eventTitle: string;
  eventId: number;
  startsAt: Date;
};

/**
 * Připomínka blížící se události (kalendář).
 */
export async function sendCalendarReminderEmail(
  params: SendCalendarReminderEmailParams
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

  const link = `${getBaseUrl()}/calendar/${params.eventId}`;
  const when = params.startsAt.toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
  <p>Dobrý den, ${params.toName},</p>
  <p>Připomínáme blížící se událost v kalendáři: <strong>${params.eventTitle}</strong></p>
  <p><strong>Začátek:</strong> ${when}</p>
  <p><a href="${link}" style="display: inline-block; padding: 10px 20px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px;">Otevřít událost</a></p>
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
      auth: { user: settings.user, pass: settings.password },
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
      subject: `Připomínka: ${params.eventTitle} – INTEGRAF`,
      text: `Blížící se událost: ${params.eventTitle} (${when})\n${link}`,
      html,
    });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sendCalendarReminderEmail error:", msg);
    return { success: false, error: msg };
  }
}

export type SendCalendarInviteEmailParams = {
  toEmail: string;
  toName: string;
  /** Kdo zve (tvůrce) */
  creatorName: string;
  eventTitle: string;
  eventId: number;
  /** Např. text o opakující se události */
  extraHint?: string;
};

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * E-mail s pozvánkou k události (účastník kalendáře).
 * Používá stejné SMTP nastavení jako ostatní transakční maily.
 */
export async function sendCalendarInviteEmail(
  params: SendCalendarInviteEmailParams
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

  const link = `${getBaseUrl()}/calendar/${params.eventId}`;
  const hintBlock = params.extraHint
    ? `<p style="color: #4b5563; font-size: 14px;">${escHtml(String(params.extraHint))}</p>`
    : "";
  const toNameH = escHtml(params.toName);
  const creatorH = escHtml(params.creatorName);
  const titleH = escHtml(params.eventTitle);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
  <p>Dobrý den, ${toNameH},</p>
  <p><strong>${creatorH}</strong> vás pozval/a k účasti na události v kalendáři.</p>
  <p><strong>Událost:</strong> ${titleH}</p>
  ${hintBlock}
  <p><a href="${link}" style="display: inline-block; padding: 10px 20px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px;">Otevřít událost</a></p>
  <p style="color: #666; font-size: 12px;">Pokud tlačítko nefunguje, zkopírujte odkaz: ${link}</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 11px;">Tento e-mail byl odeslán automaticky z aplikace INTEGRAF.</p>
</body>
</html>
  `.trim();

  const textHint = params.extraHint ? `\n\n${params.extraHint}` : "";

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
      subject: `Pozvánka: ${params.eventTitle} – INTEGRAF`,
      text: `Dobrý den, ${params.toName},\n\n${params.creatorName} vás pozval/a k účasti na události: ${params.eventTitle}.${textHint}\n\nOdkaz: ${link}`,
      html,
    });

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sendCalendarInviteEmail error:", msg);
    return { success: false, error: msg };
  }
}

export type SendEquipmentRequestResultEmailParams = {
  toEmail: string;
  toName: string;
  requestId: number;
  equipmentType: string;
  /** "approved" | "rejected" | "resolved" */
  result: "approved" | "rejected" | "resolved";
  adminResponse?: string | null;
  itResponse?: string | null;
};

/**
 * Odešle e-mail žadateli o výsledku schvalování požadavku na techniku.
 * Žadatel nemusí mít účet – tato cesta je jediná, jak se o výsledku dozví.
 */
export async function sendEquipmentRequestResultEmail(
  params: SendEquipmentRequestResultEmailParams
): Promise<{ success: boolean; error?: string }> {
  const settings = await getEmailSettings();
  if (!settings.enabled) return { success: true };

  if (!settings.user || !settings.password || !settings.from) {
    return {
      success: false,
      error: "E-mail není nakonfigurován (chybí SMTP údaje nebo odesílatel)",
    };
  }

  const resultText =
    params.result === "approved"
      ? "schválen"
      : params.result === "rejected"
      ? "zamítnut"
      : "vyřízen";
  const color =
    params.result === "rejected"
      ? "#dc2626"
      : params.result === "resolved"
      ? "#2563eb"
      : "#16a34a";

  const itBlock = params.itResponse
    ? `<p><strong>Stanovisko IT:</strong><br>${String(params.itResponse).replace(/\n/g, "<br>")}</p>`
    : "";
  const adminBlock = params.adminResponse
    ? `<p><strong>Stanovisko vedení:</strong><br>${String(params.adminResponse).replace(/\n/g, "<br>")}</p>`
    : "";

  const subject = `Požadavek na techniku #${params.requestId} – ${resultText}`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
  <p>Dobrý den, ${params.toName},</p>
  <p>Váš požadavek <strong>#${params.requestId}</strong> na <strong>${params.equipmentType}</strong> byl
    <strong style="color: ${color};">${resultText}</strong>.</p>
  ${itBlock}
  ${adminBlock}
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 11px;">Tento e-mail byl odeslán automaticky z aplikace INTEGRAF.</p>
</body>
</html>
  `.trim();

  const textLines: string[] = [
    `Dobrý den, ${params.toName},`,
    `Váš požadavek #${params.requestId} na ${params.equipmentType} byl ${resultText}.`,
  ];
  if (params.itResponse) textLines.push(`Stanovisko IT: ${params.itResponse}`);
  if (params.adminResponse) textLines.push(`Stanovisko vedení: ${params.adminResponse}`);

  try {
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: { user: settings.user, pass: settings.password },
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
      subject,
      text: textLines.join("\n\n"),
      html,
    });

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sendEquipmentRequestResultEmail error:", msg);
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

/** Zformátuje platnost tokenu pro e-mail. */
function formatExpiry(d: Date): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

/** Obálka + základ HTML pro transakční e-maily. */
function wrapHtml(bodyInner: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
${bodyInner}
<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
<p style="color: #999; font-size: 11px;">Tento e-mail byl odeslán automaticky z aplikace INTEGRAF.</p>
</body></html>`;
}

async function configuredTransporter() {
  const settings = await getEmailSettings();
  if (!settings.enabled) return { settings, transporter: null as null | ReturnType<typeof nodemailer.createTransport> };
  if (!settings.user || !settings.password || !settings.from) {
    return { settings, transporter: null };
  }
  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: { user: settings.user, pass: settings.password },
    tls:
      settings.host.includes("office365") || settings.host.includes("outlook")
        ? { ciphers: "SSLv3", rejectUnauthorized: false }
        : undefined,
  });
  return { settings, transporter };
}

export type SendPasswordResetEmailParams = {
  toEmail: string;
  toName: string;
  token: string;
  expiresAt: Date;
};

/** E-mail s odkazem pro obnovu hesla (self-service i admin-send). */
export async function sendPasswordResetEmail(
  params: SendPasswordResetEmailParams
): Promise<{ success: boolean; error?: string }> {
  const { settings, transporter } = await configuredTransporter();
  if (!settings.enabled) return { success: true };
  if (!transporter) {
    return { success: false, error: "E-mail není nakonfigurován (chybí SMTP údaje nebo odesílatel)" };
  }

  const link = `${getBaseUrl()}/reset-password?token=${encodeURIComponent(params.token)}`;
  const html = wrapHtml(`
<p>Dobrý den, ${params.toName},</p>
<p>obdrželi jsme žádost o obnovu hesla k Vašemu účtu v aplikaci <strong>INTEGRAF</strong>.</p>
<p><a href="${link}" style="display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Nastavit nové heslo</a></p>
<p style="color: #666; font-size: 12px;">Pokud tlačítko nefunguje, zkopírujte do prohlížeče: ${link}</p>
<p><strong>Odkaz je platný do ${formatExpiry(params.expiresAt)}.</strong> Po použití ho již nelze otevřít podruhé.</p>
<p style="color: #666;">Pokud jste o obnovu nepožádali, tento e-mail ignorujte. Vaše stávající heslo zůstává v platnosti.</p>`);

  try {
    await transporter.sendMail({
      from: settings.fromName ? `"${settings.fromName}" <${settings.from}>` : settings.from,
      to: params.toEmail,
      subject: "Obnova hesla – INTEGRAF",
      text: `Dobrý den, ${params.toName},\n\nPro obnovu hesla klikněte na odkaz:\n${link}\n\nOdkaz je platný do ${formatExpiry(params.expiresAt)}.`,
      html,
    });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sendPasswordResetEmail error:", msg);
    return { success: false, error: msg };
  }
}

export type SendAccountActivationEmailParams = {
  toEmail: string;
  toName: string;
  username: string;
  token: string;
  expiresAt: Date;
  invitedBy?: string | null;
};

/** E-mail s odkazem k prvnímu nastavení hesla (nový účet). */
export async function sendAccountActivationEmail(
  params: SendAccountActivationEmailParams
): Promise<{ success: boolean; error?: string }> {
  const { settings, transporter } = await configuredTransporter();
  if (!settings.enabled) return { success: true };
  if (!transporter) {
    return { success: false, error: "E-mail není nakonfigurován (chybí SMTP údaje nebo odesílatel)" };
  }

  const link = `${getBaseUrl()}/activate?token=${encodeURIComponent(params.token)}`;
  const invitedLine = params.invitedBy
    ? `<p>Účet pro Vás vytvořil: <strong>${params.invitedBy}</strong>.</p>`
    : "";

  const html = wrapHtml(`
<p>Dobrý den, ${params.toName},</p>
<p>v aplikaci <strong>INTEGRAF</strong> byl pro Vás vytvořen účet.</p>
${invitedLine}
<p><strong>Uživatelské jméno:</strong> ${params.username}</p>
<p>Pro aktivaci a nastavení vlastního hesla klikněte na tlačítko:</p>
<p><a href="${link}" style="display: inline-block; padding: 12px 24px; background: #16a34a; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Aktivovat účet</a></p>
<p style="color: #666; font-size: 12px;">Pokud tlačítko nefunguje, zkopírujte do prohlížeče: ${link}</p>
<p><strong>Aktivační odkaz je platný do ${formatExpiry(params.expiresAt)}.</strong></p>`);

  try {
    await transporter.sendMail({
      from: settings.fromName ? `"${settings.fromName}" <${settings.from}>` : settings.from,
      to: params.toEmail,
      subject: "Aktivace účtu – INTEGRAF",
      text: `Dobrý den, ${params.toName},\n\nPro aktivaci účtu (username: ${params.username}) a nastavení hesla klikněte na odkaz:\n${link}\n\nOdkaz je platný do ${formatExpiry(params.expiresAt)}.`,
      html,
    });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sendAccountActivationEmail error:", msg);
    return { success: false, error: msg };
  }
}

export type SendPasswordChangedEmailParams = {
  toEmail: string;
  toName: string;
  when: Date;
  ip?: string | null;
};

/** Bezpečnostní e-mail po úspěšné změně hesla (info pro majitele účtu). */
export async function sendPasswordChangedEmail(
  params: SendPasswordChangedEmailParams
): Promise<{ success: boolean; error?: string }> {
  const { settings, transporter } = await configuredTransporter();
  if (!settings.enabled) return { success: true };
  if (!transporter) return { success: false, error: "E-mail není nakonfigurován" };

  const ipLine = params.ip ? `<p><strong>IP adresa:</strong> ${params.ip}</p>` : "";
  const html = wrapHtml(`
<p>Dobrý den, ${params.toName},</p>
<p>heslo k Vašemu účtu v aplikaci <strong>INTEGRAF</strong> bylo právě změněno.</p>
<p><strong>Čas změny:</strong> ${formatExpiry(params.when)}</p>
${ipLine}
<p style="color: #b91c1c;">Pokud jste heslo neměnili Vy, <strong>okamžitě kontaktujte správce aplikace</strong> – Váš účet mohl být kompromitován.</p>`);

  try {
    await transporter.sendMail({
      from: settings.fromName ? `"${settings.fromName}" <${settings.from}>` : settings.from,
      to: params.toEmail,
      subject: "Heslo bylo změněno – INTEGRAF",
      text: `Heslo k Vašemu účtu INTEGRAF bylo změněno dne ${formatExpiry(params.when)}.${params.ip ? ` IP: ${params.ip}.` : ""}\nPokud jste heslo neměnili, kontaktujte správce aplikace.`,
      html,
    });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sendPasswordChangedEmail error:", msg);
    return { success: false, error: msg };
  }
}
