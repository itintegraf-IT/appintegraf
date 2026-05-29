import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { escapeCsv, buildCsvResponse } from "@/lib/iml-export";
import { parseOrderExportWhere } from "@/lib/iml-order-export-where";
import {
  fetchOrdersForVariableExport,
  buildOrderExportFullRow,
  normalizeOrderExportFields,
  ordersToFlatXml,
  pickOrderExportRow,
} from "@/lib/iml-variable-order-export";

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
  const format = searchParams.get("format") || "csv";
  const customerId = searchParams.get("customer_id");
  const status = searchParams.get("status");

  const where: Prisma.iml_ordersWhereInput = {};
  if (customerId) where.customer_id = parseInt(customerId, 10);
  if (status) where.status = status;

  const orders = await prisma.iml_orders.findMany({
    where,
    orderBy: { order_date: "desc" },
    include: {
      iml_customers: { select: { name: true } },
      iml_order_items: {
        include: { iml_products: { select: { ig_code: true, client_name: true } } },
      },
    },
  });

  type OrderRow = (typeof orders)[number];
  type OrderItemRow = OrderRow["iml_order_items"][number];
  const rows = orders.map((o: OrderRow) => ({
    id: o.id,
    order_number: o.order_number ?? "",
    customer_name: o.iml_customers?.name ?? "",
    order_date: o.order_date ? new Date(o.order_date).toISOString().slice(0, 10) : "",
    expected_ship_date: o.expected_ship_date
      ? new Date(o.expected_ship_date).toISOString().slice(0, 10)
      : "",
    status: o.status ?? "",
    total: o.total?.toString() ?? "",
    notes: o.notes ?? "",
    items_count: o.iml_order_items.length,
    items_summary: o.iml_order_items
      .map((i: OrderItemRow) => `${i.iml_products?.ig_code ?? i.iml_products?.client_name ?? "?"}: ${i.quantity}`)
      .join("; "),
    created_at: o.created_at ? new Date(o.created_at).toISOString().slice(0, 10) : "",
    updated_at: o.updated_at ? new Date(o.updated_at).toISOString().slice(0, 10) : "",
  }));

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Objednávky");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="iml-objednavky.xlsx"',
      },
    });
  }

  const header =
    "id;order_number;customer_name;order_date;expected_ship_date;status;total;notes;items_count;items_summary;created_at;updated_at";
  type CsvRow = (typeof rows)[number];
  const csvRows = rows.map((r: CsvRow) =>
    [
      r.id,
      escapeCsv(r.order_number),
      escapeCsv(r.customer_name),
      escapeCsv(r.order_date),
      escapeCsv(r.expected_ship_date),
      escapeCsv(r.status),
      escapeCsv(r.total),
      escapeCsv(r.notes),
      r.items_count,
      escapeCsv(r.items_summary),
      escapeCsv(r.created_at),
      escapeCsv(r.updated_at),
    ].join(";")
  );
  const csv = [header, ...csvRows].join("\n");
  return buildCsvResponse(csv, "iml-objednavky.csv");
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k modulu IML" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Neplatné JSON tělo" }, { status: 400 });
  }

  const format = typeof body.format === "string" ? body.format : "csv";
  if (!["csv", "xlsx", "xml"].includes(format)) {
    return NextResponse.json({ error: "Nepodporovaný formát (csv, xlsx, xml)" }, { status: 400 });
  }

  const fieldsParsed = normalizeOrderExportFields(body.fields);
  if ("error" in fieldsParsed) {
    return NextResponse.json({ error: fieldsParsed.error }, { status: 400 });
  }
  const fields = fieldsParsed;

  const whereParsed = parseOrderExportWhere(body);
  if ("error" in whereParsed) {
    return NextResponse.json({ error: whereParsed.error }, { status: 400 });
  }
  const where = whereParsed;

  const orders = await fetchOrdersForVariableExport(where);
  if (body.order_id != null && String(body.order_id).trim() !== "" && orders.length === 0) {
    return NextResponse.json({ error: "Objednávka nenalezena" }, { status: 404 });
  }

  const fullRows = orders.map(buildOrderExportFullRow);

  if (format === "xml") {
    const xml = ordersToFlatXml(fullRows, fields);
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": 'attachment; filename="iml-objednavky.xml"',
      },
    });
  }

  const picked = fullRows.map((row) => pickOrderExportRow(row, fields));

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(picked);
    XLSX.utils.book_append_sheet(wb, ws, "Objednávky");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="iml-objednavky-vyber.xlsx"',
      },
    });
  }

  const header = fields.join(";");
  const csvRows = picked.map((r) => fields.map((f) => escapeCsv(r[f] ?? "")).join(";"));
  const csv = [header, ...csvRows].join("\n");
  return buildCsvResponse(csv, "iml-objednavky-vyber.csv");
}
