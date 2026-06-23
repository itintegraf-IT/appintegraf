import { prisma } from "@/lib/db";
import {
  activeRowsOnly,
  normalizeRowsFromForm,
  type LabelRowInput,
  type OrderInput,
  validateOrderInput,
} from "@/lib/stitky/validators/order";
import { type StitkyOrderStatus } from "@/lib/stitky/constants";

export const stitkyOrderInclude = {
  rows: { orderBy: { row_index: "asc" as const } },
  template: true,
  users_creator: { select: { id: true, username: true, first_name: true, last_name: true } },
  users_changed: { select: { id: true, username: true, first_name: true, last_name: true } },
};

export function dbRowsToInput(
  rows: {
    row_index: number;
    quantity: number | null;
    pack_size: number | null;
    text1: string | null;
    text2: string | null;
    text3: string | null;
    prefix: string | null;
    range_from: string | null;
    range_to: string | null;
    barcode_type: string | null;
  }[]
): LabelRowInput[] {
  return normalizeRowsFromForm(
    rows.map((r) => ({
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
    }))
  );
}

export function orderToInput(order: {
  order_number: string;
  template_key: string;
  notes: string | null;
  rows: Parameters<typeof dbRowsToInput>[0];
}): OrderInput {
  return {
    orderNumber: order.order_number,
    templateKey: order.template_key,
    notes: order.notes,
    rows: dbRowsToInput(order.rows),
  };
}

export async function upsertLabelRows(orderId: number, rows: LabelRowInput[]) {
  const active = activeRowsOnly(normalizeRowsFromForm(rows));
  await prisma.stitky_label_rows.deleteMany({ where: { order_id: orderId } });
  if (active.length === 0) return;
  await prisma.stitky_label_rows.createMany({
    data: active.map((r) => ({
      order_id: orderId,
      row_index: r.rowIndex,
      quantity: r.quantity ?? null,
      pack_size: r.packSize ?? null,
      text1: r.text1?.trim() || null,
      text2: r.text2?.trim() || null,
      text3: r.text3?.trim() || null,
      prefix: r.prefix?.trim() || null,
      range_from: r.rangeFrom?.trim() || null,
      range_to: r.rangeTo?.trim() || null,
      barcode_type: r.barcodeType?.trim() || null,
    })),
  });
}

export async function updateOrderStatus(
  orderId: number,
  userId: number,
  status: StitkyOrderStatus
) {
  return prisma.stitky_orders.update({
    where: { id: orderId },
    data: { status, last_changed_by: userId },
    include: stitkyOrderInclude,
  });
}

export async function assertTemplateReady(templateKey: string) {
  const t = await prisma.stitky_templates.findUnique({ where: { key: templateKey } });
  if (!t) return { ok: false as const, error: "Neznámá šablona štítku" };
  if (t.layout_status !== "ready") {
    return { ok: false as const, error: `Šablona „${templateKey}“ zatím není připravena k tisku` };
  }
  return { ok: true as const, template: t };
}
