import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";
import { enrichProductMaterialFields } from "@/lib/iml/product-materials";
import {
  parseProductFormatToMm,
  syncProductFormatFromMm,
} from "@/lib/iml/product-format";
import { IML_LABEL_TYPES } from "@/lib/iml-constants";

export type ColumnMapping = Record<string, number>;

export type ParsedCsvFromZip = {
  headers: string[];
  dataRows: string[][];
  csvRelativePath: string;
};

export type ProductImportRowPayload = {
  rowIndex: number;
  igCode: string;
  clientName: string;
  sku: string | null;
  customerId: number | null;
  data: Prisma.iml_productsUncheckedCreateInput;
};

export type ConflictResolution = "import" | "overwrite" | "skip";

export type ImportResolutions = {
  default: ConflictResolution;
  byCode: Record<string, ConflictResolution>;
};

const IML_EXPORT_MERGE_HEADERS = ["note", "material", "treatment", "realization"] as const;

const AUTO_MAP: Record<string, string> = {
  code: "ig_code",
  name: "client_name",
  contractor: "customer_name",
  print: "print_note",
  type: "label_shape_code",
};

export function autoMapHeaders(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  headers.forEach((h, i) => {
    const key = h.trim().toLowerCase();
    const target = AUTO_MAP[key];
    if (target && mapping[target] === undefined) {
      mapping[target] = i;
    }
  });
  return mapping;
}

export function validateMapping(mapping: ColumnMapping | null): string | null {
  if (!mapping) return "Chybí mapování sloupců";
  const hasIgCode = typeof mapping.ig_code === "number";
  const hasClientName = typeof mapping.client_name === "number";
  const hasIgShortName = typeof mapping.ig_short_name === "number";
  if (!hasIgCode && !hasClientName && !hasIgShortName) {
    return "Mapování musí obsahovat alespoň pole ig_code, client_name nebo ig_short_name";
  }
  return null;
}

export function detectCsvDelimiter(firstLine: string): string {
  const semi = (firstLine.match(/;/g) || []).length;
  const comma = (firstLine.match(/,/g) || []).length;
  return semi > comma ? ";" : ",";
}

export function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        current += c;
      }
    } else if (c === delimiter) {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

/** Record-oriented CSV parser (podporuje víceřádková quoted pole). */
export function parseCsvRecords(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(current.trim());
      current = "";
    } else if (c === "\r") {
      continue;
    } else if (c === "\n") {
      row.push(current.trim());
      current = "";
      if (row.some((cell) => cell.trim())) {
        rows.push(row);
      }
      row = [];
    } else {
      current += c;
    }
  }

  row.push(current.trim());
  if (row.some((cell) => cell.trim())) {
    rows.push(row);
  }

  return rows;
}

export function parseCsvText(text: string): { headers: string[]; dataRows: string[][] } {
  const normalized = text.replace(/^\uFEFF/, "");
  if (!normalized.trim()) {
    return { headers: [], dataRows: [] };
  }

  const firstLineEnd = normalized.search(/\r?\n/);
  const firstLine = firstLineEnd === -1 ? normalized : normalized.slice(0, firstLineEnd);
  const delimiter = detectCsvDelimiter(firstLine);
  const allRows = parseCsvRecords(normalized, delimiter);

  if (allRows.length === 0) {
    return { headers: [], dataRows: [] };
  }

  const headers = allRows[0].map((h, i) => (h ? String(h) : `Sloupec ${i + 1}`));
  const dataRows = allRows
    .slice(1)
    .filter((r) => r.some((c) => c != null && String(c).trim()));
  return { headers, dataRows };
}

export function parseExcelBuffer(buf: Buffer): { headers: string[]; dataRows: string[][] } {
  const wb = XLSX.read(buf, { type: "buffer" });
  const firstSheet = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheet];
  const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" });
  const matrix = data as string[][];
  if (matrix.length === 0) return { headers: [], dataRows: [] };
  const headers = matrix[0].map((h, i) => (h ? String(h) : `Sloupec ${i + 1}`));
  const dataRows = matrix
    .slice(1)
    .filter((r) => r.some((c) => c != null && String(c).trim()));
  return { headers, dataRows };
}

