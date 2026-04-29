import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requiresDeputy } from "@/app/(dashboard)/calendar/lib/event-types";
import { findCreatorCalendarOverlap, formatOverlapErrorCs } from "@/lib/calendar-time-overlap";

const OUT_OF_OFFICE_TYPES = [
  "dovolena",
  "osobni",
  "schuzka_mimo_firmu",
  "schuzka_praha",
  "sluzebni_cesta",
  "lekar",
  "nemoc",
] as const;

function formatDateTimeCs(d: Date): string {
  return d.toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * PATCH /api/calendar/[id]/move
 * Přesunutí události (změna data/času).
 * Body: { start_date: string, end_date: string, all_day?: boolean }
 * Při přesunu dovolené/osobní: reset schválení, notifikace zástupovi.
 */
export async function PATCH(
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

  const event = await prisma.calendar_events.findUnique({
    where: { id },
    include: {
      users: { select: { first_name: true, last_name: true } },
      users_deputy: { select: { id: true, first_name: true, last_name: true } },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Událost nenalezena" }, { status: 404 });
  }

  if (event.created_by !== userId) {
    return NextResponse.json({ error: "Můžete přesouvat pouze své vlastní události" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const start_date = body.start_date;
  const end_date = body.end_date;
  const all_day = !!body.all_day;

  if (!start_date || !end_date) {
    return NextResponse.json({ error: "Vyplňte datum začátku a konce" }, { status: 400 });
  }

  const start = new Date(start_date);
  const end = new Date(end_date);
  if (end <= start) {
    return NextResponse.json({ error: "Datum konce musí být po datu začátku" }, { status: 400 });
  }

  if (all_day) {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  const selfOverlap = await findCreatorCalendarOverlap(prisma, userId, start, end, { excludeEventId: id });
  if (selfOverlap) {
    return NextResponse.json({ error: formatOverlapErrorCs(selfOverlap, formatDateTimeCs) }, { status: 409 });
  }

  if (event.deputy_id) {
    const depOverlap = await prisma.calendar_events.findFirst({
      where: {
        id: { not: id },
        created_by: event.deputy_id,
        event_type: { in: [...OUT_OF_OFFICE_TYPES] },
        start_date: { lte: end },
        end_date: { gte: start },
        OR: [{ approval_status: { not: "rejected" } }, { approval_status: null }],
      },
      select: { title: true, start_date: true, end_date: true },
    });
    if (depOverlap) {
      return NextResponse.json(
        {
          error: `Zástup má kolidující událost mimo firmu (${depOverlap.title}, ${formatDateTimeCs(
            depOverlap.start_date
          )}–${formatDateTimeCs(depOverlap.end_date)}). Vyberte jiný termín nebo jiného zástupa v úpravě události.`,
        },
        { status: 409 }
      );
    }
  }

  const needsApprovalReset =
    event.deputy_id &&
    requiresDeputy(event.event_type) &&
    (event.approval_status === "approved" || event.approval_status === "deputy_approved");

  const creatorName = event.users
    ? `${event.users.first_name} ${event.users.last_name}`
    : "Uživatel";

  if (needsApprovalReset && event.deputy_id) {
    await prisma.$transaction([
      prisma.calendar_events.update({
        where: { id },
        data: {
          start_date: start,
          end_date: end,
          approval_status: "pending",
          updated_at: new Date(),
        },
      }),
      prisma.calendar_approvals.updateMany({
        where: { event_id: id, approval_type: "deputy" },
        data: {
          status: "pending",
          comment: null,
          approved_at: null,
          updated_at: new Date(),
        },
      }),
      prisma.calendar_approvals.deleteMany({
        where: { event_id: id, approval_type: "manager" },
      }),
      prisma.notifications.create({
        data: {
          user_id: event.deputy_id,
          title: "Událost byla přesunuta",
          message: `${creatorName} přesunul/a událost „${event.title}“ na nové datum. Událost čeká na vaše schválení.`,
          type: "calendar_approval",
          link: `/calendar/${id}`,
        },
      }),
    ]);
  } else {
    await prisma.calendar_events.update({
      where: { id },
      data: {
        start_date: start,
        end_date: end,
        updated_at: new Date(),
      },
    });
  }

  return NextResponse.json({ success: true });
}
