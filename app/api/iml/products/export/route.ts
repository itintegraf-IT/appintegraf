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
  const search = searchParams.get("search")?.trim() ?? "";
  const customerId = searchParams.get("customer_id");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { ig_code: { contains: search } },
      { ig_short_name: { contains: search } },
      { client_code: { contains: search } },
      { client_name: { contains: search } },
      { sku: { contains: search } },
    ];
  }
  if (customerId) where.customer_id = parseInt(customerId, 10);
  if (status) where.item_status = status;

  const products = await prisma.iml_products.findMany({
    where,
    orderBy: { id: "desc" },
    include: { iml_customers: { select: { name: true } } },
  });

  type ProductRow = (typeof products)[number];
  const rows = products.map((p: ProductRow) => ({
    id: p.id,
    ig_code: p.ig_code ?? "",
    ig_short_name: p.ig_short_name ?? "",
    client_code: p.client_code ?? "",
    client_name: p.client_name ?? "",
    sku: p.sku ?? "",
    customer_name: p.iml_customers?.name ?? "",
    requester: p.requester ?? "",
    label_shape_code: p.label_shape_code ?? "",
    product_format: p.product_format ?? "",
    die_cut_tool_code: p.die_cut_tool_code ?? "",
    assembly_code: p.assembly_code ?? "",
    positions_on_sheet: p.positions_on_sheet ?? "",
    pieces_per_box: p.pieces_per_box ?? "",
    pieces_per_pallet: p.pieces_per_pallet ?? "",
    foil_type: p.foil_type ?? "",
    color_coverage: p.color_coverage ?? "",
    ean_code: p.ean_code ?? "",
    item_status: p.item_status ?? "",
    approval_status: p.approval_status ?? "",
    has_print_sample: p.has_print_sample ? "ano" : "ne",
    is_active: p.is_active ? "ano" : "ne",
    created_at: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "",
    updated_at: p.updated_at ? new Date(p.updated_at).toISOString().slice(0, 10) : "",
  }));

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Produkty");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="iml-produkty.xlsx"',
      },
    });
  }

  const header = "id;ig_code;ig_short_name;client_code;client_name;sku;customer_name;requester;label_shape_code;product_format;die_cut_tool_code;assembly_code;positions_on_sheet;pieces_per_box;pieces_per_pallet;foil_type;color_coverage;ean_code;item_status;approval_status;has_print_sample;is_active;created_at;updated_at";
  type CsvRow = (typeof rows)[number];
  const csvRows = rows.map((r: CsvRow) =>
    [
      r.id,
      escapeCsv(r.ig_code),
      escapeCsv(r.ig_short_name),
      escapeCsv(r.client_code),
      escapeCsv(r.client_name),
      escapeCsv(r.sku),
      escapeCsv(r.customer_name),
      escapeCsv(r.requester),
      escapeCsv(r.label_shape_code),
      escapeCsv(r.product_format),
      escapeCsv(r.die_cut_tool_code),
      escapeCsv(r.assembly_code),
      r.positions_on_sheet,
      r.pieces_per_box,
      r.pieces_per_pallet,
      escapeCsv(r.foil_type),
      escapeCsv(r.color_coverage),
      escapeCsv(r.ean_code),
      escapeCsv(r.item_status),
      escapeCsv(r.approval_status),
      escapeCsv(r.has_print_sample),
      escapeCsv(r.is_active),
      escapeCsv(r.created_at),
      escapeCsv(r.updated_at),
    ].join(";")
  );
  const csv = [header, ...csvRows].join("\n");
  return buildCsvResponse(csv, "iml-produkty.csv");
}
