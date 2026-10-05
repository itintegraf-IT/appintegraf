import { prisma } from "@/lib/db";
import { sendMaketySoftproofEmail } from "@/lib/email";
import { recordMaketyFileEvent } from "@/lib/makety-file-events";
import {
  createSoftproofLink,
  revokeOpenSoftproofLinks,
} from "@/lib/makety-softproof-links";
import { loadSoftproofReminderSettings } from "@/lib/makety-softproof-reminder-settings";
import {
  MAKETY_FILE_MODULE,
  resolveMaketyFileDiskPath,
} from "@/lib/makety-files";

const BATCH_LIMIT = 50;

function appBaseUrl(): string {
  const explicit =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return "http://localhost:3000";
}

export type SoftproofReminderRunResult = {
  scanned: number;
  sent: number;
  skipped: number;
  errors: Array<{ linkId: number; maketaId: number; error: string }>;
};

/**
 * Denní úloha: po vypršení softproof odkazu pošle klientovi nový odkaz (připomínka).
 */
export async function runMaketySoftproofReminders(): Promise<SoftproofReminderRunResult> {
  const settings = await loadSoftproofReminderSettings();
  if (!settings.enabled) {
    return { scanned: 0, sent: 0, skipped: 0, errors: [] };
  }

  const now = new Date();
  const candidates = await prisma.makety_softproof_links.findMany({
    where: {
      reminder_enabled: true,
      reminder_sent_at: null,
      used_at: null,
      expires_at: { lte: now },
      makety: {
        work_type: "grafika",
        status: "sent_for_approval",
      },
    },
    orderBy: { expires_at: "asc" },
    take: BATCH_LIMIT,
    include: {
      makety: {
        select: {
          id: true,
          job_number: true,
          order_number: true,
          label_code: true,
          iml_customers: { select: { name: true } },
        },
      },
    },
  });

  const result: SoftproofReminderRunResult = {
    scanned: candidates.length,
    sent: 0,
    skipped: 0,
    errors: [],
  };

  const baseUrl = appBaseUrl();

  for (const link of candidates) {
    const claimed = await prisma.makety_softproof_links.updateMany({
      where: {
        id: link.id,
        reminder_enabled: true,
        reminder_sent_at: null,
        used_at: null,
      },
      data: { reminder_sent_at: now },
    });
    if (claimed.count !== 1) {
      result.skipped += 1;
      continue;
    }

    const fileRow = await prisma.file_uploads.findFirst({
      where: {
        id: link.file_id,
        module: MAKETY_FILE_MODULE,
        record_id: link.maketa_id,
      },
    });
    if (!fileRow) {
      result.errors.push({
        linkId: link.id,
        maketaId: link.maketa_id,
        error: "Soubor softproofu nenalezen",
      });
      continue;
    }

    const diskPath = resolveMaketyFileDiskPath(fileRow.file_path);
    if (diskPath) {
      // existence souboru není blokující – e-mail jde s odkazem
    }

    try {
      const { rawToken } = await createSoftproofLink({
        maketaId: link.maketa_id,
        fileId: link.file_id,
        locale: link.locale,
        sentToEmail: link.sent_to_email,
        createdBy: link.created_by,
        reminderEnabled: settings.default_on_send,
      });
      const pageUrl = `${baseUrl}/public/softproof/${encodeURIComponent(rawToken)}`;

      const sent = await sendMaketySoftproofEmail({
        toEmail: link.sent_to_email,
        toName: link.makety.iml_customers?.name?.trim() || "kliente",
        maketaId: link.maketa_id,
        orderNumber: link.makety.job_number || link.makety.order_number,
        labelCode: link.makety.label_code,
        pageUrl,
        fileName: fileRow.original_filename,
        locale: link.locale,
        subjectPrefix: "Připomínka: ",
        message:
          "Připomínáme schválení softproofu. Předchozí odkaz vypršel — použijte prosím nový odkaz v tomto e-mailu.",
      });

      if (!sent.success) {
        await revokeOpenSoftproofLinks(link.maketa_id);
        result.errors.push({
          linkId: link.id,
          maketaId: link.maketa_id,
          error: sent.error ?? "Odeslání e-mailu selhalo",
        });
        continue;
      }

      await prisma.makety_comments.create({
        data: {
          maketa_id: link.maketa_id,
          user_id: link.created_by,
          body: `Automatická připomínka softproofu (${fileRow.original_filename}) odeslána na ${link.sent_to_email}`,
        },
      });
      await recordMaketyFileEvent({
        maketaId: link.maketa_id,
        fileId: link.file_id,
        eventType: "softproof_reminder_sent",
        userId: link.created_by,
        meta: {
          filename: fileRow.original_filename,
          to_email: link.sent_to_email,
          locale: link.locale,
          previous_link_id: link.id,
          reminder: true,
        },
      });
      result.sent += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("runMaketySoftproofReminders", link.id, msg);
      try {
        await revokeOpenSoftproofLinks(link.maketa_id);
      } catch {
        // ignore
      }
      result.errors.push({
        linkId: link.id,
        maketaId: link.maketa_id,
        error: msg,
      });
    }
  }

  return result;
}
