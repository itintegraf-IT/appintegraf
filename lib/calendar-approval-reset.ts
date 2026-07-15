import type { Prisma } from "@prisma/client";
import { requiresDeputy } from "@/app/(dashboard)/calendar/lib/event-types";

/** Řádky v popisu přidávané workflow schvalování – při resetu se odstraní. */
export const CALENDAR_APPROVAL_NOTE_LINE_PATTERNS = [
  /^Schváleno zástupem dne .+$/m,
  /^Schváleno zástupem a schvalovatelem dne .+$/m,
  /^Schváleno schvalovatelem dne .+$/m,
  /^Předáno ke schválení: .+$/m,
] as const;

export type CalendarApprovalRow = {
  approval_type: string;
  status: string;
};

export type CalendarEventApprovalFields = {
  start_date: Date;
  end_date: Date;
  event_type: string | null;
  deputy_id: number | null;
  approval_status: string | null;
  requires_approval?: boolean | null;
};

const APPROVAL_RANK: Record<string, number> = {
  rejected: -1,
  pending: 0,
  deputy_approved: 1,
  approved: 2,
};

/** Odstraní automatické poznámky ze schvalovacího workflow z popisu události. */
export function stripCalendarApprovalNotes(
  description: string | null | undefined
): string | null {
  if (!description?.trim()) return null;
  let result = description;
  for (const pattern of CALENDAR_APPROVAL_NOTE_LINE_PATTERNS) {
    result = result.replace(pattern, "");
  }
  result = result.replace(/\n{3,}/g, "\n\n").trim();
  return result || null;
}

/** Zda úprava vyžaduje nové schválení (změna termínu, typu nebo zástupu). */
export function calendarEditRequiresApprovalReset(
  existing: CalendarEventApprovalFields,
  updated: {
    start: Date;
    end: Date;
    eventType: string;
    deputyIdNum: number | null;
  }
): boolean {
  if (!requiresDeputy(updated.eventType) || updated.deputyIdNum === null) {
    return false;
  }

  const hadApprovalWorkflow =
    existing.deputy_id != null && requiresDeputy(existing.event_type);

  if (!hadApprovalWorkflow) {
    return false;
  }

  const materialChanged =
    existing.start_date.getTime() !== updated.start.getTime() ||
    existing.end_date.getTime() !== updated.end.getTime() ||
    existing.deputy_id !== updated.deputyIdNum ||
    (existing.event_type ?? "") !== updated.eventType;

  if (!materialChanged) {
    return false;
  }

  return (
    existing.approval_status === "approved" ||
    existing.approval_status === "deputy_approved" ||
    existing.approval_status === "pending"
  );
}

/** Odvodí stav schválení z řádků calendar_approvals (oprava nekonzistentních záznamů). */
export function deriveApprovalStatusFromApprovals(
  deputyId: number | null,
  requiresApproval: boolean | null | undefined,
  approvals: CalendarApprovalRow[]
): string | null {
  if (!deputyId && !requiresApproval) {
    return null;
  }

  const deputy = approvals.find((a) => a.approval_type === "deputy");
  if (!deputy) {
    return deputyId ? "pending" : null;
  }

  if (deputy.status === "rejected") return "rejected";
  if (deputy.status === "pending") return "pending";

  const finals = approvals.filter((a) => a.approval_type !== "deputy");
  if (finals.length === 0) return "approved";

  if (finals.some((a) => a.status === "rejected")) return "rejected";
  if (finals.some((a) => a.status === "pending")) return "deputy_approved";

  return "approved";
}

/** Uložený stav je pozadu za schváleními v calendar_approvals (typicky po PUT bez resetu záznamů). */
export function isStaleApprovalStatusMismatch(
  stored: string | null,
  derived: string | null
): boolean {
  if (!stored || !derived || stored === derived) return false;
  if (stored === "rejected" || derived === "rejected") return false;
  const storedRank = APPROVAL_RANK[stored] ?? 0;
  const derivedRank = APPROVAL_RANK[derived] ?? 0;
  return derivedRank > storedRank;
}

export function getEffectiveCalendarApprovalStatus(
  event: CalendarEventApprovalFields & { requires_approval?: boolean | null },
  approvals: CalendarApprovalRow[]
): string | null {
  if (!event.deputy_id && !event.requires_approval) {
    return event.approval_status;
  }
  const derived = deriveApprovalStatusFromApprovals(
    event.deputy_id,
    event.requires_approval,
    approvals
  );
  if (isStaleApprovalStatusMismatch(event.approval_status, derived)) {
    return derived;
  }
  return event.approval_status;
}

type ResetApprovalTx = Prisma.TransactionClient | Prisma.DefaultPrismaClient;

/** Resetuje záznamy schválení po změně termínu / zástupu / typu. */
export async function resetCalendarApprovalRecords(
  tx: ResetApprovalTx,
  eventId: number,
  deputyId: number
): Promise<void> {
  await tx.calendar_approvals.updateMany({
    where: { event_id: eventId, approval_type: "deputy" },
    data: {
      status: "pending",
      comment: null,
      approved_at: null,
      updated_at: new Date(),
    },
  });

  const deputyApproval = await tx.calendar_approvals.findFirst({
    where: { event_id: eventId, approval_type: "deputy" },
    select: { id: true },
  });

  if (!deputyApproval) {
    await tx.calendar_approvals.create({
      data: {
        event_id: eventId,
        approver_id: deputyId,
        approval_type: "deputy",
        approval_order: 1,
        status: "pending",
      },
    });
  } else {
    await tx.calendar_approvals.updateMany({
      where: { event_id: eventId, approval_type: "deputy" },
      data: { approver_id: deputyId, updated_at: new Date() },
    });
  }

  await tx.calendar_approvals.deleteMany({
    where: { event_id: eventId, approval_type: { not: "deputy" } },
  });
}

/** Smaže všechna schválení události (typ bez zástupu). */
export async function clearCalendarApprovalRecords(
  tx: ResetApprovalTx,
  eventId: number
): Promise<void> {
  await tx.calendar_approvals.deleteMany({ where: { event_id: eventId } });
}

/** Synchronizuje approval_status v DB, pokud je pozadu za calendar_approvals. Vrací aktuální stav. */
export async function syncStaleCalendarApprovalStatus(
  db: ResetApprovalTx,
  eventId: number
): Promise<string | null> {
  const event = await db.calendar_events.findUnique({
    where: { id: eventId },
    select: {
      deputy_id: true,
      requires_approval: true,
      approval_status: true,
      calendar_approvals: { select: { approval_type: true, status: true } },
    },
  });
  if (!event) return null;

  const effective = getEffectiveCalendarApprovalStatus(
    {
      deputy_id: event.deputy_id,
      requires_approval: event.requires_approval,
      approval_status: event.approval_status,
      start_date: new Date(),
      end_date: new Date(),
      event_type: null,
    },
    event.calendar_approvals
  );

  if (effective && isStaleApprovalStatusMismatch(event.approval_status, effective)) {
    await db.calendar_events.update({
      where: { id: eventId },
      data: { approval_status: effective, updated_at: new Date() },
    });
    return effective;
  }

  return event.approval_status;
}
