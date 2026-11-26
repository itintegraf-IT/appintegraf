import { prisma } from "@/lib/db";

export type AwaitingFinalCandidate = {
  id: number;
  created_by: number;
  final_approver_user_id: number | null;
  body: string;
  job_number: string | null;
  order_number: string | null;
  /** Čas posledního client_approved (nebo softproof used_at). */
  client_approved_at: Date;
  /** Čas poslední připomínky final_approval_reminder_sent, pokud existuje. */
  last_reminder_at: Date | null;
};

/**
 * Maketa čeká na finální schválení, pokud:
 * - work_type = grafika, status = sent_for_approval
 * - existuje client_approved (file event) po posledním softproof_sent
 * - od té doby není v status_log přechod na approved
 */
export function isAwaitingFinalApproval(params: {
  workType: string | null | undefined;
  status: string;
  latestClientApprovedAt: Date | null;
  latestSoftproofSentAt: Date | null;
  hasApprovedAfterClient: boolean;
}): boolean {
  if (params.workType !== "grafika") return false;
  if (params.status !== "sent_for_approval") return false;
  if (!params.latestClientApprovedAt) return false;
  if (
    params.latestSoftproofSentAt &&
    params.latestClientApprovedAt.getTime() < params.latestSoftproofSentAt.getTime()
  ) {
    return false;
  }
  if (params.hasApprovedAfterClient) return false;
  return true;
}

/**
 * Pro daná ID ze seznamu vrátí mapu awaiting_final_approval.
 */
export async function loadAwaitingFinalApprovalMap(
  rows: Array<{ id: number; status: string; work_type?: string | null }>
): Promise<Map<number, boolean>> {
  const result = new Map<number, boolean>();
  if (rows.length === 0) return result;

  const candidates = rows.filter(
    (r) =>
      (r.work_type === "grafika" || r.work_type == null) &&
      r.status === "sent_for_approval"
  );
  for (const r of rows) {
    result.set(r.id, false);
  }
  if (candidates.length === 0) return result;

  const ids = candidates.map((r) => r.id);

  const [events, approvedLogs, workTypes] = await Promise.all([
    prisma.makety_file_events.findMany({
      where: {
        maketa_id: { in: ids },
        event_type: {
          in: ["client_approved", "softproof_sent", "final_approval_reminder_sent"],
        },
      },
      orderBy: { created_at: "desc" },
      select: { maketa_id: true, event_type: true, created_at: true },
    }),
    prisma.makety_status_log.findMany({
      where: {
        maketa_id: { in: ids },
        to_status: "approved",
      },
      orderBy: { created_at: "desc" },
      select: { maketa_id: true, created_at: true },
    }),
    prisma.makety.findMany({
      where: { id: { in: ids } },
      select: { id: true, work_type: true },
    }),
  ]);

  const workTypeById = new Map(workTypes.map((r) => [r.id, r.work_type]));
  const latestClientApproved = new Map<number, Date>();
  const latestSoftproofSent = new Map<number, Date>();
  for (const ev of events) {
    if (ev.event_type === "client_approved" && !latestClientApproved.has(ev.maketa_id)) {
      latestClientApproved.set(ev.maketa_id, ev.created_at);
    }
    if (ev.event_type === "softproof_sent" && !latestSoftproofSent.has(ev.maketa_id)) {
      latestSoftproofSent.set(ev.maketa_id, ev.created_at);
    }
  }

  const approvedAfter = new Map<number, Date>();
  for (const log of approvedLogs) {
    if (!approvedAfter.has(log.maketa_id)) {
      approvedAfter.set(log.maketa_id, log.created_at);
    }
  }

  for (const row of candidates) {
    const clientAt = latestClientApproved.get(row.id) ?? null;
    const softAt = latestSoftproofSent.get(row.id) ?? null;
    const approvedAt = approvedAfter.get(row.id) ?? null;
    const hasApprovedAfterClient =
      clientAt != null && approvedAt != null && approvedAt.getTime() >= clientAt.getTime();
    result.set(
      row.id,
      isAwaitingFinalApproval({
        workType: workTypeById.get(row.id) ?? row.work_type,
        status: row.status,
        latestClientApprovedAt: clientAt,
        latestSoftproofSentAt: softAt,
        hasApprovedAfterClient,
      })
    );
  }

  return result;
}

