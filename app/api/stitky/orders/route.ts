import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadStitky, canWriteStitkyOrder } from "@/lib/stitky/access";
import { logStitkyAudit } from "@/lib/stitky/audit";
import { stitkyOrderInclude, upsertLabelRows } from "@/lib/stitky/order-utils";
import {
  activeRowsOnly,
  normalizeRowsFromForm,
  type LabelRowInput,
  validateOrderInput,
} from "@/lib/stitky/validators/order";

export const dynamic = "force-dynamic";

function parseBody(body: unknown): {
  orderNumber: string;
  templateKey: string;
  notes: string | null;
  rows: LabelRowInput[];
} | null {
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
      };
    })
  );
  return {
    orderNumber: String(b.orderNumber ?? "").trim(),
    templateKey: String(b.templateKey ?? "").trim(),
    notes: b.notes != null ? String(b.notes).trim() || null : null,
    rows,
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadStitky(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const where = status ? { status } : {};

  const orders = await prisma.stitky_orders.findMany({
    where,
    orderBy: { updated_at: "desc" },
    take: 200,
    include: {
      template: { select: { key: true, layout_status: true } },
      users_creator: { select: { first_name: true, last_name: true, username: true } },
      rows: { select: { id: true, row_index: true, quantity: true } },
    },
  });

  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteStitkyOrder(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění zadávat zakázky" }, { status: 403 });
  }

  try {
    const parsed = parseBody(await req.json());
    if (!parsed) {
      return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
    }

    const errors = validateOrderInput(parsed);
    if (errors.length > 0) {
      return NextResponse.json({ error: "Validace selhala", errors }, { status: 400 });
    }

    const existing = await prisma.stitky_orders.findUnique({
      where: { order_number: parsed.orderNumber },
    });
    if (existing) {
      return NextResponse.json({ error: "Zakázka s tímto číslem již existuje" }, { status: 409 });
    }

    const order = await prisma.stitky_orders.create({
      data: {
        order_number: parsed.orderNumber,
        template_key: parsed.templateKey,
        notes: parsed.notes,
        status: "DRAFT",
        created_by: userId,
        last_changed_by: userId,
      },
    });

    await upsertLabelRows(order.id, parsed.rows);

    await logStitkyAudit({
      userId,
      orderId: order.id,
      action: "CREATED",
      detail: { orderNumber: parsed.orderNumber, rows: activeRowsOnly(parsed.rows).length },
    });

    const full = await prisma.stitky_orders.findUnique({
      where: { id: order.id },
      include: stitkyOrderInclude,
    });

    return NextResponse.json({ order: full }, { status: 201 });
  } catch (e) {
    console.error("POST /api/stitky/orders", e);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
