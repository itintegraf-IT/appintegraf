import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function POST(
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

  const presentation = await prisma.presentations.findUnique({
    where: { id },
    include: { slides: true },
  });
  if (!presentation) {
    return NextResponse.json({ error: "Prezentace nenalezena" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const order = body.order as number[];
    if (!Array.isArray(order)) {
      return NextResponse.json({ error: "Neplatné pořadí" }, { status: 400 });
    }

    await prisma.$transaction(
      order.map((slideId, index) =>
        prisma.slides.updateMany({
          where: { id: slideId, presentation_id: id },
          data: { sort_order: index },
        })
      )
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Reorder error:", e);
    return NextResponse.json({ error: "Chyba při změně pořadí" }, { status: 500 });
  }
}
