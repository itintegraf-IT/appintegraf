import type { Prisma } from "@prisma/client";
import { getColorForEventType } from "@/lib/calendar-event-colors";

type CreateUnitArgs = {
  title: string;
  description: string;
  start: Date;
  end: Date;
  eventType: string;
  userId: number;
  resolvedDeptId: number | null;
  deputyIdNum: number | null;
  is_public: boolean;
  location: string;
  remindBefore: number | null;
  remindInApp: boolean;
  remindEmail: boolean;
  creatorName: string;
};

/**
 * Jeden záznam události (v transakci i mimo) + notifikace zástupu při schvalování.
 */
export async function createCalendarEventUnit(
  db: Prisma.TransactionClient,
  a: CreateUnitArgs
): Promise<{ id: number }> {
  const color = getColorForEventType(a.eventType);

  const event = await db.calendar_events.create({
    data: {
      title: a.title,
      description: a.description || null,
      start_date: a.start,
      end_date: a.end,
      event_type: a.eventType,
      created_by: a.userId,
      department_id: a.resolvedDeptId,
      deputy_id: a.deputyIdNum,
      requires_approval: a.deputyIdNum !== null,
      approval_status: a.deputyIdNum !== null ? "pending" : null,
      is_public: a.is_public,
      location: a.location || null,
      color,
      remind_before_minutes: a.remindBefore,
      reminder_notify_in_app: a.remindInApp,
      reminder_notify_email: a.remindEmail,
      reminder_notified_at: null,
    },
  });

  if (a.deputyIdNum !== null) {
    await db.calendar_approvals.create({
      data: {
        event_id: event.id,
        approver_id: a.deputyIdNum,
        approval_type: "deputy",
        approval_order: 1,
        status: "pending",
      },
    });
    const notifMessage = `${a.creatorName} vytvořil/a událost „${a.title}“ (${a.eventType === "dovolena" ? "Dovolená" : "Osobní"}), která vyžaduje vaše schválení.`;
    await db.notifications.create({
      data: {
        user_id: a.deputyIdNum,
        title: "Událost čeká na schválení",
        message: notifMessage,
        type: "calendar_approval",
        link: `/calendar/${event.id}`,
      },
    });
  }

  return { id: event.id };
}
