import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { sendCalendarInviteResponseEmail } from "@/lib/email";
import { formatCalendarEventTitleWithDuration } from "@/app/(dashboard)/calendar/lib/event-types";
import { parseCalendarEventIdFromNotificationLink } from "@/lib/calendar-invite-notifications";
import { userAllowsEmailNotification } from "@/lib/user-email-notifications-db";

/**
 * POST /api/notifications/[id]/invite-response
 * Body: { action: "approve" | "reject", reason?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const notificationId = parseInt((await params).id, 10);
  if (!Number.isFinite(notificationId)) {
    return NextResponse.json({ error: "Neplatné ID notifikace" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action === "reject" ? "reject" : "approve";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (action === "reject" && !reason) {
    return NextResponse.json({ error: "Důvod zamítnutí je povinný" }, { status: 400 });
  }

  const notification = await prisma.notifications.findFirst({
    where: { id: notificationId, user_id: userId, type: "calendar_invite" },
    select: { id: true, link: true, title: true, message: true, read_at: true },
  });
  if (!notification) {
    return NextResponse.json({ error: "Pozvánka nenalezena" }, { status: 404 });
  }

  const eventId = parseCalendarEventIdFromNotificationLink(notification.link);
  if (!eventId) {
    await prisma.notifications.updateMany({
      where: { id: notificationId, user_id: userId },
      data: { read_at: new Date() },
    });
    return NextResponse.json({
      success: true,
      action: "dismissed",
      message: "Neplatná pozvánka byla skryta.",
    });
  }

  const event = await prisma.calendar_events.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      event_type: true,
      start_date: true,
      end_date: true,
      created_by: true,
      users: { select: { first_name: true, last_name: true } },
    },
  });
  if (!event) {
    await prisma.notifications.updateMany({
      where: { id: notificationId, user_id: userId },
      data: { read_at: new Date() },
    });
    return NextResponse.json({
      success: true,
      action: "dismissed",
      message: "Událost již neexistuje – pozvánka byla skryta.",
    });
  }

  if (new Date(event.end_date) < new Date()) {
    await prisma.notifications.updateMany({
      where: { id: notificationId, user_id: userId },
      data: { read_at: new Date() },
    });
    return NextResponse.json({
      success: true,
      action: "dismissed",
      message: "Událost již skončila – pozvánka byla skryta.",
    });
  }

  const participant = await prisma.calendar_event_participants.findFirst({
    where: { event_id: eventId, user_id: userId },
    select: { id: true, status: true },
  });
  if (!participant) {
    await prisma.notifications.updateMany({
      where: { id: notificationId, user_id: userId },
      data: { read_at: new Date() },
    });
    return NextResponse.json({
      success: true,
      action: "dismissed",
      message: "Nejste mezi pozvanými – notifikace byla skryta.",
    });
  }
  if (participant.status && participant.status !== "pending") {
    await prisma.notifications.updateMany({
      where: { id: notificationId, user_id: userId },
      data: { read_at: new Date() },
    });
    return NextResponse.json({
      success: true,
      action: "dismissed",
      message: "Na tuto pozvánku už jste reagoval/a – notifikace byla skryta.",
    });
  }

  const me = await prisma.users.findUnique({
    where: { id: userId },
    select: { first_name: true, last_name: true },
  });
  const meName = me ? `${me.first_name} ${me.last_name}`.trim() : "Účastník";
  const creatorName = event.users
    ? `${event.users.first_name} ${event.users.last_name}`.trim() || "Pořadatel"
    : "Pořadatel";

  const displayTitle = formatCalendarEventTitleWithDuration(event);

  const participantStatus = action === "approve" ? "accepted" : "rejected";
  const ownerMessage =
    action === "approve"
      ? `${meName} přijal/a pozvánku na událost „${displayTitle}“.`
      : `${meName} odmítl/a pozvánku na událost „${displayTitle}“. Důvod: ${reason}`;

  await prisma.$transaction([
    prisma.calendar_event_participants.update({
      where: { id: participant.id },
      data: { status: participantStatus },
    }),
    prisma.notifications.updateMany({
      where: { id: notificationId, user_id: userId },
      data: { read_at: new Date() },
    }),
    prisma.notifications.create({
      data: {
        user_id: event.created_by,
        title:
          action === "approve"
            ? "Pozvánka přijata"
            : "Pozvánka odmítnuta",
        message: ownerMessage,
        type: action === "approve" ? "calendar_invite_accepted" : "calendar_invite_rejected",
        link: `/calendar/${event.id}`,
      },
    }),
  ]);

  const owner = await prisma.users.findUnique({
    where: { id: event.created_by },
    select: { email: true, first_name: true, last_name: true },
  });
  const ownerEmail = owner?.email?.trim();
  if (
    owner &&
    ownerEmail &&
    (await userAllowsEmailNotification(event.created_by, "calendar"))
  ) {
    const ownerName = `${owner.first_name} ${owner.last_name}`.trim() || "Pořadatel";
    const emailResult = await sendCalendarInviteResponseEmail({
      toEmail: ownerEmail,
      toName: ownerName,
      responderName: meName,
      eventTitle: displayTitle,
      eventId: event.id,
      action,
      reason: action === "reject" ? reason : undefined,
    });
    if (!emailResult.success && emailResult.error) {
      console.error(
        `invite-response: e-mail pro pořadatele (user ${event.created_by}) se nepodařil: ${emailResult.error}`
      );
    }
  }

  return NextResponse.json({
    success: true,
    action,
    message:
      action === "approve"
        ? `Pozvánku na událost od ${creatorName} jste přijal/a.`
        : `Pozvánku na událost od ${creatorName} jste odmítl/a.`,
  });
}
