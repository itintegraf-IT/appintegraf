import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import {
  buildProductUpdateFromShapeSelection,
  resolveDefaultToolAndImposition,
} from "@/lib/iml/product-shape-sync";

/**
 * Hromadné přiřazení tvaru (+ PRIMARY nástroj + výchozí montáž) vybraným produktům.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    shape_id?: number;
    product_ids?: number[];
  };
  const shapeId = body.shape_id != null ? Number(body.shape_id) : NaN;
  const productIds = Array.isArray(body.product_ids)
    ? [...new Set(body.product_ids.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))]
    : [];

  if (!Number.isFinite(shapeId) || shapeId < 1) {
    return NextResponse.json({ error: "Chybí shape_id" }, { status: 400 });
  }
  if (productIds.length === 0) {
    return NextResponse.json({ error: "Vyberte alespoň jeden produkt" }, { status: 400 });
  }
  if (productIds.length > 500) {
    return NextResponse.json({ error: "Maximálně 500 produktů najednou." }, { status: 400 });
  }

  const shape = await prisma.iml_shape_catalog.findUnique({ where: { id: shapeId } });
  if (!shape) {
    return NextResponse.json({ error: "Tvar nenalezen" }, { status: 404 });
  }

  const existing = await prisma.iml_products.findMany({
    where: { id: { in: productIds } },
    select: { id: true },
  });
  if (existing.length === 0) {
    return NextResponse.json({ error: "Žádné platné produkty" }, { status: 400 });
  }
  const ids = existing.map((p) => p.id);

  const { toolId, impositionId } = await resolveDefaultToolAndImposition(shapeId);
  const updateData = await buildProductUpdateFromShapeSelection({
    shapeId,
    toolId,
    impositionId,
  });

  await prisma.$transaction(
    ids.map((id) =>
      prisma.iml_products.update({
        where: { id },
        data: updateData,
      })
    )
  );

  await logImlAudit({
    userId,
    action: "update",
    tableName: "iml_products",
    recordId: ids[0],
    newValues: {
      bulk_assign_shape: true,
      shape_id: shapeId,
      product_ids: ids,
      count: ids.length,
    },
  });

  return NextResponse.json({
    success: true,
    updatedProducts: ids.length,
    shapeId,
    toolId,
    impositionId,
  });
}
