import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { dieCutToProductFields, parseDieCutBody } from "@/lib/iml/die-cuts";

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

  const row = await prisma.iml_die_cuts.findUnique({
    where: { id },
    include: {
      _count: { select: { iml_products: true } },
      iml_customers: { select: { id: true, name: true } },
      iml_box_types: { select: { id: true, code: true, name: true } },
    },
  });
  if (!row) return NextResponse.json({ error: "Výsek nenalezen" }, { status: 404 });

  const { _count, iml_customers, iml_box_types, ...die_cut } = row;
  return NextResponse.json({
    die_cut: { ...die_cut, customer: iml_customers, box_type: iml_box_types },
    products_count: _count.iml_products,
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

  const existing = await prisma.iml_die_cuts.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Výsek nenalezen" }, { status: 404 });

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const parsed = parseDieCutBody(body);
    if ("error" in parsed) {
      return NextResponse.json(
        { error: parsed.error, field: parsed.field },
        { status: 400 }
      );
    }

    if (parsed.label_shape_code !== existing.label_shape_code) {
      const clash = await prisma.iml_die_cuts.findUnique({
        where: { label_shape_code: parsed.label_shape_code },
      });
      if (clash) {
        return NextResponse.json(
          {
            error: `Výsek s kódem tvaru „${parsed.label_shape_code}“ už existuje.`,
            field: "label_shape_code",
          },
          { status: 409 }
        );
      }
    }

    const productFields = dieCutToProductFields(parsed);

    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.iml_die_cuts.update({
        where: { id },
        data: {
          ...parsed,
          // labels_per_sheet se ve formuláři needituje — zachovat stávající hodnotu
          labels_per_sheet:
            body.labels_per_sheet !== undefined
              ? parsed.labels_per_sheet
              : existing.labels_per_sheet,
        },
      });
      // Synchronizace denormalizovaných polí na všech navázaných produktech
      await tx.iml_products.updateMany({
        where: { die_cut_id: id },
        data: {
          ...productFields,
          labels_per_sheet:
            body.labels_per_sheet !== undefined
              ? productFields.labels_per_sheet
              : existing.labels_per_sheet,
        },
      });
      return updated;
    });

    await logImlAudit({
      userId,
      action: "update",
      tableName: "iml_die_cuts",
      recordId: id,
      oldValues: existing as unknown as Record<string, unknown>,
      newValues: row as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ die_cut: row });
  } catch (e) {
    console.error("PUT /api/iml/die-cuts/[id]", e);
    return NextResponse.json({ error: "Chyba při ukládání výseku" }, { status: 500 });
  }
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
  if (Number.isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  const existing = await prisma.iml_die_cuts.findUnique({
    where: { id },
    include: { _count: { select: { iml_products: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Výsek nenalezen" }, { status: 404 });

  // Soft-delete — produkty zůstávají navázané, ale výsek zmizí z výběru
  const row = await prisma.iml_die_cuts.update({
    where: { id },
    data: { is_active: false },
  });

  await logImlAudit({
    userId,
    action: "delete",
    tableName: "iml_die_cuts",
    recordId: id,
    oldValues: existing as unknown as Record<string, unknown>,
    newValues: row as unknown as Record<string, unknown>,
  });

  return NextResponse.json({
    die_cut: row,
    products_count: existing._count.iml_products,
  });
}
