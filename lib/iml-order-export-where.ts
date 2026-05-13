import type { Prisma } from "@prisma/client";

/** Sestaví Prisma where pro POST export objednávek z těla požadavku. */
export function parseOrderExportWhere(
  body: Record<string, unknown>
): Prisma.iml_ordersWhereInput | { error: string } {
  if (body.order_id != null && String(body.order_id).trim() !== "") {
    const id = parseInt(String(body.order_id), 10);
    if (Number.isNaN(id) || id < 1) return { error: "Neplatné ID objednávky" };
    return { id };
  }

  const where: Prisma.iml_ordersWhereInput = {};

  if (body.customer_id != null && String(body.customer_id).trim() !== "") {
    const cid = parseInt(String(body.customer_id), 10);
    if (Number.isNaN(cid)) return { error: "Neplatné ID zákazníka" };
    where.customer_id = cid;
  }

  if (body.status != null && String(body.status).trim() !== "") {
    where.status = String(body.status).trim();
  }

  const from = body.order_date_from;
  const to = body.order_date_to;
  const dateFilter: Prisma.DateTimeFilter = {};
  if (typeof from === "string" && from.trim()) {
    const d = new Date(`${from.trim()}T00:00:00`);
    if (!Number.isNaN(d.getTime())) dateFilter.gte = d;
  }
  if (typeof to === "string" && to.trim()) {
    const d = new Date(`${to.trim()}T23:59:59.999`);
    if (!Number.isNaN(d.getTime())) dateFilter.lte = d;
  }
  if (Object.keys(dateFilter).length > 0) {
    where.order_date = dateFilter;
  }

  return where;
}