/**
 * Jedna maketa — pro detail stránku.
 */
export async function isMaketaAwaitingFinalApproval(maketaId: number): Promise<boolean> {
  const map = await loadAwaitingFinalApprovalMap(
    await prisma.makety
      .findMany({
        where: { id: maketaId },
        select: { id: true, status: true, work_type: true },
      })
  );
  return map.get(maketaId) === true;
}

/**
 * Kandidáti pro cron připomínek (včetně časů pro interval).
 */
export async function findAwaitingFinalApprovalCandidates(
  limit = 100
): Promise<AwaitingFinalCandidate[]> {
  const rows = await prisma.makety.findMany({
    where: {
      work_type: "grafika",
      status: "sent_for_approval",
    },
    take: limit,
    orderBy: { id: "asc" },
    select: {
      id: true,
      created_by: true,
      final_approver_user_id: true,
      body: true,
      job_number: true,
      order_number: true,
      work_type: true,
      status: true,
    },
  });
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [events, approvedLogs] = await Promise.all([
    prisma.makety_file_events.findMany({
      where: {
        maketa_id: { in: ids },
        event_type: {
          in: ["client_approved", "softproof_sent", "final_approval_reminder_sent"],
        },
      },
      orderBy: { created_at: "desc" },
      select: { maketa_id: true, event_type: true, created_at: true },
    }),
    prisma.makety_status_log.findMany({
      where: { maketa_id: { in: ids }, to_status: "approved" },
      orderBy: { created_at: "desc" },
      select: { maketa_id: true, created_at: true },
    }),
  ]);

  const latestClientApproved = new Map<number, Date>();
  const latestSoftproofSent = new Map<number, Date>();
  const latestReminder = new Map<number, Date>();
  for (const ev of events) {
    if (ev.event_type === "client_approved" && !latestClientApproved.has(ev.maketa_id)) {
      latestClientApproved.set(ev.maketa_id, ev.created_at);
    }
    if (ev.event_type === "softproof_sent" && !latestSoftproofSent.has(ev.maketa_id)) {
      latestSoftproofSent.set(ev.maketa_id, ev.created_at);
    }
    if (
      ev.event_type === "final_approval_reminder_sent" &&
      !latestReminder.has(ev.maketa_id)
    ) {
      latestReminder.set(ev.maketa_id, ev.created_at);
    }
  }

  const approvedAfter = new Map<number, Date>();
  for (const log of approvedLogs) {
    if (!approvedAfter.has(log.maketa_id)) {
      approvedAfter.set(log.maketa_id, log.created_at);
    }
  }

  const out: AwaitingFinalCandidate[] = [];
  for (const row of rows) {
    const clientAt = latestClientApproved.get(row.id) ?? null;
    const softAt = latestSoftproofSent.get(row.id) ?? null;
    const approvedAt = approvedAfter.get(row.id) ?? null;
    const hasApprovedAfterClient =
      clientAt != null && approvedAt != null && approvedAt.getTime() >= clientAt.getTime();
    if (
      !isAwaitingFinalApproval({
        workType: row.work_type,
        status: row.status,
        latestClientApprovedAt: clientAt,
        latestSoftproofSentAt: softAt,
        hasApprovedAfterClient,
      }) ||
      !clientAt
    ) {
      continue;
    }
    out.push({
      id: row.id,
      created_by: row.created_by,
      final_approver_user_id: row.final_approver_user_id,
      body: row.body,
      job_number: row.job_number,
      order_number: row.order_number,
      client_approved_at: clientAt,
      last_reminder_at: latestReminder.get(row.id) ?? null,
    });
  }
  return out;
}
