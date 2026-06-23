import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadStitky, canWriteStitkyOrder, canDeleteStitkyOrder } from "@/lib/stitky/access";
import { logStitkyAudit } from "@/lib/stitky/audit";
import { stitkyOrderInclude, upsertLabelRows } from "@/lib/stitky/order-utils";
import {
  normalizeRowsFromForm,
  type LabelRowInput,
  validateOrderInput,
} from "@/lib/stitky/validators/order";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return Number.isNaN(n) ? null : n;
}

function parseBody(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const rowsRaw = Array.isArray(b.rows) ? b.rows : [];
  const rows = normalizeRowsFromForm(
    rowsRaw.map((r, i) => {
      const row = r as Record<string, unknown>;
      return {
        rowIndex: Number(row.rowIndex ?? i + 1),
        quantity: row.quantity != null && row.quantity !== "" ? Number(row.quantity) : null,
        packSize: row.packSize != null && row.packSize !== "" ? Number(row.packSize) : null,
        text1: row.text1 != null ? String(row.text1) : null,
        text2: row.text2 != null ? String(row.text2) : null,
        text3: row.text3 != null ? String(row.text3) : null,
        prefix: row.prefix != null ? String(row.prefix) : null,
        rangeFrom: row.rangeFrom != null ? String(row.rangeFrom) : null,
        rangeTo: row.rangeTo != null ? String(row.rangeTo) : null,
        barcodeType: row.barcodeType != null ? String(row.barcodeType) : null,
      } satisfies LabelRowInput;
    })
  );
  return {
    orderNumber: b.orderNumber != null ? String(b.orderNumber).trim() : undefined,
    templateKey: b.templateKey != null ? String(b.templateKey).trim() : undefined,
    notes: b.notes !== undefined ? String(b.notes ?? "").trim() || null : undefined,
    rows: b.rows !== undefined ? rows : undefined,
    status: b.status != null ? String(b.status) : undefined,
  };
}

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadStitky(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const orderId = parseId((await ctx.params).id);
  if (orderId == null) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const order = await prisma.stitky_orders.findUnique({
    where: { id: orderId },
    include: stitkyOrderInclude,
  });
  if (!order) {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }

  return NextResponse.json({ order });
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteStitkyOrder(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const orderId = parseId((await ctx.params).id);
  if (orderId == null) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.stitky_orders.findUnique({
    where: { id: orderId },
    include: { rows: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }

  if (existing.status === "DONE") {
    return NextResponse.json({ error: "Hotovou zakázku nelze upravovat" }, { status: 400 });
  }

  try {
    const patch = parseBody(await req.json());
    if (!patch) {
      return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
    }

    const orderNumber = patch.orderNumber ?? existing.order_number;
    const templateKey = patch.templateKey ?? existing.template_key;
    const notes = patch.notes !== undefined ? patch.notes : existing.notes;
    const rows =
      patch.rows ??
      existing.rows.map((r) => ({
        rowIndex: r.row_index,
        quantity: r.quantity,
        packSize: r.pack_size,
        text1: r.text1,
        text2: r.text2,
        text3: r.text3,
        prefix: r.prefix,
        rangeFrom: r.range_from,
        rangeTo: r.range_to,
        barcodeType: r.barcode_type,
      }));

    const errors = validateOrderInput({ orderNumber, templateKey, notes, rows });
    if (errors.length > 0) {
      return NextResponse.json({ error: "Validace selhala", errors }, { status: 400 });
    }

    if (orderNumber !== existing.order_number) {
      const dup = await prisma.stitky_orders.findUnique({ where: { order_number: orderNumber } });
      if (dup) {
        return NextResponse.json({ error: "Zakázka s tímto číslem již existuje" }, { status: 409 });
      }
    }

    await prisma.stitky_orders.update({
      where: { id: orderId },
      data: {
        order_number: orderNumber,
        template_key: templateKey,
        notes,
        last_changed_by: userId,
        ...(patch.status ? { status: patch.status } : {}),
      },
    });

    if (patch.rows) {
      await upsertLabelRows(orderId, rows);
    }

    await logStitkyAudit({ userId, orderId, action: "UPDATED" });

    const full = await prisma.stitky_orders.findUnique({
      where: { id: orderId },
      include: stitkyOrderInclude,
    });

    return NextResponse.json({ order: full });
  } catch (e) {
    console.error("PATCH /api/stitky/orders/[id]", e);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadStitky(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const orderId = parseId((await ctx.params).id);
  if (orderId == null) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.stitky_orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      order_number: true,
      status: true,
      created_by: true,
      template_key: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }

  if (existing.status === "DONE") {
    return NextResponse.json({ error: "Hotovou zakázku nelze smazat" }, { status: 400 });
  }

  if (!(await canDeleteStitkyOrder(userId, existing))) {
    return NextResponse.json({ error: "Nemáte oprávnění smazat zakázku" }, { status: 403 });
  }

  try {
    await logStitkyAudit({
      userId,
      orderId,
      action: "DELETED",
      detail: {
        order_number: existing.order_number,
        status: existing.status,
        template_key: existing.template_key,
      },
    });

    await prisma.stitky_orders.delete({ where: { id: orderId } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/stitky/orders/[id]", e);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
