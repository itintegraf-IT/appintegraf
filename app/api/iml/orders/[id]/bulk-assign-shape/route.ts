import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import {
  buildProductUpdateFromShapeSelection,
  resolveDefaultToolAndImposition,
} from "@/lib/iml/product-shape-sync";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Hromadné přiřazení tvaru (+ PRIMARY nástroj + výchozí montáž) vybraným položkám objednávky.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const orderId = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(orderId)) {
    return NextResponse.json({ error: "Neplatné ID objednávky" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    shape_id?: number;
    item_ids?: number[];
  };
  const shapeId = body.shape_id != null ? Number(body.shape_id) : NaN;
  const itemIds = Array.isArray(body.item_ids)
    ? body.item_ids.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
    : [];

  if (!Number.isFinite(shapeId) || shapeId < 1) {
    return NextResponse.json({ error: "Chybí shape_id" }, { status: 400 });
  }
  if (itemIds.length === 0) {
    return NextResponse.json({ error: "Vyberte alespoň jednu položku" }, { status: 400 });
  }

  const shape = await prisma.iml_shape_catalog.findUnique({ where: { id: shapeId } });
  if (!shape) {
    return NextResponse.json({ error: "Tvar nenalezen" }, { status: 404 });
  }

  const { toolId, impositionId } = await resolveDefaultToolAndImposition(shapeId);
  const updateData = await buildProductUpdateFromShapeSelection({
    shapeId,
    toolId,
    impositionId,
  });

  const items = await prisma.iml_order_items.findMany({
    where: { id: { in: itemIds }, order_id: orderId },
    select: { id: true, product_id: true },
  });
  if (items.length === 0) {
    return NextResponse.json({ error: "Žádné platné položky v této objednávce" }, { status: 400 });
  }

  const productIds = [...new Set(items.map((i) => i.product_id))];

  await prisma.$transaction(
    productIds.map((id) =>
      prisma.iml_products.update({
        where: { id },
        data: updateData,
      })
    )
  );

  return NextResponse.json({
    success: true,
    updatedProducts: productIds.length,
    shapeId,
    toolId,
    impositionId,
  });
}
