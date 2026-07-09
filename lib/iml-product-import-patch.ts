import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logImlAudit } from "@/lib/iml-audit";
import { enrichProductMaterialFields } from "@/lib/iml/product-materials";
import {
  parseProductFormatToMm,
  syncProductFormatFromMm,
} from "@/lib/iml/product-format";
import { IML_LABEL_TYPES } from "@/lib/iml-constants";
import { toImlProductUpdateData } from "@/lib/iml/product-prisma-payload";
import {
  buildCustomerByNameMap,
  normalizeCustomerNameKey,
  normalizeProductCode,
  rowGetter,
  type ColumnMapping,
} from "@/lib/iml-product-import-parse";

export type ProductPatchScalars = Partial<
  Omit<
    Prisma.iml_productsUncheckedUpdateInput,
    | "id"
    | "created_at"
    | "updated_at"
    | "customer_id"
    | "foil_material_id"
    | "color_material_id"
    | "paper_material_id"
    | "lacquer_material_id"
  >
> & {
  customer_id?: number | null;
  foil_material_id?: number | null;
  color_material_id?: number | null;
  paper_material_id?: number | null;
  lacquer_material_id?: number | null;
};

export type ProductPatchRow = {
  igCode: string;
  patch: ProductPatchScalars;
};

function isMapped(mapping: ColumnMapping, field: string): boolean {
  return typeof mapping[field] === "number";
}

