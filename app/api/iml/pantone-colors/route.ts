import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { isValidPantoneCode, normalizePantoneCode } from "@/lib/iml-pantone";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true";
  const search = searchParams.get("search")?.trim() ?? "";

  const where: { is_active?: boolean; OR?: Array<Record<string, unknown>> } = {};
  if (!all) where.is_active = true;
  if (search) {
    where.OR = [
      { code: { contains: search } },
      { name: { contains: search } },
    ];
  }

  const colors = await prisma.iml_pantone_colors.findMany({
    where,
    orderBy: [{ is_active: "desc" }, { code: "asc" }],
    take: 1000,
  });

  return NextResponse.json({ colors });
}

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
    const { code, name = null, hex = null, is_active = true } = body;

    const codeNorm = normalizePantoneCode(typeof code === "string" ? code : "");
    if (!isValidPantoneCode(codeNorm)) {
      return NextResponse.json(
        { error: "Neplatný Pantone kód (A–Z, 0–9, mezera, pomlčka; max 32 znaků)", field: "code" },
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

    const dup = await prisma.iml_pantone_colors.findUnique({ where: { code: codeNorm } });
    if (dup) {
      return NextResponse.json(
        { error: "Pantone s tímto kódem již existuje", field: "code" },
        { status: 400 }
      );
    }

    const color = await prisma.iml_pantone_colors.create({
      data: {
        code: codeNorm,
        name: typeof name === "string" && name.trim() ? name.trim() : null,
        hex: hexClean ? hexClean.toUpperCase() : null,
        is_active: Boolean(is_active),
      },
    });

    await logImlAudit({
      userId,
      action: "create",
      tableName: "iml_pantone_colors",
      recordId: color.id,
      newValues: { code: color.code, is_active: color.is_active },
    });

    return NextResponse.json({ success: true, color });
  } catch (e) {
    console.error("IML pantone-colors POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření Pantone barvy" }, { status: 500 });
  }
}
