import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
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
  const row = await findMaterialForImlLegacyId("FOIL", "iml_foils", id);
  if (!row) return NextResponse.json({ error: "Fólie nenalezena" }, { status: 404 });

  const full = await prisma.materials.findUnique({
    where: { id: row.id },
    include: foilInclude,
  });
  if (!full) return NextResponse.json({ error: "Fólie nenalezena" }, { status: 404 });

  return NextResponse.json({ foil: toImlFoilShape(full) });
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
  const existing = await findMaterialForImlLegacyId("FOIL", "iml_foils", id);
  if (!existing) return NextResponse.json({ error: "Fólie nenalezena" }, { status: 404 });

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
      thickness_label:
        body.thickness_label !== undefined
          ? body.thickness_label != null && String(body.thickness_label).trim() !== ""
            ? String(body.thickness_label).trim().slice(0, 80)
            : null
          : existing.thickness_label,
      notes:
        body.notes !== undefined
          ? body.notes != null && String(body.notes).trim() !== ""
            ? String(body.notes).trim()
            : null
          : existing.notes,
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

  return NextResponse.json({ foil: toImlFoilShape(row) });
}

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
  const existing = await findMaterialForImlLegacyId("FOIL", "iml_foils", id);
  if (!existing) return NextResponse.json({ error: "Fólie nenalezena" }, { status: 404 });

  await prisma.materials.update({ where: { id: existing.id }, data: { is_active: false } });
  return NextResponse.json({ success: true });
}
