import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";

/**
 * Obnovení starší verze jako primary.
 * PATCH /api/iml/products/[id]/pdf/versions/[version]/primary
 *
 * Atomicky nastaví is_primary=true pro cílovou verzi a false pro všechny
 * ostatní verze daného produktu. Neodstraňuje žádný záznam – historie zůstává.
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám IML" }, { status: 403 });
  }

  const p = await params;
  const id = parseInt(p.id, 10);
  const versionNum = parseInt(p.version, 10);
  if (isNaN(id) || isNaN(versionNum)) {
    return NextResponse.json({ error: "Neplatné ID nebo verze" }, { status: 400 });
  }

  const target = await prisma.iml_product_files.findUnique({
    where: { product_id_version: { product_id: id, version: versionNum } },
    select: { id: true, is_primary: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Verze neexistuje" }, { status: 404 });
  }

  if (target.is_primary) {
    return NextResponse.json({ success: true, already_primary: true });
  }

  await prisma.$transaction([
    prisma.iml_product_files.updateMany({
      where: { product_id: id, is_primary: true },
      data: { is_primary: false },
    }),
    prisma.iml_product_files.update({
      where: { id: target.id },
      data: { is_primary: true },
    }),
  ]);

  await logImlAudit({
    userId,
    action: "update",
    tableName: "iml_product_files",
    recordId: id,
    newValues: { promoted_version: versionNum },
  });

  return NextResponse.json({ success: true, primary_version: versionNum });
}
