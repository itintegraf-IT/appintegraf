import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k modulu IML" }, { status: 403 });
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

  const foils = await prisma.iml_foils.findMany({
    where,
    orderBy: [{ is_active: "desc" }, { code: "asc" }],
    take: 500,
  });

  return NextResponse.json({ foils });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám IML" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      code,
      name,
      thickness = null,
      note = null,
      is_active = true,
    } = body;

    const codeClean = typeof code === "string" ? code.trim() : "";
    const nameClean = typeof name === "string" ? name.trim() : "";
    if (!codeClean) {
      return NextResponse.json({ error: "Vyplňte kód fólie", field: "code" }, { status: 400 });
    }
    if (!nameClean) {
      return NextResponse.json({ error: "Vyplňte název fólie", field: "name" }, { status: 400 });
    }

    const dup = await prisma.iml_foils.findUnique({ where: { code: codeClean } });
    if (dup) {
      return NextResponse.json({ error: "Fólie s tímto kódem již existuje", field: "code" }, { status: 400 });
    }

    const foil = await prisma.iml_foils.create({
      data: {
        code: codeClean,
        name: nameClean,
        thickness: thickness ? String(thickness).trim() : null,
        note: note ? String(note).trim() : null,
        is_active: Boolean(is_active),
      },
    });

    await logImlAudit({
      userId,
      action: "create",
      tableName: "iml_foils",
      recordId: foil.id,
      newValues: { code: foil.code, name: foil.name, is_active: foil.is_active },
    });

    return NextResponse.json({ success: true, foil });
  } catch (e) {
    console.error("IML foils POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření fólie" }, { status: 500 });
  }
}
