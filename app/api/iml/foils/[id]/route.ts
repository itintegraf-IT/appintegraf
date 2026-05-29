import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { findMaterialForImlLegacyId, toImlFoilShape } from "@/lib/materialy/iml-compat";
import { assertSubcategoryAllowed } from "@/lib/materialy/subcategory-guard";

const foilInclude = {
  material_subcategories: { select: { name: true } },
} as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  const row = await findMaterialForImlLegacyId("FOIL", "iml_foils", id);
  if (!row) return NextResponse.json({ error: "Fólie nenalezena" }, { status: 404 });

  const full = await prisma.materials.findUnique({
    where: { id: row.id },
    include: {
      ...foilInclude,
      _count: {
        select: {
          iml_products_foil: true,
        },
      },
    },
  });
  if (!full) return NextResponse.json({ error: "Fólie nenalezena" }, { status: 404 });

  const { _count, ...rest } = full;
  const foil = toImlFoilShape(rest);
  return NextResponse.json({
    ...foil,
    _count: { iml_products: _count.iml_products_foil },
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  const existing = await findMaterialForImlLegacyId("FOIL", "iml_foils", id);
  if (!existing) return NextResponse.json({ error: "Fólie nenalezena" }, { status: 404 });

  try {
    const body = await req.json();

    let resolvedSub = existing.subcategory_id;
    if (body.subcategory_id !== undefined) {
      if (body.subcategory_id === null || body.subcategory_id === "") {
        resolvedSub = null;
      } else {
        const parsed = parseInt(String(body.subcategory_id), 10);
        resolvedSub = Number.isFinite(parsed) ? parsed : null;
      }
    }

    const guard = await assertSubcategoryAllowed("FOIL", resolvedSub);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    let thickness_label = existing.thickness_label;
    if (body.thickness_label !== undefined) {
      thickness_label =
        body.thickness_label != null && String(body.thickness_label).trim() !== ""
          ? String(body.thickness_label).trim().slice(0, 80)
          : null;
    } else if (body.thickness !== undefined) {
      thickness_label =
        body.thickness != null && String(body.thickness).trim() !== ""
          ? String(body.thickness).trim().slice(0, 50)
          : null;
    }

    let notes = existing.notes;
    if (body.notes !== undefined) {
      notes =
        body.notes != null && String(body.notes).trim() !== "" ? String(body.notes).trim() : null;
    } else if (body.note !== undefined) {
      notes = body.note != null && String(body.note).trim() !== "" ? String(body.note).trim() : null;
    }

    const row = await prisma.materials.update({
      where: { id: existing.id },
      data: {
        name: body.name != null ? String(body.name).trim() : existing.name,
        code:
          body.code !== undefined
            ? body.code != null && String(body.code).trim() !== ""
              ? String(body.code).trim()
              : null
            : existing.code,
        thickness_label,
        notes,
        description:
          body.description !== undefined
            ? body.description != null && String(body.description).trim() !== ""
              ? String(body.description).trim()
              : null
            : existing.description,
        subcategory_id: body.subcategory_id !== undefined ? resolvedSub : undefined,
        is_active: body.is_active !== undefined ? !!body.is_active : existing.is_active,
      },
      include: foilInclude,
    });

    const foil = toImlFoilShape(row);

    await logImlAudit({
      userId,
      action: "update",
      tableName: "materials",
      recordId: row.id,
      oldValues: { code: existing.code, name: existing.name, is_active: existing.is_active },
      newValues: { code: row.code, name: row.name, is_active: row.is_active },
    });

    return NextResponse.json({ success: true, foil });
  } catch (e) {
    console.error("IML foils PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání fólie" }, { status: 500 });
  }
}

/**
 * Soft-delete: nastaví `is_active=false`.
 * Pokud je fólie navázaná na produkty, vrátí 409.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  const existing = await findMaterialForImlLegacyId("FOIL", "iml_foils", id);
  if (!existing) return NextResponse.json({ error: "Fólie nenalezena" }, { status: 404 });

  const legacyFoilId = existing.legacy_source === "iml_foils" && existing.legacy_id ? existing.legacy_id : null;

  const productLinks = await prisma.iml_products.count({
    where: {
      OR: [
        { foil_material_id: existing.id },
        ...(legacyFoilId != null ? [{ foil_id: legacyFoilId }] : []),
      ],
    },
  });

  if (productLinks > 0) {
    return NextResponse.json(
      {
        error: `Fólie je navázaná na ${productLinks} produkt(ů). Odstraňte nejprve vazby nebo ji deaktivujte.`,
        field: "is_active",
      },
      { status: 409 }
    );
  }

  await prisma.materials.update({ where: { id: existing.id }, data: { is_active: false } });

  await logImlAudit({
    userId,
    action: "delete",
    tableName: "materials",
    recordId: existing.id,
    oldValues: { code: existing.code, name: existing.name, is_active: existing.is_active },
  });

  return NextResponse.json({ success: true });
}
