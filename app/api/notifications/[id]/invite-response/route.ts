import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { sendCalendarInviteResponseEmail } from "@/lib/email";

function parseEventIdFromLink(link: string | null): number | null {
  if (!link) return null;
  const m = link.match(/^\/calendar\/(\d+)(?:\/|$)/);
  if (!m) return null;
  const id = parseInt(m[1], 10);
  return Number.isFinite(id) ? id : null;
}

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

  const eventId = parseEventIdFromLink(notification.link);
  if (!eventId) {
    return NextResponse.json({ error: "Pozvánka nemá platný odkaz na událost" }, { status: 400 });
  }

  const event = await prisma.calendar_events.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      created_by: true,
      users: { select: { first_name: true, last_name: true } },
    },
  });
  if (!event) {
    return NextResponse.json({ error: "Událost nenalezena" }, { status: 404 });
  }

  const participant = await prisma.calendar_event_participants.findFirst({
    where: { event_id: eventId, user_id: userId },
    select: { id: true, status: true },
  });
  if (!participant) {
    return NextResponse.json({ error: "Nejste mezi pozvanými účastníky" }, { status: 403 });
  }
  if (participant.status && participant.status !== "pending") {
    return NextResponse.json({ error: "Na tuto pozvánku už jste reagoval/a" }, { status: 409 });
  }

  const me = await prisma.users.findUnique({
    where: { id: userId },
    select: { first_name: true, last_name: true },
  });
  const meName = me ? `${me.first_name} ${me.last_name}`.trim() : "Účastník";
  const creatorName = event.users
    ? `${event.users.first_name} ${event.users.last_name}`.trim() || "Pořadatel"
    : "Pořadatel";

  const participantStatus = action === "approve" ? "accepted" : "rejected";
  const ownerMessage =
    action === "approve"
      ? `${meName} přijal/a pozvánku na událost „${event.title}“.`
      : `${meName} odmítl/a pozvánku na událost „${event.title}“. Důvod: ${reason}`;

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
  if (owner && ownerEmail) {
    const ownerName = `${owner.first_name} ${owner.last_name}`.trim() || "Pořadatel";
    const emailResult = await sendCalendarInviteResponseEmail({
      toEmail: ownerEmail,
      toName: ownerName,
      responderName: meName,
      eventTitle: event.title,
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
