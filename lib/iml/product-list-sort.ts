/**
 * Whitelist řazení seznamu IML produktů (API + UI).
 */

import type { Prisma } from "@prisma/client";
import type { ProductListColumnId } from "@/lib/iml/product-list-columns";

export type ProductListSortDir = "asc" | "desc";

/** Mapování UI sloupce → Prisma orderBy (bez směru). */
const SORT_FIELD_MAP: Partial<
  Record<ProductListColumnId | "id" | "format", Prisma.iml_productsOrderByWithRelationInput[]>
> = {
  id: [{ id: "asc" }],
  ig_code: [{ ig_code: "asc" }],
  name: [{ client_name: "asc" }],
  customer: [{ iml_customers: { name: "asc" } }],
  product_kind: [{ product_kind: "asc" }],
  status: [{ item_status: "asc" }],
  sku: [{ sku: "asc" }],
  client_code: [{ client_code: "asc" }],
  ig_short_name: [{ ig_short_name: "asc" }],
  requester: [{ requester: "asc" }],
  ean_code: [{ ean_code: "asc" }],
  die_cut_tool_code: [{ die_cut_tool_code: "asc" }],
  label_shape_code: [{ label_shape_code: "asc" }],
  assembly_code: [{ assembly_code: "asc" }],
  positions_on_sheet: [{ positions_on_sheet: "asc" }],
  labels_per_sheet: [{ labels_per_sheet: "asc" }],
  format: [{ format_width_mm: "asc" }, { format_height_mm: "asc" }],
  print_colors_text: [{ print_colors_text: "asc" }],
  color_count: [{ color_count: "asc" }],
  color_coverage: [{ color_coverage: "asc" }],
  foil: [{ iml_foils: { name: "asc" } }],
  stock_quantity: [{ stock_quantity: "asc" }],
  approval_status: [{ approval_status: "asc" }],
  approval_date: [{ approval_date: "asc" }],
  updated_at: [{ updated_at: "asc" }],
};

export const PRODUCT_LIST_SORTABLE_COLUMN_IDS = Object.keys(SORT_FIELD_MAP) as Array<
  keyof typeof SORT_FIELD_MAP
>;

export function isProductListSortableColumn(
  id: string
): id is ProductListColumnId | "id" | "format" {
  return id in SORT_FIELD_MAP;
}

function applyDir(
  clauses: Prisma.iml_productsOrderByWithRelationInput[],
  dir: ProductListSortDir
): Prisma.iml_productsOrderByWithRelationInput[] {
  return clauses.map((clause) => {
    const out: Prisma.iml_productsOrderByWithRelationInput = {};
    for (const [key, value] of Object.entries(clause)) {
      if (value && typeof value === "object" && !Array.isArray(value) && "name" in value) {
        (out as Record<string, unknown>)[key] = { name: dir };
      } else {
        (out as Record<string, unknown>)[key] = dir;
      }
    }
    return out;
  });
}

/**
 * Sestaví Prisma orderBy ze query `sort` + `dir`.
 * Legacy: sort=format | format_desc (bez dir).
 * Default: id desc.
 */
export function buildProductListOrderBy(
  sortParam: string,
  dirParam?: string | null
): Prisma.iml_productsOrderByWithRelationInput[] {
  const legacy = sortParam.trim();
  if (legacy === "format_desc") {
    return [
      { format_width_mm: "desc" },
      { format_height_mm: "desc" },
      { id: "desc" },
    ];
  }
  if (legacy === "format" && !dirParam) {
    return [
      { format_width_mm: "asc" },
      { format_height_mm: "asc" },
      { id: "desc" },
    ];
  }

  const sortKey = legacy || "";
  const dir: ProductListSortDir = dirParam === "asc" ? "asc" : dirParam === "desc" ? "desc" : "desc";

  if (sortKey && isProductListSortableColumn(sortKey)) {
    const base = SORT_FIELD_MAP[sortKey];
    if (base) {
      const ordered = applyDir(base, dir);
      // Stabilní sekundární klíč
      if (!ordered.some((o) => "id" in o)) {
        ordered.push({ id: "desc" });
      }
      return ordered;
    }
  }

  return [{ id: "desc" }];
}
