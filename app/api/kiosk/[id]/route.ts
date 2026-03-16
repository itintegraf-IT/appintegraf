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

  const presentation = await prisma.presentations.findUnique({
    where: { id },
    include: { slides: { orderBy: { sort_order: "asc" } } },
  });

  if (!presentation) {
    return NextResponse.json({ error: "Prezentace nenalezena" }, { status: 404 });
  }

  return NextResponse.json(presentation);
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
      name,
      description = "",
      transition_effect = "fade",
      transition_time = 5,
      display_duration = 10,
      is_active = true,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Vyplňte název prezentace" }, { status: 400 });
    }

    await prisma.presentations.update({
      where: { id },
      data: {
        name: String(name).trim(),
        description: description ? String(description).trim() : null,
        transition_effect: String(transition_effect).trim() || "fade",
        transition_time: transition_time ? parseInt(String(transition_time), 10) : 5,
        display_duration: display_duration ? parseInt(String(display_duration), 10) : 10,
        is_active: !!is_active,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Kiosk PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání prezentace" }, { status: 500 });
  }
}
