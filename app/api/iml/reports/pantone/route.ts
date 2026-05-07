import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { escapeCsv, buildCsvResponse } from "@/lib/iml-export";
import { consumptionKg } from "@/lib/iml-color-consumption";
import { normalizePantoneCode } from "@/lib/iml-pantone";

type DetailRow = {
  order_id: number;
  order_number: string;
  order_status: string | null;
  pantone_code: string;
  pantone_name: string | null;
  product_id: number;
  product_label: string;
  customer_name: string;
  pieces: number;
  labels_per_sheet: number | null;
  coverage_pct: number;
  consumption_kg: number | null;
  missing_labels_per_sheet: boolean;
};

function aggregateRows(
  details: DetailRow[],
  groupBy: "product" | "customer" | "pantone_only"
): DetailRow[] {
  type Acc = {
    key: string;
    order_id: number;
    order_number: string;
    order_status: string | null;
    pantone_code: string;
    pantone_name: string | null;
    product_id: number;
    product_label: string;
    customer_name: string;
    pieces: number;
    labels_per_sheet: number | null;
    coverage_pct: number;
    consumption_kg: number;
    missing_labels_per_sheet: boolean;
    _kgParts: number[];
  };

  const map = new Map<string, Acc>();

  for (const r of details) {
    const key =
      groupBy === "pantone_only"
        ? r.pantone_code
        : groupBy === "customer"
          ? `${r.customer_name}\0${r.product_id}\0${r.pantone_code}`
          : `${r.product_id}\0${r.pantone_code}`;

    const existing = map.get(key);
    const kg = r.consumption_kg;
    if (!existing) {
      map.set(key, {
        key,
        order_id: r.order_id,
        order_number: groupBy === "pantone_only" ? "—" : r.order_number,
        order_status: r.order_status,
        pantone_code: r.pantone_code,
        pantone_name: r.pantone_name,
        product_id: r.product_id,
        product_label: r.product_label,
        customer_name: groupBy === "pantone_only" ? "—" : r.customer_name,
        pieces: r.pieces,
        labels_per_sheet: r.labels_per_sheet,
        coverage_pct: r.coverage_pct,
        consumption_kg: kg ?? 0,
        missing_labels_per_sheet: r.missing_labels_per_sheet,
        _kgParts: kg != null && !r.missing_labels_per_sheet ? [kg] : [],
      });
    } else {
      existing.pieces += r.pieces;
      if (kg != null && !r.missing_labels_per_sheet) {
        existing._kgParts.push(kg);
      }
      if (r.missing_labels_per_sheet) existing.missing_labels_per_sheet = true;
      if (
        existing.labels_per_sheet !== r.labels_per_sheet &&
        r.labels_per_sheet != null
      ) {
        existing.labels_per_sheet = r.labels_per_sheet;
      }
    }
  }

  return [...map.values()].map((a) => {
    const sumKg = a._kgParts.reduce((s, x) => s + x, 0);
    const rounded = Math.round(sumKg * 10000) / 10000;
    return {
      order_id: a.order_id,
      order_number: a.order_number,
      order_status: a.order_status,
      pantone_code: a.pantone_code,
      pantone_name: a.pantone_name,
      product_id: a.product_id,
      product_label: a.product_label,
      customer_name: a.customer_name,
      pieces: a.pieces,
      labels_per_sheet: a.labels_per_sheet,
      coverage_pct: a.coverage_pct,
      consumption_kg: a.missing_labels_per_sheet ? null : rounded || null,
      missing_labels_per_sheet: a.missing_labels_per_sheet,
    };
  });
}

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
  const format = searchParams.get("format") || "json";
  const codesCsv = searchParams.get("codes")?.trim() ?? "";
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const statusesStr =
    searchParams.get("statuses")?.trim() || "nová,potvrzená,odeslaná";
  const groupBy = (searchParams.get("group_by") || "product") as
    | "product"
    | "customer"
    | "pantone_only";

  const toDate = toStr ? new Date(toStr) : new Date();
  const fromDate = fromStr
    ? new Date(fromStr)
    : new Date(toDate.getFullYear(), toDate.getMonth() - 12, toDate.getDate());

  const statuses = statusesStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const codeSet =
    codesCsv.length > 0
      ? new Set(
          codesCsv
            .split(",")
            .map((c) => normalizePantoneCode(c.trim()))
            .filter(Boolean)
        )
      : null;

  const orders = await prisma.iml_orders.findMany({
    where: {
      order_date: { gte: fromDate, lte: toDate },
      status: { in: statuses },
    },
    orderBy: { order_date: "desc" },
    take: 500,
    include: {
      iml_customers: { select: { name: true } },
      iml_order_items: {
        include: {
          iml_products: {
            include: {
              iml_product_colors: {
                include: { iml_pantone_colors: true },
              },
            },
          },
        },
      },
    },
  });

  const detailRows: DetailRow[] = [];

  for (const order of orders) {
    const customerName = order.iml_customers?.name ?? "";
    for (const item of order.iml_order_items) {
      const product = item.iml_products;
      const pieces = item.quantity;
      const labelsPerSheet = product.labels_per_sheet;
      const missingLabels =
        labelsPerSheet == null || !Number.isFinite(Number(labelsPerSheet)) || Number(labelsPerSheet) <= 0;
      const productLabel =
        product.client_name ?? product.ig_short_name ?? product.ig_code ?? `#${product.id}`;

      for (const pc of product.iml_product_colors) {
        const pantone = pc.iml_pantone_colors;
        if (!pantone?.is_active) continue;
        const codeNorm = normalizePantoneCode(pantone.code);
        if (codeSet && !codeSet.has(codeNorm)) continue;

        const coverage = Number(pc.coverage_pct);
        const kg = consumptionKg(
          pieces,
          missingLabels ? null : Number(labelsPerSheet),
          coverage
        );

        detailRows.push({
          order_id: order.id,
          order_number: order.order_number,
          order_status: order.status,
          pantone_code: pantone.code,
          pantone_name: pantone.name,
          product_id: product.id,
          product_label: productLabel,
          customer_name: customerName,
          pieces,
          labels_per_sheet: labelsPerSheet,
          coverage_pct: coverage,
          consumption_kg: kg,
          missing_labels_per_sheet: missingLabels,
        });
      }
    }
  }

  const rows =
    groupBy === "product"
      ? detailRows
      : aggregateRows(detailRows, groupBy);

  const sumKg = rows.reduce((s, r) => {
    if (r.missing_labels_per_sheet || r.consumption_kg == null) return s;
    return s + r.consumption_kg;
  }, 0);
  const incompleteCount = rows.filter((r) => r.missing_labels_per_sheet).length;

  if (format === "csv") {
    const header =
      "order_number;pantone_code;product_label;customer_name;pieces;labels_per_sheet;coverage_pct;consumption_kg;missing_labels_per_sheet";
    const csvLines = rows.map((r) =>
      [
        escapeCsv(r.order_number),
        escapeCsv(r.pantone_code),
        escapeCsv(r.product_label),
        escapeCsv(r.customer_name),
        r.pieces,
        r.labels_per_sheet ?? "",
        r.coverage_pct,
        r.consumption_kg ?? "",
        r.missing_labels_per_sheet ? "1" : "0",
      ].join(";")
    );
    const csv = [header, ...csvLines].join("\n");
    return buildCsvResponse(csv, "iml-report-pantone.csv");
  }

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    const sheetRows = rows.map((r) => ({
      order_number: r.order_number,
      pantone_code: r.pantone_code,
      pantone_name: r.pantone_name ?? "",
      product_label: r.product_label,
      customer_name: r.customer_name,
      pieces: r.pieces,
      labels_per_sheet: r.labels_per_sheet ?? "",
      coverage_pct: r.coverage_pct,
      consumption_kg: r.consumption_kg ?? "",
      missing_labels_per_sheet: r.missing_labels_per_sheet,
    }));
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    XLSX.utils.book_append_sheet(wb, ws, "Pantone");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="iml-report-pantone.xlsx"',
      },
    });
  }

  return NextResponse.json({
    rows,
    summary: {
      total_kg: Math.round(sumKg * 10000) / 10000,
      incomplete_row_count: incompleteCount,
      row_count: rows.length,
    },
    filters: {
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
      statuses,
      group_by: groupBy,
    },
  });
}