export async function buildProductPatchPayload(
  row: string[],
  mapping: ColumnMapping,
  customerByName: Map<string, number>,
  headers?: string[]
): Promise<{ ok: true; result: ProductPatchRow } | { ok: false; error: string }> {
  const get = rowGetter(row, mapping);
  const igCodeRaw = get("ig_code");
  if (!igCodeRaw) {
    return { ok: false, error: "Chybí ig_code" };
  }
  const igCode = normalizeProductCode(igCodeRaw);
  const patch: ProductPatchScalars = {};

  if (isMapped(mapping, "ig_short_name") && get("ig_short_name")) {
    patch.ig_short_name = get("ig_short_name");
  }
  if (isMapped(mapping, "client_code") && get("client_code")) {
    patch.client_code = get("client_code");
  }
  if (isMapped(mapping, "client_name") && get("client_name")) {
    patch.client_name = get("client_name");
  }
  if (isMapped(mapping, "requester") && get("requester")) {
    patch.requester = get("requester");
  }
  if (isMapped(mapping, "label_shape_code") && get("label_shape_code")) {
    patch.label_shape_code = get("label_shape_code");
  }
  if (isMapped(mapping, "die_cut_tool_code") && get("die_cut_tool_code")) {
    patch.die_cut_tool_code = get("die_cut_tool_code");
  }
  if (isMapped(mapping, "assembly_code") && get("assembly_code")) {
    patch.assembly_code = get("assembly_code");
  }
  if (isMapped(mapping, "print_note") && get("print_note")) {
    patch.print_note = get("print_note");
  }
  if (isMapped(mapping, "ean_code") && get("ean_code")) {
    patch.ean_code = get("ean_code");
  }
  if (isMapped(mapping, "production_notes") && get("production_notes")) {
    patch.production_notes = get("production_notes");
  }
  if (isMapped(mapping, "item_status") && get("item_status")) {
    patch.item_status = get("item_status");
  }
  if (isMapped(mapping, "approval_status") && get("approval_status")) {
    patch.approval_status = get("approval_status");
  }
  if (isMapped(mapping, "print_colors_text") && get("print_colors_text")) {
    patch.print_colors_text = get("print_colors_text");
  }
  if (isMapped(mapping, "sku") && get("sku")) {
    patch.sku = get("sku");
  }

  if (isMapped(mapping, "customer_name")) {
    const customerName = get("customer_name");
    if (customerName) {
      const customerId = customerByName.get(normalizeCustomerNameKey(customerName)) ?? null;
      if (customerId == null) {
        return { ok: false, error: `Neznámý zákazník: ${customerName}` };
      }
      patch.customer_id = customerId;
    }
  }

  const parseIntField = (field: string) => {
    if (!isMapped(mapping, field)) return;
    const raw = get(field);
    if (!raw) return;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) {
      (patch as Record<string, unknown>)[field] = n;
    }
  };
  parseIntField("positions_on_sheet");
  parseIntField("pieces_per_box");
  parseIntField("pieces_per_pallet");

  if (isMapped(mapping, "color_count")) {
    const raw = get("color_count");
    if (raw) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n >= 1 && n <= 8) patch.color_count = n;
    }
  }

  if (isMapped(mapping, "label_type")) {
    const labelTypeRaw = get("label_type").trim().toLowerCase();
    if (labelTypeRaw) {
      const validLabelTypes = new Set(IML_LABEL_TYPES.map((t) => t.value));
      if (validLabelTypes.has(labelTypeRaw as (typeof IML_LABEL_TYPES)[number]["value"])) {
        patch.label_type = labelTypeRaw;
      }
    }
  }

  if (isMapped(mapping, "approval_date")) {
    const approvalDateRaw = get("approval_date");
    if (approvalDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(approvalDateRaw)) {
      const d = new Date(`${approvalDateRaw}T00:00:00.000Z`);
      if (!Number.isNaN(d.getTime())) patch.approval_date = d;
    }
  }

  if (isMapped(mapping, "has_print_sample")) {
    const raw = get("has_print_sample");
    if (raw) {
      patch.has_print_sample =
        raw.toLowerCase() === "ano" || raw === "1" || raw.toLowerCase() === "true";
    }
  }
  if (isMapped(mapping, "has_print_proof")) {
    const raw = get("has_print_proof");
    if (raw) {
      patch.has_print_proof =
        raw.toLowerCase() === "ano" || raw === "1" || raw.toLowerCase() === "true";
    }
  }

  const parseMm = (key: string) => {
    if (!isMapped(mapping, key)) return null;
    const raw = get(key);
    if (!raw) return null;
    const n = parseFloat(raw.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
  };

  const formatMapped =
    isMapped(mapping, "format_width_mm") ||
    isMapped(mapping, "format_height_mm") ||
    isMapped(mapping, "product_format");

  if (formatMapped) {
    let formatWidthMm = parseMm("format_width_mm");
    let formatHeightMm = parseMm("format_height_mm");
    const manualFormat = isMapped(mapping, "product_format") ? get("product_format") : "";
    if (formatWidthMm == null && formatHeightMm == null && manualFormat) {
      const parsed = parseProductFormatToMm(manualFormat);
      if (parsed) {
        formatWidthMm = parsed.width;
        formatHeightMm = parsed.height;
      }
    }
    if (isMapped(mapping, "format_width_mm") && formatWidthMm != null) {
      patch.format_width_mm = formatWidthMm;
    }
    if (isMapped(mapping, "format_height_mm") && formatHeightMm != null) {
      patch.format_height_mm = formatHeightMm;
    }
    if (isMapped(mapping, "product_format")) {
      const synced = syncProductFormatFromMm(formatWidthMm, formatHeightMm, manualFormat || null);
      if (synced) patch.product_format = synced;
    }
  }

  const materialMapped =
    isMapped(mapping, "foil_material_id") ||
    isMapped(mapping, "color_material_id") ||
    isMapped(mapping, "paper_material_id") ||
    isMapped(mapping, "lacquer_material_id") ||
    isMapped(mapping, "foil_type") ||
    isMapped(mapping, "color_coverage");

  if (materialMapped) {
    const materialInput: Parameters<typeof enrichProductMaterialFields>[0] = {};
    if (isMapped(mapping, "foil_material_id") && get("foil_material_id")) {
      materialInput.foil_material_id = get("foil_material_id");
    }
    if (isMapped(mapping, "color_material_id") && get("color_material_id")) {
      materialInput.color_material_id = get("color_material_id");
    }
    if (isMapped(mapping, "paper_material_id") && get("paper_material_id")) {
      materialInput.paper_material_id = get("paper_material_id");
    }
    if (isMapped(mapping, "lacquer_material_id") && get("lacquer_material_id")) {
      materialInput.lacquer_material_id = get("lacquer_material_id");
    }
    if (isMapped(mapping, "foil_type") && get("foil_type")) {
      materialInput.foil_type = get("foil_type");
    }
    if (isMapped(mapping, "color_coverage") && get("color_coverage")) {
      materialInput.color_coverage = get("color_coverage");
    }

    if (Object.keys(materialInput).length > 0) {
      try {
        const materialFields = await enrichProductMaterialFields(materialInput);
        if (materialFields.foil_type != null) patch.foil_type = materialFields.foil_type;
        if (materialFields.foil_material_id != null) {
          patch.foil_material_id = materialFields.foil_material_id;
        }
        if (materialFields.color_coverage != null) patch.color_coverage = materialFields.color_coverage;
        if (materialFields.color_material_id != null) {
          patch.color_material_id = materialFields.color_material_id;
        }
        if (materialFields.paper_material_id != null) {
          patch.paper_material_id = materialFields.paper_material_id;
        }
        if (materialFields.lacquer_material_id != null) {
          patch.lacquer_material_id = materialFields.lacquer_material_id;
        }
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "Neplatný materiál",
        };
      }
    }
  }

  void headers;

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Žádná pole k doplnění" };
  }

  return { ok: true, result: { igCode, patch } };
}

