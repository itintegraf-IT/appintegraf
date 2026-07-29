import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const ids = Array.isArray(body.ids)
      ? ([...new Set(body.ids.map((id: unknown) => parseInt(String(id), 10)).filter((id: number) => !isNaN(id)))] as number[])
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "Nebyly vybrány žádné výseky" }, { status: 400 });
    }

    const rows = await prisma.iml_die_cuts.findMany({
      where: { id: { in: ids } },
      select: { id: true, is_active: true, label_shape_code: true },
    });

    const activeOnes = rows.filter((r) => r.is_active);
    if (activeOnes.length > 0) {
      return NextResponse.json(
        {
          error: `Nelze smazat aktivní výseky (${activeOnes.map((r) => r.label_shape_code).join(", ")}). Nejdříve je deaktivujte.`,
        },
        { status: 400 }
      );
    }

    const existingIds = rows.map((r) => r.id);
    if (existingIds.length === 0) {
      return NextResponse.json({ error: "Žádné výseky nenalezeny" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.iml_products.updateMany({
        where: { die_cut_id: { in: existingIds } },
        data: { die_cut_id: null },
      });
      await tx.iml_die_cuts.deleteMany({
        where: { id: { in: existingIds } },
      });
    });

    for (const row of rows) {
      await logImlAudit({
        userId,
        action: "permanent_delete",
        tableName: "iml_die_cuts",
        recordId: row.id,
        oldValues: { label_shape_code: row.label_shape_code },
      });
    }

    return NextResponse.json({ success: true, deleted: existingIds.length });
  } catch (e) {
    console.error("POST /api/iml/die-cuts/bulk-delete", e);
    return NextResponse.json({ error: "Chyba při hromadném mazání" }, { status: 500 });
  }
}
