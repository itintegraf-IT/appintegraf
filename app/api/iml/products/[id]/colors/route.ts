import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import {
  replaceProductColorsInTx,
  validateProductColorsInput,
  type IncomingProductColor,
} from "@/lib/iml-product-colors";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const productId = parseInt((await params).id, 10);
  if (isNaN(productId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const colors = await prisma.iml_product_colors.findMany({
    where: { product_id: productId },
    include: {
      iml_pantone_colors: {
        select: { id: true, code: true, name: true, hex: true, is_active: true },
      },
    },
    orderBy: [{ sort_order: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({ colors });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const productId = parseInt((await params).id, 10);
  if (isNaN(productId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const product = await prisma.iml_products.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Produkt nenalezen" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.colors)) {
    return NextResponse.json({ error: "Chybí pole 'colors'" }, { status: 400 });
  }
  const autoCreate = Boolean(body.auto_create);
  const incoming = body.colors as IncomingProductColor[];

  const validation = validateProductColorsInput(incoming);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Neplatné vstupy", details: validation.details },
      { status: 400 }
    );
  }

  const before = await prisma.iml_product_colors.findMany({
    where: { product_id: productId },
    select: { pantone_id: true, coverage_pct: true, sort_order: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    return replaceProductColorsInTx(tx, productId, validation.prepared, autoCreate);
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, missing_codes: result.missing_codes },
      { status: result.status }
    );
  }

  // Pro konzistentní odpověď ještě dotáhneme pantone data (replaceProductColorsInTx vrací minimální tvar).
  const full = await prisma.iml_product_colors.findMany({
    where: { product_id: productId },
    include: {
      iml_pantone_colors: {
        select: { id: true, code: true, name: true, hex: true, is_active: true },
      },
    },
    orderBy: [{ sort_order: "asc" }, { id: "asc" }],
  });

  await logImlAudit({
    userId,
    action: "update",
    tableName: "iml_product_colors",
    recordId: productId,
    oldValues: { colors: before },
    newValues: {
      colors: full.map((c) => ({
        pantone_id: c.pantone_id,
        coverage_pct: Number(c.coverage_pct),
        sort_order: c.sort_order,
      })),
    },
  });

  return NextResponse.json({ success: true, colors: full });
}
