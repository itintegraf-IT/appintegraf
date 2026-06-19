import nodemailer from "nodemailer";
import { getEmailSettings } from "@/lib/email-settings";
import {
  collectStitkyEmailAddresses,
  type StitkyNotifyChannel,
} from "@/lib/stitky/recipients";

async function sendStitkyMail(params: {
  to: string[];
  subject: string;
  text: string;
}): Promise<void> {
  if (params.to.length === 0) return;

  const settings = await getEmailSettings();
  if (!settings.enabled || !settings.user || !settings.password || !settings.from) {
    return;
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

  await transporter.sendMail({
    from: settings.fromName ? `"${settings.fromName}" <${settings.from}>` : settings.from,
    to: params.to.join(", "),
    subject: params.subject,
    text: params.text,
  });
}

export async function sendStitkySubmitEmail(params: {
  orderNumber: string;
  submittedBy: string;
  channel: StitkyNotifyChannel;
}): Promise<void> {
  const recipients = await collectStitkyEmailAddresses({ channel: params.channel });
  await sendStitkyMail({
    to: recipients,
    subject: `${params.orderNumber} ŠTÍTKY`,
    text: `${params.submittedBy} Vám posílá požadavek na výrobu štítků.`,
  });
}

export async function sendStitkyDoneEmail(params: {
  orderNumber: string;
  processedBy: string;
}): Promise<void> {
  const recipients = await collectStitkyEmailAddresses({ channel: "mailing" });
  await sendStitkyMail({
    to: recipients,
    subject: `${params.orderNumber} ŠTÍTKY - HOTOVO`,
    text: `${params.processedBy} zpracoval štítky.`,
  });
}
