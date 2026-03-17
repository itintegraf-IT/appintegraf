import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { escapeCsv, buildCsvResponse } from "@/lib/iml-export";

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

  const where: Record<string, unknown> = {};
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

  const rows = orders.map((o) => ({
    id: o.id,
    order_number: o.order_number ?? "",
    customer_name: o.iml_customers?.name ?? "",
    order_date: o.order_date ? new Date(o.order_date).toISOString().slice(0, 10) : "",
    status: o.status ?? "",
    total: o.total?.toString() ?? "",
    notes: o.notes ?? "",
    items_count: o.iml_order_items.length,
    items_summary: o.iml_order_items
      .map((i) => `${i.iml_products?.ig_code ?? i.iml_products?.client_name ?? "?"}: ${i.quantity}`)
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

  const header = "id;order_number;customer_name;order_date;status;total;notes;items_count;items_summary;created_at;updated_at";
  const csvRows = rows.map((r) =>
    [
      r.id,
      escapeCsv(r.order_number),
      escapeCsv(r.customer_name),
      escapeCsv(r.order_date),
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