export type PatchImportPreview = {
  headers: string[];
  previewRows: string[][];
  rowCount: number;
  foundCount: number;
  notFoundCodes: string[];
  rowSummaries: Array<{
    rowIndex: number;
    igCode: string;
    found: boolean;
    patchFields: string[];
    error?: string;
  }>;
};

export async function runProductPatchPreview(
  headers: string[],
  dataRows: string[][],
  mapping: ColumnMapping
): Promise<PatchImportPreview> {
  const customers = await prisma.iml_customers.findMany({ select: { id: true, name: true } });
  const customerByName = buildCustomerByNameMap(customers);

  const products = await prisma.iml_products.findMany({
    where: { ig_code: { not: null } },
    select: { ig_code: true },
  });
  const existingCodes = new Set(
    products
      .map((p) => (p.ig_code ? normalizeProductCode(p.ig_code) : ""))
      .filter(Boolean)
  );

  const notFoundSet = new Set<string>();
  let foundCount = 0;
  const rowSummaries: PatchImportPreview["rowSummaries"] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const get = rowGetter(row, mapping);
    const igCodeRaw = get("ig_code");
    if (!igCodeRaw) {
      rowSummaries.push({
        rowIndex: i,
        igCode: "",
        found: false,
        patchFields: [],
        error: "Chybí ig_code",
      });
      continue;
    }
    const igCode = normalizeProductCode(igCodeRaw);
    const found = existingCodes.has(igCode);
    if (!found) {
      notFoundSet.add(igCode);
      rowSummaries.push({ rowIndex: i, igCode, found: false, patchFields: [] });
      continue;
    }

    const built = await buildProductPatchPayload(row, mapping, customerByName, headers);
    if (!built.ok) {
      rowSummaries.push({
        rowIndex: i,
        igCode,
        found: true,
        patchFields: [],
        error: built.error,
      });
      continue;
    }

    foundCount++;
    rowSummaries.push({
      rowIndex: i,
      igCode,
      found: true,
      patchFields: Object.keys(built.result.patch),
    });
  }

  return {
    headers,
    previewRows: dataRows.slice(0, 10),
    rowCount: dataRows.length,
    foundCount,
    notFoundCodes: [...notFoundSet].sort(),
    rowSummaries: rowSummaries.slice(0, 50),
  };
}

export type PatchImportResult = {
  updated: number;
  skipped: number;
  notFound: string[];
  errors: string[];
  totalErrors: number;
};

export async function runProductPatchImport(
  dataRows: string[][],
  mapping: ColumnMapping,
  userId: number,
  editorName: string
): Promise<PatchImportResult> {
  const customers = await prisma.iml_customers.findMany({ select: { id: true, name: true } });
  const customerByName = buildCustomerByNameMap(customers);

  const products = await prisma.iml_products.findMany({
    where: { ig_code: { not: null } },
    select: {
      id: true,
      ig_code: true,
      customer_id: true,
      foil_material_id: true,
      color_material_id: true,
      paper_material_id: true,
      lacquer_material_id: true,
    },
  });

  const codeToProduct = new Map(
    products
      .filter((p) => p.ig_code)
      .map((p) => [normalizeProductCode(p.ig_code!), p])
  );

  let updated = 0;
  let skipped = 0;
  const notFoundSet = new Set<string>();
  const errors: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const built = await buildProductPatchPayload(row, mapping, customerByName);
    if (!built.ok) {
      const get = rowGetter(row, mapping);
      if (!get("ig_code")) {
        skipped++;
        continue;
      }
      errors.push(`Řádek ${i + 2}: ${built.error}`);
      continue;
    }

    const { igCode, patch } = built.result;
    const existing = codeToProduct.get(igCode);
    if (!existing) {
      notFoundSet.add(igCode);
      skipped++;
      continue;
    }

    try {
      const updateData = toImlProductUpdateData(
        { ...patch, last_edited_by: editorName } as Parameters<typeof toImlProductUpdateData>[0],
        {
          customer_id: existing.customer_id,
          foil_material_id: existing.foil_material_id,
          color_material_id: existing.color_material_id,
          paper_material_id: existing.paper_material_id,
          lacquer_material_id: existing.lacquer_material_id,
        }
      );

      await prisma.iml_products.update({
        where: { id: existing.id },
        data: updateData,
      });

      await logImlAudit({
        userId,
        action: "update",
        tableName: "iml_products",
        recordId: existing.id,
        newValues: { ig_code: igCode, import: "patch", fields: Object.keys(patch) },
      });
      updated++;
    } catch (e) {
      errors.push(
        `Řádek ${i + 2}: ${e instanceof Error ? e.message : "Chyba při aktualizaci"}`
      );
    }
  }

  return {
    updated,
    skipped,
    notFound: [...notFoundSet].sort(),
    errors: errors.slice(0, 50),
    totalErrors: errors.length,
  };
}
