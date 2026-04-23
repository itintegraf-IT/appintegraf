import type { Prisma, PrismaClient } from "@prisma/client";
import { sendCalendarInviteEmail } from "@/lib/email";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Ořeže duplicity, cizince a tvůrce se zástupem (ti jsou v události jinak).
 */
export function normalizeParticipantUserIds(
  raw: unknown,
  options: { creatorId: number; deputyId: number | null }
): number[] {
  const { creatorId, deputyId } = options;
  const set = new Set<number>();
  const arr = Array.isArray(raw) ? raw : [];
  for (const x of arr) {
    const n = typeof x === "number" ? x : parseInt(String(x), 10);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (n === creatorId) continue;
    if (deputyId != null && n === deputyId) continue;
    set.add(n);
  }
  return [...set];
}

export async function replaceEventParticipants(
  db: Db,
  eventId: number,
  userIds: number[]
): Promise<void> {
  if (userIds.length === 0) {
    await db.calendar_event_participants.deleteMany({ where: { event_id: eventId } });
    return;
  }
  const valid = await db.users.findMany({
    where: { id: { in: userIds }, is_active: true },
    select: { id: true },
  });
  const ids = valid.map((u) => u.id);
  await db.calendar_event_participants.deleteMany({ where: { event_id: eventId } });
  if (ids.length > 0) {
    await db.calendar_event_participants.createMany({
      data: ids.map((user_id) => ({
        event_id: eventId,
        user_id,
        status: "pending",
      })),
    });
  }
}

export async function getParticipantUserIds(
  db: PrismaClient,
  eventId: number
): Promise<number[]> {
  const rows = await db.calendar_event_participants.findMany({
    where: { event_id: eventId },
    select: { user_id: true },
  });
  return rows.map((r) => r.user_id);
}

export async function notifyCalendarInvitees(
  db: PrismaClient,
  options: { userIds: number[]; eventId: number; eventTitle: string; creatorName: string; extraHint?: string }
): Promise<void> {
  if (options.userIds.length === 0) return;
  const hint = options.extraHint ? ` ${options.extraHint}` : "";
  await db.notifications.createMany({
    data: options.userIds.map((user_id) => ({
      user_id,
      title: "Pozvánka do kalendáře",
      message: `${options.creatorName} vás pozval/a k události „${options.eventTitle}“.${hint}`,
      type: "calendar_invite",
      link: `/calendar/${options.eventId}`,
    })),
  });

  const users = await db.users.findMany({
    where: { id: { in: options.userIds } },
    select: { id: true, email: true, first_name: true, last_name: true },
  });
  for (const u of users) {
    const email = u.email?.trim();
    if (!email) continue;
    const toName = `${u.first_name} ${u.last_name}`.trim() || "Uživateli";
    const r = await sendCalendarInviteEmail({
      toEmail: email,
      toName,
      creatorName: options.creatorName,
      eventTitle: options.eventTitle,
      eventId: options.eventId,
      extraHint: options.extraHint,
    });
    if (!r.success && r.error) {
      console.error(`notifyCalendarInvitees: e-mail pro user ${u.id} se nepodařil: ${r.error}`);
    }
  }
}
