import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

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
      event_type = "event",
      department_id = null,
      is_public = false,
      location = "",
      color = "#DC2626",
    } = body;

    if (!title || !start_date || !end_date) {
      return NextResponse.json({ error: "Vyplňte název, datum začátku a konce" }, { status: 400 });
    }

    const userId = parseInt(session.user.id, 10);
    const start = new Date(start_date);
    const end = new Date(end_date);
    if (end <= start) {
      return NextResponse.json({ error: "Datum konce musí být po datu začátku" }, { status: 400 });
    }

    const event = await prisma.calendar_events.create({
      data: {
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        start_date: start,
        end_date: end,
        event_type: String(event_type).trim() || "event",
        created_by: userId,
        department_id: department_id ? parseInt(department_id, 10) : null,
        is_public: !!is_public,
        location: location ? String(location).trim() : null,
        color: color ? String(color).trim() : "#DC2626",
      },
    });

    return NextResponse.json({ success: true, id: event.id });
  } catch (e) {
    console.error("Calendar POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření události" }, { status: 500 });
  }
}
