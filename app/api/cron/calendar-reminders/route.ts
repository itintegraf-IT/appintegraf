import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendCalendarReminderEmail } from "@/lib/email";

/**
 * GET s ?secret= (CRON_SECRET) nebo hlavičkou Authorization: Bearer.
 * Nastavte v externím cronu (doporučeno každých 1–5 min).
 */
export async function GET(req: NextRequest) {
  const token = process.env.CRON_SECRET?.trim();
  if (!token) {
    return NextResponse.json({ error: "CRON_SECRET není nastaven" }, { status: 501 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("secret");
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (q !== token && bearer !== token) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const now = new Date();
  const rows = await prisma.calendar_events.findMany({
    where: {
      remind_before_minutes: { not: null },
      reminder_notified_at: null,
      start_date: { gt: now },
    },
    take: 500,
  });

  const toProcess = rows.filter((e) => {
    const m = e.remind_before_minutes;
    if (m == null) return false;
    const fireAt = e.start_date.getTime() - m * 60 * 1000;
    return now.getTime() >= fireAt;
  });

  for (const event of toProcess) {
    const u = await prisma.users.findUnique({
      where: { id: event.created_by },
      select: { first_name: true, last_name: true, email: true },
    });
    if (!u) {
      continue;
    }
    if (event.reminder_notify_in_app) {
      await prisma.notifications.create({
        data: {
          user_id: event.created_by,
          title: "Připomínka: nadcházející událost",
          message: `Za chvíli začíná: „${event.title}“.`,
          type: "calendar_reminder",
          link: `/calendar/${event.id}`,
        },
      });
    }
    if (event.reminder_notify_email && u.email) {
      await sendCalendarReminderEmail({
        toEmail: u.email,
        toName: `${u.first_name} ${u.last_name}`.trim() || "Uživateli",
        eventTitle: event.title,
        eventId: event.id,
        startsAt: event.start_date,
      });
    }
    await prisma.calendar_events.update({
      where: { id: event.id },
      data: { reminder_notified_at: now },
    });
  }

  return NextResponse.json({ ok: true, processed: toProcess.length });
}
