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
      event_type = "event",
      department_id = null,
      is_public = false,
      location = "",
      color = "#DC2626",
    } = body;

    if (!title || !start_date || !end_date) {
      return NextResponse.json({ error: "Vyplňte název, datum začátku a konce" }, { status: 400 });
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
        event_type: String(event_type).trim() || "event",
        department_id: department_id ? parseInt(department_id, 10) : null,
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
