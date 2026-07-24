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
  const productKind = searchParams.get("product_kind")?.trim() ?? "";

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { ig_code: { contains: search } },
      { ig_short_name: { contains: search } },
      { client_code: { contains: search } },
      { client_name: { contains: search } },
      { sku: { contains: search } },
      { product_format: { contains: search } },
      { label_shape_code: { contains: search } },
      { die_cut_tool_code: { contains: search } },
      { assembly_code: { contains: search } },
      { color_coverage: { contains: search } },
      { print_colors_text: { contains: search } },
      { foil_type: { contains: search } },
      { ean_code: { contains: search } },
      { requester: { contains: search } },
    ];
  }
  if (customerId) where.customer_id = parseInt(customerId, 10);
  if (status) where.item_status = status;
  if (productKind === "iml" || productKind === "etikety") where.product_kind = productKind;

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
    product_kind: p.product_kind ?? "iml",
    customer_name: p.iml_customers?.name ?? "",
    requester: p.requester ?? "",
    label_shape_code: p.label_shape_code ?? "",
    product_format: p.product_format ?? "",
    format_width_mm: p.format_width_mm != null ? String(p.format_width_mm) : "",
    format_height_mm: p.format_height_mm != null ? String(p.format_height_mm) : "",
    die_cut_tool_code: p.die_cut_tool_code ?? "",
    assembly_code: p.assembly_code ?? "",
    positions_on_sheet: p.positions_on_sheet ?? "",
    pieces_per_box: p.pieces_per_box ?? "",
    pieces_per_pallet: p.pieces_per_pallet ?? "",
    foil_type: p.foil_type ?? "",
    foil_material_id: p.foil_material_id ?? "",
    color_coverage: p.color_coverage ?? "",
    color_material_id: p.color_material_id ?? "",
    paper_material_id: p.paper_material_id ?? "",
    lacquer_material_id: p.lacquer_material_id ?? "",
    ean_code: p.ean_code ?? "",
    item_status: p.item_status ?? "",
    approval_status: p.approval_status ?? "",
    approval_date: p.approval_date
      ? new Date(p.approval_date).toISOString().slice(0, 10)
      : "",
    color_count: p.color_count ?? "",
    print_colors_text: p.print_colors_text ?? "",
    label_type: p.label_type ?? "",
    has_print_sample: p.has_print_sample ? "ano" : "ne",
    has_print_proof: p.has_print_proof ? "ano" : "ne",
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

  const header =
    "id;ig_code;ig_short_name;client_code;client_name;sku;product_kind;customer_name;requester;label_shape_code;product_format;format_width_mm;format_height_mm;die_cut_tool_code;assembly_code;positions_on_sheet;pieces_per_box;pieces_per_pallet;foil_type;foil_material_id;color_coverage;color_material_id;paper_material_id;lacquer_material_id;ean_code;item_status;approval_status;approval_date;color_count;print_colors_text;label_type;has_print_sample;has_print_proof;is_active;created_at;updated_at";
  type CsvRow = (typeof rows)[number];
  const csvRows = rows.map((r: CsvRow) =>
    [
      r.id,
      escapeCsv(r.ig_code),
      escapeCsv(r.ig_short_name),
      escapeCsv(r.client_code),
      escapeCsv(r.client_name),
      escapeCsv(r.sku),
      escapeCsv(r.product_kind),
      escapeCsv(r.customer_name),
      escapeCsv(r.requester),
      escapeCsv(r.label_shape_code),
      escapeCsv(r.product_format),
      r.format_width_mm,
      r.format_height_mm,
      escapeCsv(r.die_cut_tool_code),
      escapeCsv(r.assembly_code),
      r.positions_on_sheet,
      r.pieces_per_box,
      r.pieces_per_pallet,
      escapeCsv(r.foil_type),
      r.foil_material_id,
      escapeCsv(r.color_coverage),
      r.color_material_id,
      r.paper_material_id,
      r.lacquer_material_id,
      escapeCsv(r.ean_code),
      escapeCsv(r.item_status),
      escapeCsv(r.approval_status),
      escapeCsv(r.approval_date),
      r.color_count,
      escapeCsv(r.print_colors_text),
      escapeCsv(r.label_type),
      escapeCsv(r.has_print_sample),
      escapeCsv(r.has_print_proof),
      escapeCsv(r.is_active),
      escapeCsv(r.created_at),
      escapeCsv(r.updated_at),
    ].join(";")
  );
  const csv = [header, ...csvRows].join("\n");
  return buildCsvResponse(csv, "iml-produkty.csv");
}
