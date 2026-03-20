import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

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
      is_public = false,
      location = "",
      color = "#DC2626",
    } = body;

    if (!title || !start_date || !end_date) {
      return NextResponse.json({ error: "Vyplňte název, datum začátku a konce" }, { status: 400 });
    }

    const eventType = String(event_type).trim() || "jine";
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
      const userId = parseInt(session.user!.id!, 10);
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

    await prisma.calendar_events.update({
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
        is_public: !!is_public,
        location: location ? String(location).trim() : null,
        color: color ? String(color).trim() : "#DC2626",
      },
    });

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
