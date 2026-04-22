import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";

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

  const foil = await prisma.iml_foils.findUnique({
    where: { id },
    include: { _count: { select: { iml_products: true } } },
  });
  if (!foil) return NextResponse.json({ error: "Fólie nenalezena" }, { status: 404 });

  return NextResponse.json(foil);
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

  const existing = await prisma.iml_foils.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Fólie nenalezena" }, { status: 404 });

  try {
    const body = await req.json();
    const { code, name, thickness = null, note = null, is_active } = body;

    const codeClean = typeof code === "string" ? code.trim() : "";
    const nameClean = typeof name === "string" ? name.trim() : "";
    if (!codeClean) {
      return NextResponse.json({ error: "Vyplňte kód fólie", field: "code" }, { status: 400 });
    }
    if (!nameClean) {
      return NextResponse.json({ error: "Vyplňte název fólie", field: "name" }, { status: 400 });
    }

    if (codeClean !== existing.code) {
      const dup = await prisma.iml_foils.findUnique({ where: { code: codeClean } });
      if (dup) {
        return NextResponse.json(
          { error: "Fólie s tímto kódem již existuje", field: "code" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.iml_foils.update({
      where: { id },
      data: {
        code: codeClean,
        name: nameClean,
        thickness: thickness ? String(thickness).trim() : null,
        note: note ? String(note).trim() : null,
        is_active: typeof is_active === "boolean" ? is_active : existing.is_active,
      },
    });

    await logImlAudit({
      userId,
      action: "update",
      tableName: "iml_foils",
      recordId: id,
      oldValues: {
        code: existing.code,
        name: existing.name,
        is_active: existing.is_active,
      },
      newValues: {
        code: updated.code,
        name: updated.name,
        is_active: updated.is_active,
      },
    });

    return NextResponse.json({ success: true, foil: updated });
  } catch (e) {
    console.error("IML foils PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání fólie" }, { status: 500 });
  }
}

/**
 * Soft-delete: nastaví `is_active=false`.
 * Pokud je fólie navázaná na aktivní produkty, vrátí 409 s počtem odkazů –
 * nechce se nám smazat číselník, který je aktivně používaný.
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

  const existing = await prisma.iml_foils.findUnique({
    where: { id },
    include: { _count: { select: { iml_products: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Fólie nenalezena" }, { status: 404 });

  if (existing._count.iml_products > 0) {
    return NextResponse.json(
      {
        error: `Fólie je navázaná na ${existing._count.iml_products} produkt(ů). Odstraňte nejprve vazby nebo ji deaktivujte.`,
        field: "is_active",
      },
      { status: 409 }
    );
  }

  await prisma.iml_foils.update({
    where: { id },
    data: { is_active: false },
  });

  await logImlAudit({
    userId,
    action: "delete",
    tableName: "iml_foils",
    recordId: id,
    oldValues: { code: existing.code, name: existing.name, is_active: existing.is_active },
  });

  return NextResponse.json({ success: true });
}
