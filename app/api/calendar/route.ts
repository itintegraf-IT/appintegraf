import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { sendCalendarApprovalEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};

  if (from && to) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    where.start_date = { lte: toDate };
    where.end_date = { gte: fromDate };
  }

  const events = await prisma.calendar_events.findMany({
    where,
    orderBy: { start_date: "asc" },
    take: 100,
    include: {
      users: { select: { first_name: true, last_name: true } },
    },
  });

  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
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

    const userId = parseInt(session.user.id, 10);
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

    const creator = await prisma.users.findUnique({
      where: { id: userId },
      select: { first_name: true, last_name: true, department_id: true },
    });
    const creatorName = creator ? `${creator.first_name} ${creator.last_name}` : "Uživatel";

    const resolvedDeptId = department_id
      ? parseInt(department_id, 10)
      : creator?.department_id ?? null;

    const event = await prisma.calendar_events.create({
      data: {
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        start_date: start,
        end_date: end,
        event_type: eventType,
        created_by: userId,
        department_id: resolvedDeptId,
        deputy_id: deputyIdNum,
        requires_approval: deputyIdNum !== null,
        approval_status: deputyIdNum !== null ? "pending" : null,
        is_public: !!is_public,
        location: location ? String(location).trim() : null,
        color: color ? String(color).trim() : "#DC2626",
      },
    });

    if (deputyIdNum !== null) {
      await prisma.calendar_approvals.create({
        data: {
          event_id: event.id,
          approver_id: deputyIdNum,
          approval_type: "deputy",
          approval_order: 1,
          status: "pending",
        },
      });
      const notifMessage = `${creatorName} vytvořil/a událost „${String(title).trim()}“ (${eventType === "dovolena" ? "Dovolená" : "Osobní"}), která vyžaduje vaše schválení.`;
      await prisma.notifications.create({
        data: {
          user_id: deputyIdNum,
          title: "Událost čeká na schválení",
          message: notifMessage,
          type: "calendar_approval",
          link: `/calendar/${event.id}`,
        },
      });
      const deputy = await prisma.users.findUnique({
        where: { id: deputyIdNum },
        select: { email: true, first_name: true, last_name: true },
      });
      if (deputy?.email) {
        await sendCalendarApprovalEmail({
          toEmail: deputy.email,
          toName: `${deputy.first_name} ${deputy.last_name}`.trim() || "Schvalovateli",
          subject: "Událost čeká na schválení – INTEGRAF",
          message: notifMessage,
          eventTitle: String(title).trim(),
          eventId: event.id,
        });
      }
    }

    return NextResponse.json({ success: true, id: event.id });
  } catch (e) {
    console.error("Calendar POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření události" }, { status: 500 });
  }
}
