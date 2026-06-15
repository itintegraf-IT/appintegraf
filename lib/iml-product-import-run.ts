import { prisma } from "@/lib/db";
import { logImlAudit } from "@/lib/iml-audit";
import {
  buildProductPayload,
  normalizeProductCode,
  resolveRowAction,
  type ColumnMapping,
  type ConflictResolution,
  type ImportResolutions,
} from "@/lib/iml-product-import-parse";
import {
  buildCodeToProductIdMap,
  importFilesFromExtractedDir,
} from "@/lib/iml-product-import-files";
import type { LightPreviewParsed } from "@/lib/iml-product-import-upload";
import {
  findCsvInExtractedDir,
  summarizeFileIndex,
  type ClassifiedZipFile,
  walkMediaFiles,
} from "@/lib/iml-product-import-zip";

export type PreviewConflict = {
  rowIndex: number;
  igCode: string;
  csvName: string;
  existing: {
    id: number;
    ig_code: string | null;
    client_name: string | null;
    customer_id: number | null;
  };
};

export type ImportPreviewResult = {
  headers: string[];
  csvRelativePath: string;
  rowCount: number;
  previewRows: string[][];
  conflicts: PreviewConflict[];
  newCount: number;
  fileIndex: ReturnType<typeof summarizeFileIndex>;
};

export type ImportExecuteResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  totalErrors: number;
  files: {
    printAttached: number;
    previewAttached: number;
    skippedNoProduct: number;
    errors: string[];
  };
};

type PreviewCoreInput = {
  headers: string[];
  dataRows: string[][];
  csvRelativePath: string;
  mediaFiles: ClassifiedZipFile[];
};

export async function runProductImportPreviewCore(
  parsed: PreviewCoreInput,
  mapping: ColumnMapping
): Promise<ImportPreviewResult> {
  const { headers, dataRows, csvRelativePath, mediaFiles } = parsed;

    const codesFromCsv = new Set<string>();
    const conflicts: PreviewConflict[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const built = await buildProductPayload(
        dataRows[i],
        i,
        mapping,
        new Map(),
        ""
      );
      if (!built.ok) continue;
      const code = normalizeProductCode(built.payload.igCode);
      if (code) codesFromCsv.add(code);
    }

    const existingProducts = await prisma.iml_products.findMany({
      where: { ig_code: { not: null } },
      select: {
        id: true,
        ig_code: true,
        client_name: true,
        customer_id: true,
      },
    });

    const existingByCode = new Map<string, (typeof existingProducts)[0]>();
    for (const p of existingProducts) {
      if (p.ig_code) existingByCode.set(normalizeProductCode(p.ig_code), p);
    }

    for (let i = 0; i < dataRows.length; i++) {
      const built = await buildProductPayload(
        dataRows[i],
        i,
        mapping,
        new Map(),
        ""
      );
      if (!built.ok) continue;
      const code = normalizeProductCode(built.payload.igCode);
      if (!code) continue;
      const ex = existingByCode.get(code);
      if (ex) {
        conflicts.push({
          rowIndex: i,
          igCode: code,
          csvName: built.payload.clientName,
          existing: ex,
        });
      }
    }

    const allCodes = new Set([...codesFromCsv]);
    for (const f of mediaFiles) {
      if (f.productCode) allCodes.add(f.productCode);
    }

    const fileIndex = summarizeFileIndex(mediaFiles, allCodes);

    return {
      headers,
      csvRelativePath,
      rowCount: dataRows.length,
      previewRows: dataRows.slice(0, 20),
      conflicts,
      newCount: dataRows.length - conflicts.length,
      fileIndex,
    };
}

export async function runProductImportPreviewOnDir(
  tempDir: string,
  mapping: ColumnMapping
): Promise<ImportPreviewResult> {
  const { headers, dataRows, csvRelativePath } = await findCsvInExtractedDir(tempDir);
  const mediaFiles = await walkMediaFiles(tempDir);
  return runProductImportPreviewCore(
    { headers, dataRows, csvRelativePath, mediaFiles },
    mapping
  );
}

export async function runProductImportPreviewLight(
  parsed: LightPreviewParsed,
  mapping: ColumnMapping
): Promise<ImportPreviewResult> {
  return runProductImportPreviewCore(parsed, mapping);
}

