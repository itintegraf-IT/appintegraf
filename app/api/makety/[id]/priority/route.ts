import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageMaketyQueue } from "@/lib/makety-access";
import { revalidateMaketyViews } from "@/lib/makety-revalidate";
import { parseMaketaPriority } from "@/lib/makety-status";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageMaketyQueue(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const priority = parseMaketaPriority(
      typeof body.priority === "string" ? body.priority : undefined
    );

    const existing = await prisma.makety.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
    }

    await prisma.makety.update({
      where: { id },
      data: { priority },
    });

    revalidateMaketyViews();
    return NextResponse.json({ success: true, priority });
  } catch (e) {
    console.error("PATCH /api/makety/[id]/priority", e);
    return NextResponse.json({ error: "Chyba při změně priority" }, { status: 500 });
  }
}
