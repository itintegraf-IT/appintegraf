import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageMaketyQueue, userCanEditMaketa } from "@/lib/makety-access";
import { parseMaketyDataKind } from "@/lib/makety-data-kind";
import { revalidateMaketyViews } from "@/lib/makety-revalidate";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const canEdit =
    (await userCanEditMaketa(userId, id)) || (await canManageMaketyQueue(userId));
  if (!canEdit) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data_kind = parseMaketyDataKind(
      typeof body.data_kind === "string" ? body.data_kind : undefined
    );

    const existing = await prisma.makety.findUnique({
      where: { id },
      select: { id: true, work_type: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
    }
    if (existing.work_type !== "grafika") {
      return NextResponse.json(
        { error: "Typ dat lze nastavit jen u grafiky" },
        { status: 400 }
      );
    }

    await prisma.makety.update({
      where: { id },
      data: { data_kind },
    });

    revalidateMaketyViews();
    return NextResponse.json({ success: true, data_kind });
  } catch (e) {
    console.error("PATCH /api/makety/[id]/data-kind", e);
    return NextResponse.json({ error: "Chyba při změně typu dat" }, { status: 500 });
  }
}
