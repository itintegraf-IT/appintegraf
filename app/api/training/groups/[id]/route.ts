import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

async function requireWrite(): Promise<{ userId: number } | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění spravovat skupiny" }, { status: 403 });
  }
  return { userId };
}

/** Úprava skupiny; pole member_ids přepíše kompletní seznam členů. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireWrite();
  if (access instanceof NextResponse) return access;
  const { userId } = access;

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  try {
    const body = await req.json();
    const existing = await prisma.user_groups.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Skupina nenalezena" }, { status: 404 });

    const data: Record<string, unknown> = { updated_at: new Date() };
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "Název nesmí být prázdný" }, { status: 400 });
      data.name = name;
    }
    if (body.description !== undefined) data.description = String(body.description).trim() || null;

    await prisma.user_groups.update({ where: { id }, data });

    if (Array.isArray(body.member_ids)) {
      const memberIds = [
        ...new Set(
          body.member_ids
            .map((mid: unknown) => parseInt(String(mid), 10))
            .filter((mid: number) => !isNaN(mid))
        ),
      ] as number[];

      await prisma.$transaction([
        prisma.user_group_members.deleteMany({ where: { group_id: id } }),
        prisma.user_group_members.createMany({
          data: memberIds.map((memberId) => ({
            group_id: id,
            user_id: memberId,
            added_by: userId,
          })),
        }),
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Training group PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání skupiny" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireWrite();
  if (access instanceof NextResponse) return access;

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  try {
    const assignments = await prisma.test_assignments.count({ where: { group_id: id } });
    if (assignments > 0) {
      return NextResponse.json(
        { error: "Skupinu nelze smazat – má přiřazené testy. Nejprve zrušte přiřazení." },
        { status: 400 }
      );
    }

    await prisma.user_groups.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Training group DELETE error:", e);
    return NextResponse.json({ error: "Chyba při mazání skupiny" }, { status: 500 });
  }
}
