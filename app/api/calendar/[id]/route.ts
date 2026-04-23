import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getColorForEventType } from "@/lib/calendar-event-colors";
import { findCreatorCalendarOverlap, formatOverlapErrorCs } from "@/lib/calendar-time-overlap";
import {
  normalizeParticipantUserIds,
  replaceEventParticipants,
  getParticipantUserIds,
  notifyCalendarInvitees,
} from "@/lib/calendar-participant-sync";

const OUT_OF_OFFICE_TYPES = [
  "dovolena",
  "osobni",
  "schuzka_mimo_firmu",
  "sluzebni_cesta",
  "lekar",
  "nemoc",
];

function formatDateTimeCs(d: Date): string {
  return d.toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const event = await prisma.calendar_events.findUnique({
    where: { id },
    include: {
      users: { select: { first_name: true, last_name: true } },
      departments: { select: { id: true, name: true } },
      users_deputy: { select: { id: true, first_name: true, last_name: true } },
      calendar_event_participants: {
        include: { users: { select: { id: true, first_name: true, last_name: true } } },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Událost nenalezena" }, { status: 404 });
  }

  return NextResponse.json(event);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const userId = parseInt(session.user.id, 10);

  const REMINDER_MINUTES_ALLOW = new Set([15, 30, 60, 120, 1440]);

  try {
    const body = await req.json();
    const {
      title,
      description = "",
      start_date,
      end_date,
      event_type = "jine",
      department_id = null,
      deputy_id = null,
      is_private = false,
      location = "",
      remind_before_minutes: remindRaw = null,
      reminder_notify_in_app: naRaw = true,
      reminder_notify_email: neRaw = true,
      participant_user_ids: participantUserIdsRaw = null,
    } = body;

    if (!title || !start_date || !end_date) {
      return NextResponse.json({ error: "Vyplňte název, datum začátku a konce" }, { status: 400 });
    }

    const eventType = String(event_type).trim() || "jine";
    let remindBefore: number | null = null;
    if (remindRaw !== null && remindRaw !== undefined && String(remindRaw).trim() !== "") {
      const n = parseInt(String(remindRaw), 10);
      if (Number.isFinite(n) && REMINDER_MINUTES_ALLOW.has(n)) {
        remindBefore = n;
      }
    }
    const reminderInApp = naRaw !== false;
    const reminderEmail = neRaw !== false;
    if (remindBefore !== null && !reminderInApp && !reminderEmail) {
      return NextResponse.json(
        { error: "U připomínky zvolte alespoň notifikace v aplikaci nebo e-mail." },
        { status: 400 }
      );
    }
    let deputyIdNum: number | null = null;

    if (eventType === "dovolena" || eventType === "osobni") {
      if (!deputy_id) {
        return NextResponse.json({ error: "U typu Dovolená a Osobní je zástup povinný" }, { status: 400 });
      }
      const parsed = parseInt(deputy_id, 10);
      if (isNaN(parsed)) {
        return NextResponse.json({ error: "Neplatný zástup" }, { status: 400 });
      }
      deputyIdNum = parsed;
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          department_id: true,
          user_secondary_departments: { select: { department_id: true } },
        },
      });
      const deptIds: number[] = [];
      if (user?.department_id) deptIds.push(user.department_id);
      for (const s of user?.user_secondary_departments ?? []) {
        if (!deptIds.includes(s.department_id)) deptIds.push(s.department_id);
      }
      const deputy = await prisma.users.findFirst({
        where: {
          id: deputyIdNum,
          is_active: true,
          OR: [
            { department_id: { in: deptIds } },
            { user_secondary_departments: { some: { department_id: { in: deptIds } } } },
          ],
        },
      });
      if (!deputy) {
        return NextResponse.json({ error: "Uživatel nemůže být zástupem" }, { status: 400 });
      }
    }

    const start = new Date(start_date);
    const end = new Date(end_date);
    if (end <= start) {
      return NextResponse.json({ error: "Datum konce musí být po datu začátku" }, { status: 400 });
    }

    const existing = await prisma.calendar_events.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Událost nenalezena" }, { status: 404 });
    }

    if (existing.created_by !== userId) {
      return NextResponse.json({ error: "Můžete upravovat pouze své vlastní události" }, { status: 403 });
    }

    const selfOverlap = await findCreatorCalendarOverlap(prisma, userId, start, end, { excludeEventId: id });
    if (selfOverlap) {
      return NextResponse.json({ error: formatOverlapErrorCs(selfOverlap, formatDateTimeCs) }, { status: 409 });
    }

    if (deputyIdNum !== null) {
      const deputyOutOfOfficeOverlap = await prisma.calendar_events.findFirst({
        where: {
          id: { not: id },
          created_by: deputyIdNum,
          event_type: { in: OUT_OF_OFFICE_TYPES },
          start_date: { lte: end },
          end_date: { gte: start },
          OR: [{ approval_status: { not: "rejected" } }, { approval_status: null }],
        },
        orderBy: { start_date: "asc" },
        select: {
          title: true,
          start_date: true,
          end_date: true,
        },
      });

      if (deputyOutOfOfficeOverlap) {
        return NextResponse.json(
          {
            error: `Zvolený zástup má kolidující událost mimo firmu (${deputyOutOfOfficeOverlap.title}, ${formatDateTimeCs(
              deputyOutOfOfficeOverlap.start_date
            )}–${formatDateTimeCs(deputyOutOfOfficeOverlap.end_date)}). Vyberte jiného zástupa nebo jiný termín.`,
          },
          { status: 409 }
        );
      }
    }

    const colorHex = getColorForEventType(eventType);
    const startChanged = existing.start_date.getTime() !== start.getTime();
    const endChanged = existing.end_date.getTime() !== end.getTime();
    const remindChanged = (existing.remind_before_minutes ?? null) !== remindBefore;
    const clearReminderSent = startChanged || endChanged || remindChanged;

    const oldParticipantIds = await getParticipantUserIds(prisma, id);
    const participantUserIds = normalizeParticipantUserIds(participantUserIdsRaw, {
      creatorId: userId,
      deputyId: deputyIdNum,
    });
    const newOnes = participantUserIds.filter((uid) => !oldParticipantIds.includes(uid));

    await prisma.$transaction(async (tx) => {
      await tx.calendar_events.update({
        where: { id },
        data: {
          title: String(title).trim(),
          description: description ? String(description).trim() : null,
          start_date: start,
          end_date: end,
          event_type: eventType,
          department_id: department_id ? parseInt(department_id, 10) : null,
          deputy_id: deputyIdNum,
          requires_approval: deputyIdNum !== null,
          approval_status: deputyIdNum !== null ? "pending" : null,
          is_private: !!is_private,
          is_public: !is_private,
          location: location ? String(location).trim() : null,
          color: colorHex,
          remind_before_minutes: remindBefore,
          reminder_notify_in_app: reminderInApp,
          reminder_notify_email: reminderEmail,
          ...(clearReminderSent ? { reminder_notified_at: null } : {}),
        },
      });
      await replaceEventParticipants(tx, id, participantUserIds);
    });

    const creator = await prisma.users.findUnique({
      where: { id: userId },
      select: { first_name: true, last_name: true },
    });
    const creatorName = creator ? `${creator.first_name} ${creator.last_name}`.trim() : "Uživatel";
    if (newOnes.length > 0) {
      await notifyCalendarInvitees(prisma, {
        userIds: newOnes,
        eventId: id,
        eventTitle: String(title).trim(),
        creatorName,
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Calendar PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání události" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const userId = parseInt(session.user.id, 10);

  const event = await prisma.calendar_events.findUnique({
    where: { id },
    include: {
      users: { select: { first_name: true, last_name: true } },
      calendar_approvals: {
        where: { status: "approved" },
        select: { approver_id: true },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Událost nenalezena" }, { status: 404 });
  }

  if (event.created_by !== userId) {
    return NextResponse.json({ error: "Můžete mazat pouze své vlastní události" }, { status: 403 });
  }

  const creatorName = event.users
    ? `${event.users.first_name} ${event.users.last_name}`
    : "Uživatel";

  type ApprovalRow = (typeof event.calendar_approvals)[number];
  const approverIds = [...new Set(event.calendar_approvals.map((a: ApprovalRow) => a.approver_id))].filter(
    (aid) => aid !== userId
  );

  if (approverIds.length > 0) {
    await prisma.notifications.createMany({
      data: approverIds.map((approverId) => ({
        user_id: approverId,
        title: "Událost byla smazána",
        message: `${creatorName} smazal/a událost „${event.title}“, kterou jste schválil/a.`,
        type: "calendar_deleted",
        link: "/calendar",
      })),
    });
  }

  await prisma.calendar_events.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
