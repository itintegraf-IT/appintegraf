import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadMaterialCatalog, canWriteMaterialCatalog } from "@/lib/materialy/access";
import { isMaterialCategoryCode } from "@/lib/materialy/categories";
import { logMaterialyAudit } from "@/lib/materialy/audit";
import { assertSubcategoryAllowed } from "@/lib/materialy/subcategory-guard";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadMaterialCatalog(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  try {
    const material = await prisma.materials.findUnique({
      where: { id },
      include: { material_subcategories: { select: { id: true, name: true } } },
    });

    if (!material) {
      return NextResponse.json({ error: "Materiál nenalezen" }, { status: 404 });
    }

    return NextResponse.json({ material });
  } catch (e) {
    console.error("materialy/[id] GET:", e);
    return NextResponse.json({ error: "Chyba při načítání materiálu" }, { status: 500 });
  }
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
  if (!(await canWriteMaterialCatalog(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.materials.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Materiál nenalezen" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const name = body.name != null ? String(body.name).trim() : existing.name;
    if (!name) return NextResponse.json({ error: "Název je povinný" }, { status: 400 });

    const category_code =
      body.category_code != null ? String(body.category_code).trim() : existing.category_code;
    if (!isMaterialCategoryCode(category_code)) {
      return NextResponse.json({ error: "Neplatná kategorie" }, { status: 400 });
    }

    const subcategory_id: number | null =
      body.subcategory_id !== undefined
        ? body.subcategory_id != null && body.subcategory_id !== ""
          ? parseInt(String(body.subcategory_id), 10)
          : null
        : existing.subcategory_id;

    const subCheck = await assertSubcategoryAllowed(
      category_code,
      subcategory_id != null && Number.isFinite(subcategory_id) ? subcategory_id : null
    );
    if (!subCheck.ok) {
      return NextResponse.json({ error: subCheck.error }, { status: subCheck.status });
    }

    const row = await prisma.materials.update({
      where: { id },
      data: {
        category_code,
        subcategory_id: Number.isFinite(subcategory_id) ? subcategory_id : null,
        name,
        code: body.code !== undefined ? (body.code ? String(body.code).trim() : null) : existing.code,
        manufacturer:
          body.manufacturer !== undefined
            ? body.manufacturer
              ? String(body.manufacturer).trim()
              : null
            : existing.manufacturer,
        supplier:
          body.supplier !== undefined
            ? body.supplier
              ? String(body.supplier).trim()
              : null
            : existing.supplier,
        description:
          body.description !== undefined
            ? body.description
              ? String(body.description).trim()
              : null
            : existing.description,
        cas_number:
          body.cas_number !== undefined
            ? body.cas_number
              ? String(body.cas_number).trim()
              : null
            : existing.cas_number,
        notes:
          body.notes !== undefined ? (body.notes ? String(body.notes).trim() : null) : existing.notes,
        is_active: body.is_active !== undefined ? !!body.is_active : existing.is_active,
        valid_until:
          body.valid_until !== undefined
            ? body.valid_until
              ? new Date(String(body.valid_until))
              : null
            : existing.valid_until,
        certificate_valid_until:
          body.certificate_valid_until !== undefined
            ? body.certificate_valid_until
              ? new Date(String(body.certificate_valid_until))
              : null
            : existing.certificate_valid_until,
      },
    });

    await logMaterialyAudit({
      userId,
      action: "update",
      tableName: "materials",
      recordId: id,
      oldValues: { name: existing.name },
      newValues: { name: row.name },
    });

    return NextResponse.json({ material: row });
  } catch (e) {
    console.error("materialy PUT:", e);
    return NextResponse.json({ error: "Chyba při ukládání" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
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

  const existing = await prisma.materials.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Materiál nenalezen" }, { status: 404 });
  }

  await prisma.materials.update({
    where: { id },
    data: { is_active: false },
  });

  await logMaterialyAudit({
    userId,
    action: "deactivate",
    tableName: "materials",
    recordId: id,
    oldValues: { name: existing.name, is_active: true },
    newValues: { is_active: false },
  });

  return NextResponse.json({ success: true });
}
