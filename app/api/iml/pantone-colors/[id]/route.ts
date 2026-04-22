import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { isValidPantoneCode, normalizePantoneCode } from "@/lib/iml-pantone";

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

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  const color = await prisma.iml_pantone_colors.findUnique({
    where: { id },
    include: { _count: { select: { iml_product_colors: true } } },
  });
  if (!color) return NextResponse.json({ error: "Pantone nenalezeno" }, { status: 404 });

  return NextResponse.json(color);
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

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  const existing = await prisma.iml_pantone_colors.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Pantone nenalezeno" }, { status: 404 });

  try {
    const body = await req.json();
    const { code, name = null, hex = null, is_active } = body;

    const codeNorm = normalizePantoneCode(typeof code === "string" ? code : "");
    if (!isValidPantoneCode(codeNorm)) {
      return NextResponse.json(
        { error: "Neplatný Pantone kód", field: "code" },
        { status: 400 }
      );
    }

    const hexClean = typeof hex === "string" && hex.trim() ? hex.trim() : null;
    if (hexClean && !/^#[0-9A-Fa-f]{6}$/.test(hexClean)) {
      return NextResponse.json(
        { error: "HEX musí být ve formátu #RRGGBB", field: "hex" },
        { status: 400 }
      );
    }

    if (codeNorm !== existing.code) {
      const dup = await prisma.iml_pantone_colors.findUnique({ where: { code: codeNorm } });
      if (dup) {
        return NextResponse.json(
          { error: "Pantone s tímto kódem již existuje", field: "code" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.iml_pantone_colors.update({
      where: { id },
      data: {
        code: codeNorm,
        name: typeof name === "string" && name.trim() ? name.trim() : null,
        hex: hexClean ? hexClean.toUpperCase() : null,
        is_active: typeof is_active === "boolean" ? is_active : existing.is_active,
      },
    });

    await logImlAudit({
      userId,
      action: "update",
      tableName: "iml_pantone_colors",
      recordId: id,
      oldValues: { code: existing.code, is_active: existing.is_active },
      newValues: { code: updated.code, is_active: updated.is_active },
    });

    return NextResponse.json({ success: true, color: updated });
  } catch (e) {
    console.error("IML pantone-colors PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání" }, { status: 500 });
  }
}

/**
 * Soft-delete: is_active=false.
 * Pokud je Pantone navázán na produktové barvy (iml_product_colors), vrací 409.
 */
export async function DELETE(
  _req: NextRequest,
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

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  const existing = await prisma.iml_pantone_colors.findUnique({
    where: { id },
    include: { _count: { select: { iml_product_colors: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Pantone nenalezeno" }, { status: 404 });

  if (existing._count.iml_product_colors > 0) {
    return NextResponse.json(
      {
        error: `Pantone je navázán na ${existing._count.iml_product_colors} produkt(ů). Odstraňte nejprve vazby nebo jej deaktivujte.`,
      },
      { status: 409 }
    );
  }

  await prisma.iml_pantone_colors.update({
    where: { id },
    data: { is_active: false },
  });

  await logImlAudit({
    userId,
    action: "delete",
    tableName: "iml_pantone_colors",
    recordId: id,
    oldValues: { code: existing.code, is_active: existing.is_active },
  });

  return NextResponse.json({ success: true });
}