export function normalizeCustomerNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\u00b4\u2018\u2019\u201a\u201b\u2032\u2035`']/g, "'")
    .replace(/\s+/g, " ");
}

export function buildCustomerByNameMap(
  customers: Array<{ id: number; name: string }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of customers) {
    map.set(normalizeCustomerNameKey(c.name), c.id);
  }
  return map;
}

export function normalizeProductCode(code: string): string {
  return code.trim().toUpperCase();
}

export function rowGetter(row: string[], mapping: ColumnMapping) {
  return (field: string) => {
    const idx = mapping[field];
    return idx != null && row[idx] != null ? String(row[idx]).trim() : "";
  };
}

export function getImlExportColumnValue(
  row: string[],
  headers: string[] | undefined,
  columnName: string
): string {
  if (!headers) return "";
  const idx = headers.findIndex((h) => h.trim().toLowerCase() === columnName);
  if (idx < 0 || row[idx] == null) return "";
  return String(row[idx]).trim();
}

export function mergeImlExportProductionNotes(
  row: string[],
  headers: string[] | undefined,
  explicitNotes: string
): string | null {
  const parts: string[] = [];
  if (explicitNotes.trim()) parts.push(explicitNotes.trim());

  if (headers) {
    for (const key of IML_EXPORT_MERGE_HEADERS) {
      const val = getImlExportColumnValue(row, headers, key);
      if (val) parts.push(val);
    }
  }

  if (parts.length === 0) return null;
  return parts.join(" · ");
}

export function imlExportNoteHeuristics(noteText: string): {
  hasPrintSample: boolean;
  hasPrintProof: boolean;
} {
  const lower = noteText.toLowerCase();
  return {
    hasPrintProof: /n[aá]tisk|natisk/.test(lower),
    hasPrintSample: /vzork/.test(lower),
  };
}

export async function buildProductPayload(
  row: string[],
  rowIndex: number,
  mapping: ColumnMapping,
  customerByName: Map<string, number>,
  editorName: string,
  headers?: string[]
): Promise<{ ok: true; payload: ProductImportRowPayload } | { ok: false; error: string }> {
  const get = rowGetter(row, mapping);
  const igCode = normalizeProductCode(get("ig_code"));
  const clientName = get("client_name") || get("ig_short_name");
  const hasIgCodeMapping = typeof mapping.ig_code === "number";

  if (hasIgCodeMapping && !igCode) {
    return { ok: false, error: `Řádek ${rowIndex + 2}: Chybí ig_code` };
  }
  if (!igCode && !clientName) {
    return { ok: false, error: `Řádek ${rowIndex + 2}: Chybí ig_code nebo client_name` };
  }

  const skuRaw = get("sku");
  const sku = skuRaw || null;

  const customerName = get("customer_name");
  let customerId: number | null = null;
  if (customerName) {
    customerId = customerByName.get(normalizeCustomerNameKey(customerName)) ?? null;
  }

  let materialFields: Awaited<ReturnType<typeof enrichProductMaterialFields>>;
  try {
    materialFields = await enrichProductMaterialFields({
      foil_material_id: get("foil_material_id") || undefined,
      color_material_id: get("color_material_id") || undefined,
      paper_material_id: get("paper_material_id") || undefined,
      lacquer_material_id: get("lacquer_material_id") || undefined,
      foil_type: get("foil_type") || undefined,
      color_coverage: get("color_coverage") || undefined,
    });
  } catch (e) {
    return {
      ok: false,
      error: `Řádek ${rowIndex + 2}: ${e instanceof Error ? e.message : "Neplatný materiál"}`,
    };
  }

  const parseMm = (key: string) => {
    const raw = get(key);
    if (!raw) return null;
    const n = parseFloat(raw.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
  };
  let formatWidthMm = parseMm("format_width_mm");
  let formatHeightMm = parseMm("format_height_mm");
  const manualFormat = get("product_format") || null;
  if (formatWidthMm == null && formatHeightMm == null && manualFormat) {
    const parsed = parseProductFormatToMm(manualFormat);
    if (parsed) {
      formatWidthMm = parsed.width;
      formatHeightMm = parsed.height;
    }
  }
  const productFormat = syncProductFormatFromMm(formatWidthMm, formatHeightMm, manualFormat);

  const colorCountRaw = get("color_count");
  let colorCount: number | null = null;
  if (colorCountRaw) {
    const n = parseInt(colorCountRaw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 8) colorCount = n;
  }

  const labelTypeRaw = get("label_type").trim().toLowerCase();
  const validLabelTypes = new Set(IML_LABEL_TYPES.map((t) => t.value));
  const labelType = validLabelTypes.has(labelTypeRaw as (typeof IML_LABEL_TYPES)[number]["value"])
    ? labelTypeRaw
    : null;

  const approvalDateRaw = get("approval_date");
  let approvalDate: Date | null = null;
  if (approvalDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(approvalDateRaw)) {
    const d = new Date(`${approvalDateRaw}T00:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) approvalDate = d;
  }

  const noteColumnText = getImlExportColumnValue(row, headers, "note");
  const printColumnText = getImlExportColumnValue(row, headers, "print");
  const noteHeuristics = imlExportNoteHeuristics(`${noteColumnText} ${printColumnText}`);
  const explicitPrintSample =
    get("has_print_sample").toLowerCase() === "ano" || get("has_print_sample") === "1";
  const explicitPrintProof =
    get("has_print_proof").toLowerCase() === "ano" || get("has_print_proof") === "1";

  const productionNotes = mergeImlExportProductionNotes(
    row,
    headers,
    get("production_notes")
  );

  const data: Prisma.iml_productsUncheckedCreateInput = {
    customer_id: customerId,
    ig_code: igCode ? normalizeProductCode(igCode) : null,
    ig_short_name: get("ig_short_name") || null,
    client_code: get("client_code") || null,
    client_name: clientName || null,
    requester: get("requester") || null,
    label_shape_code: get("label_shape_code") || null,
    product_format: productFormat,
    format_width_mm: formatWidthMm,
    format_height_mm: formatHeightMm,
    die_cut_tool_code: get("die_cut_tool_code") || null,
    assembly_code: get("assembly_code") || null,
    positions_on_sheet: get("positions_on_sheet")
      ? parseInt(get("positions_on_sheet"), 10) || null
      : null,
    pieces_per_box: get("pieces_per_box") ? parseInt(get("pieces_per_box"), 10) || null : null,
    pieces_per_pallet: get("pieces_per_pallet")
      ? parseInt(get("pieces_per_pallet"), 10) || null
      : null,
    foil_type: materialFields.foil_type,
    foil_material_id: materialFields.foil_material_id,
    color_coverage: materialFields.color_coverage,
    color_material_id: materialFields.color_material_id,
    paper_material_id: materialFields.paper_material_id,
    lacquer_material_id: materialFields.lacquer_material_id,
    print_note: get("print_note") || null,
    has_print_sample: explicitPrintSample || noteHeuristics.hasPrintSample,
    has_print_proof: explicitPrintProof || noteHeuristics.hasPrintProof,
    ean_code: get("ean_code") || null,
    production_notes: productionNotes,
    approval_status: get("approval_status") || null,
    approval_date: approvalDate,
    color_count: colorCount,
    print_colors_text: get("print_colors_text") || null,
    label_type: labelType,
    item_status: get("item_status") || null,
    sku,
    last_edited_by: editorName,
    is_active: true,
  };

  return {
    ok: true,
    payload: {
      rowIndex,
      igCode,
      clientName,
      sku,
      customerId,
      data,
    },
  };
}

export function resolveRowAction(
  igCode: string,
  isConflict: boolean,
  resolutions: ImportResolutions
): ConflictResolution {
  if (!isConflict) return "import";
  const code = normalizeProductCode(igCode);
  return resolutions.byCode[code] ?? resolutions.default;
}
