import { prisma } from "@/lib/db";

export function parseCalendarEventIdFromNotificationLink(link: string | null): number | null {
  if (!link) return null;
  const m = link.match(/^\/calendar\/(\d+)(?:\/|$)/);
  if (!m) return null;
  const id = parseInt(m[1], 10);
  return Number.isFinite(id) ? id : null;
}

/**
 * Označí zastaralé pozvánky jako přečtené: událost neexistuje, už skončila,
 * nebo uživatel už reagoval.
 */
export async function dismissStaleCalendarInviteNotifications(userId: number): Promise<number> {
  const invites = await prisma.notifications.findMany({
    where: {
      user_id: userId,
      type: "calendar_invite",
      read_at: null,
    },
    select: { id: true, link: true },
  });

  if (invites.length === 0) return 0;

  const eventIds = [
    ...new Set(
      invites
        .map((n) => parseCalendarEventIdFromNotificationLink(n.link))
        .filter((id): id is number => id !== null)
    ),
  ];

  const events =
    eventIds.length > 0
      ? await prisma.calendar_events.findMany({
          where: { id: { in: eventIds } },
          select: { id: true, end_date: true },
        })
      : [];
  const eventById = new Map(events.map((e) => [e.id, e]));

  const participants =
    eventIds.length > 0
      ? await prisma.calendar_event_participants.findMany({
          where: { user_id: userId, event_id: { in: eventIds } },
          select: { event_id: true, status: true },
        })
      : [];
  const participantByEvent = new Map(participants.map((p) => [p.event_id, p.status]));

  const now = new Date();
  const toDismiss: number[] = [];

  for (const invite of invites) {
    const eventId = parseCalendarEventIdFromNotificationLink(invite.link);
    if (eventId === null) {
      toDismiss.push(invite.id);
      continue;
    }

    const event = eventById.get(eventId);
    if (!event) {
      toDismiss.push(invite.id);
      continue;
    }

    if (new Date(event.end_date) < now) {
      toDismiss.push(invite.id);
      continue;
    }

    const status = participantByEvent.get(eventId);
    if (status && status !== "pending") {
      toDismiss.push(invite.id);
    }
  }

  if (toDismiss.length === 0) return 0;

  await prisma.notifications.updateMany({
    where: { id: { in: toDismiss }, user_id: userId },
    data: { read_at: new Date() },
  });

  return toDismiss.length;
}