export async function runProductImportExecuteOnDir(
  tempDir: string,
  mapping: ColumnMapping,
  resolutions: ImportResolutions,
  userId: number,
  editorName: string
): Promise<ImportExecuteResult> {
  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const { dataRows } = await findCsvInExtractedDir(tempDir);

  const customers = await prisma.iml_customers.findMany({
    select: { id: true, name: true },
  });
  const customerByName = new Map(
    customers.map((c) => [c.name.toLowerCase(), c.id])
  );

  const existingAll = await prisma.iml_products.findMany({
      select: { id: true, ig_code: true, sku: true },
    });
    const existingByCode = new Map<string, number>();
    const existingBySku = new Map<string, number>();
    for (const p of existingAll) {
      if (p.ig_code) existingByCode.set(normalizeProductCode(p.ig_code), p.id);
      if (p.sku) existingBySku.set(p.sku, p.id);
    }

    const codeToProductId = new Map<string, number>();

    for (let i = 0; i < dataRows.length; i++) {
      const built = await buildProductPayload(
        dataRows[i],
        i,
        mapping,
        customerByName,
        editorName
      );
      if (!built.ok) {
        errors.push(built.error);
        continue;
      }

      const { igCode, sku, data } = built.payload;
      const codeKey = igCode ? normalizeProductCode(igCode) : "";
      const existingId = codeKey ? existingByCode.get(codeKey) : undefined;
      const isConflict = Boolean(existingId);

      const action: ConflictResolution = resolveRowAction(
        codeKey || `row-${i}`,
        isConflict,
        resolutions
      );

      if (isConflict && action === "skip") {
        skipped++;
        if (codeKey && existingId) codeToProductId.set(codeKey, existingId);
        continue;
      }

      if (sku && !existingId) {
        const skuExists = existingBySku.get(sku);
        if (skuExists) {
          errors.push(`Řádek ${i + 2}: Produkt se SKU ${sku} již existuje`);
          continue;
        }
      }

      if (isConflict && action === "overwrite" && existingId) {
        try {
          const { sku: _s, ...updateData } = data;
          await prisma.iml_products.update({
            where: { id: existingId },
            data: {
              ...updateData,
              sku: sku ?? undefined,
            },
          });
          await logImlAudit({
            userId,
            action: "update",
            tableName: "iml_products",
            recordId: existingId,
            newValues: { ig_code: data.ig_code, client_name: data.client_name, import: true },
          });
          if (codeKey) codeToProductId.set(codeKey, existingId);
          existingByCode.set(codeKey, existingId);
          if (sku) existingBySku.set(sku, existingId);
          updated++;
        } catch (e) {
          errors.push(
            `Řádek ${i + 2}: ${e instanceof Error ? e.message : "Chyba při přepsání"}`
          );
        }
        continue;
      }

      if (!isConflict) {
        try {
          const product = await prisma.iml_products.create({ data });
          await logImlAudit({
            userId,
            action: "create",
            tableName: "iml_products",
            recordId: product.id,
            newValues: { ig_code: product.ig_code, client_name: product.client_name },
          });
          if (codeKey) {
            codeToProductId.set(codeKey, product.id);
            existingByCode.set(codeKey, product.id);
          }
          if (sku) existingBySku.set(sku, product.id);
          created++;
        } catch (e) {
          errors.push(
            `Řádek ${i + 2}: ${e instanceof Error ? e.message : "Chyba při vytvoření"}`
          );
        }
      }
    }

    const allProducts = await prisma.iml_products.findMany({
      select: { id: true, ig_code: true },
    });
    const fullCodeMap = buildCodeToProductIdMap(allProducts);
    for (const [k, v] of codeToProductId) fullCodeMap.set(k, v);

    const mediaFiles = await walkMediaFiles(tempDir);
    const filesResult = await importFilesFromExtractedDir(
      tempDir,
      mediaFiles,
      fullCodeMap,
      userId
    );

    return {
      created,
      updated,
      skipped,
      errors: errors.slice(0, 50),
      totalErrors: errors.length,
      files: {
        printAttached: filesResult.printAttached,
        previewAttached: filesResult.previewAttached,
        skippedNoProduct: filesResult.skippedNoProduct,
        errors: filesResult.errors.slice(0, 50),
      },
    };
}
