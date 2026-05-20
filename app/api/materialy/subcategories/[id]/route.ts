import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canWriteMaterialCatalog } from "@/lib/materialy/access";
import { resolveCategoryCode } from "@/lib/materialy/load-categories";
import { logMaterialyAuditSafe } from "@/lib/materialy/audit";
import { permanentDeleteSubcategory } from "@/lib/materialy/delete-subcategory";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteMaterialCatalog(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const categoryParam = req.nextUrl.searchParams.get("category")?.trim().toUpperCase() ?? null;
  const expectedCategory =
    categoryParam != null && categoryParam !== ""
      ? (await resolveCategoryCode(categoryParam)) ?? undefined
      : undefined;

  const permanent =
    req.nextUrl.searchParams.get("permanent") === "1" ||
    req.nextUrl.searchParams.get("permanent") === "true";

  if (permanent) {
    const result = await permanentDeleteSubcategory(id, userId, expectedCategory);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, deleted: true });
  }

  const existing = await prisma.material_subcategories.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Podtyp nenalezen" }, { status: 404 });
  }
  if (expectedCategory && existing.category_code !== expectedCategory) {
    return NextResponse.json(
      { error: "Podtyp nepatří do zvolené kategorie materiálu." },
      { status: 400 }
    );
  }

  await prisma.material_subcategories.updateMany({
    where: { OR: [{ id }, { parent_id: id }] },
    data: { is_active: false },
  });

  await logMaterialyAuditSafe({
    userId,
    action: "deactivate",
    tableName: "material_subcategories",
    recordId: id,
    oldValues: { name: existing.name, is_active: true, category_code: existing.category_code },
    newValues: { is_active: false },
  });

  return NextResponse.json({ success: true });
}
