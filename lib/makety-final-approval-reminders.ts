import { findAwaitingFinalApprovalCandidates } from "@/lib/makety/awaiting-final-approval";
import { recordMaketyFileEvent } from "@/lib/makety-file-events";
import { loadFinalApprovalReminderSettings } from "@/lib/makety-final-approval-reminder-settings";
import { notifyMaketaUsers } from "@/lib/makety-notify";

const BATCH_LIMIT = 80;

export type FinalApprovalReminderRunResult = {
  scanned: number;
  sent: number;
  skipped: number;
  errors: Array<{ maketaId: number; error: string }>;
};

/**
 * Cron: in-app (+ e-mail dle matice) připomínka zadavateli a finálnímu schvalovateli,
 * dokud chybí finální schválení po client_approved.
 */
export async function runMaketyFinalApprovalReminders(): Promise<FinalApprovalReminderRunResult> {
  const settings = await loadFinalApprovalReminderSettings();
  if (!settings.enabled) {
    return { scanned: 0, sent: 0, skipped: 0, errors: [] };
  }

  const intervalMs = settings.interval_hours * 60 * 60 * 1000;
  const now = Date.now();
  const candidates = await findAwaitingFinalApprovalCandidates(BATCH_LIMIT);

  const result: FinalApprovalReminderRunResult = {
    scanned: candidates.length,
    sent: 0,
    skipped: 0,
    errors: [],
  };

  for (const row of candidates) {
    const anchor = row.last_reminder_at ?? row.client_approved_at;
    if (now - anchor.getTime() < intervalMs) {
      result.skipped += 1;
      continue;
    }

    try {
      const orderNumber = row.job_number || row.order_number;
      await notifyMaketaUsers({
        maketaId: row.id,
        userIds: [row.created_by, row.final_approver_user_id],
        bodyPreview: row.body.slice(0, 200),
        orderNumber,
        kind: "final_approval_reminder",
        workType: "grafika",
      });
      await recordMaketyFileEvent({
        maketaId: row.id,
        eventType: "final_approval_reminder_sent",
        meta: {
          interval_hours: settings.interval_hours,
          client_approved_at: row.client_approved_at.toISOString(),
        },
      });
      result.sent += 1;
    } catch (e) {
      result.errors.push({
        maketaId: row.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}
