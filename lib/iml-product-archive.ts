import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";

export const IML_ARCHIVE_INACTIVE_MONTHS = 6;
export const IML_ARCHIVE_DEFAULT_BATCH = 20;

export type ResolvedProductPdf = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  version: number | "legacy";
  source: "blob" | "archive" | "legacy_blob" | "legacy_archive";
  fileId: number | null;
};

function archiveRootDir(): string {
  const raw = process.env.IML_ARCHIVE_DIR?.trim();
  if (raw) return path.resolve(raw);
  return path.resolve(process.cwd(), "storage", "iml-archive");
}

/** Absolutní cesta k souboru v archivu; odmítne path traversal. */
export function resolveArchiveAbsolutePath(relativePath: string): string {
  const root = archiveRootDir();
  const abs = path.resolve(root, relativePath);
  const rel = path.relative(root, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Neplatná cesta archivu");
  }
  return abs;
}

export function getImlArchiveRoot(): string {
  return archiveRootDir();
}

async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function toBuffer(data: Buffer | Uint8Array | null | undefined): Buffer | null {
  if (data == null) return null;
  if (Buffer.isBuffer(data)) return data.length > 0 ? data : null;
  const buf = Buffer.from(data);
  return buf.length > 0 ? buf : null;
}

/**
 * Načte PDF produktu: hot BLOB → archive_path verze → legacy BLOB → legacy archive.
 * Volitelně aktualizuje last_accessed_at u verze ze souborů.
 */
export async function resolveProductPdfBuffer(
  productId: number,
  opts?: { version?: number | null; touchAccess?: boolean }
): Promise<ResolvedProductPdf | null> {
  const versionNum = opts?.version ?? null;

  const fileRow = versionNum
    ? await prisma.iml_product_files.findUnique({
        where: { product_id_version: { product_id: productId, version: versionNum } },
      })
    : await prisma.iml_product_files.findFirst({
        where: { product_id: productId, is_primary: true },
        orderBy: { version: "desc" },
      });

  if (fileRow) {
    const blob = toBuffer(fileRow.pdf_data);
    if (blob) {
      if (opts?.touchAccess !== false) {
        void prisma.iml_product_files
          .update({
            where: { id: fileRow.id },
            data: { last_accessed_at: new Date() },
          })
          .catch(() => {});
      }
      return {
        buffer: blob,
        filename: fileRow.filename,
        mimeType: fileRow.mime_type || "application/pdf",
        version: fileRow.version,
        source: "blob",
        fileId: fileRow.id,
      };
    }

    if (fileRow.archive_path) {
      try {
        const abs = resolveArchiveAbsolutePath(fileRow.archive_path);
        const buffer = await fs.readFile(abs);
        if (opts?.touchAccess !== false) {
          void prisma.iml_product_files
            .update({
              where: { id: fileRow.id },
              data: { last_accessed_at: new Date() },
            })
            .catch(() => {});
        }
        return {
          buffer,
          filename: fileRow.filename,
          mimeType: fileRow.mime_type || "application/pdf",
          version: fileRow.version,
          source: "archive",
          fileId: fileRow.id,
        };
      } catch (e) {
        console.error("IML archive PDF read failed:", fileRow.archive_path, e);
      }
    }
  }

  if (versionNum) return null;

  const product = await prisma.iml_products.findUnique({
    where: { id: productId },
    select: { pdf_data: true, pdf_archive_path: true },
  });
  if (!product) return null;

  const legacyBlob = toBuffer(product.pdf_data);
  if (legacyBlob) {
    return {
      buffer: legacyBlob,
      filename: "tiskova-data.pdf",
      mimeType: "application/pdf",
      version: "legacy",
      source: "legacy_blob",
      fileId: null,
    };
  }

  if (product.pdf_archive_path) {
    try {
      const abs = resolveArchiveAbsolutePath(product.pdf_archive_path);
      const buffer = await fs.readFile(abs);
      return {
        buffer,
        filename: "tiskova-data.pdf",
        mimeType: "application/pdf",
        version: "legacy",
        source: "legacy_archive",
        fileId: null,
      };
    } catch (e) {
      console.error("IML legacy archive PDF read failed:", product.pdf_archive_path, e);
    }
  }

  return null;
}

export type ArchiveProductResult = {
  productId: number;
  filesArchived: number;
  legacyArchived: boolean;
  bytesFreed: number;
  skippedReason?: string;
};

/**
 * Přesune hot BLOB PDF produktu na disk a vynuluje bloby v DB.
 * Nastaví product.archived_at.
 */
export async function archiveProductFiles(productId: number): Promise<ArchiveProductResult> {
  const product = await prisma.iml_products.findUnique({
    where: { id: productId },
    select: {
      id: true,
      archived_at: true,
      pdf_data: true,
      pdf_archive_path: true,
    },
  });
  if (!product) {
    return {
      productId,
      filesArchived: 0,
      legacyArchived: false,
      bytesFreed: 0,
      skippedReason: "not_found",
    };
  }
  if (product.archived_at) {
    return {
      productId,
      filesArchived: 0,
      legacyArchived: false,
      bytesFreed: 0,
      skippedReason: "already_archived",
    };
  }

  const files = await prisma.iml_product_files.findMany({
    where: { product_id: productId },
    orderBy: { version: "asc" },
  });

  let filesArchived = 0;
  let legacyArchived = false;
  let bytesFreed = 0;
  const now = new Date();

  for (const file of files) {
    const blob = toBuffer(file.pdf_data);
    if (!blob) continue;

    const relative = path.posix.join("products", String(productId), `v${file.version}.pdf`);
    const abs = resolveArchiveAbsolutePath(relative);
    await ensureParentDir(abs);
    await fs.writeFile(abs, blob);

    await prisma.iml_product_files.update({
      where: { id: file.id },
      data: {
        pdf_data: null,
        archive_path: relative,
        archived_at: now,
      },
    });
    filesArchived += 1;
    bytesFreed += blob.length;
  }

  const legacyBlob = toBuffer(product.pdf_data);
  if (legacyBlob && !product.pdf_archive_path) {
    const relative = path.posix.join("products", String(productId), "legacy.pdf");
    const abs = resolveArchiveAbsolutePath(relative);
    await ensureParentDir(abs);
    await fs.writeFile(abs, legacyBlob);
    await prisma.iml_products.update({
      where: { id: productId },
      data: {
        pdf_data: null,
        pdf_archive_path: relative,
      },
    });
    legacyArchived = true;
    bytesFreed += legacyBlob.length;
  }

  if (filesArchived === 0 && !legacyArchived) {
    // Žádný hot BLOB — pokud už jsou soubory jen na disku, stejně označíme produkt.
    const hasAnyPdf =
      files.some((f) => Boolean(f.archive_path)) || Boolean(product.pdf_archive_path);
    if (!hasAnyPdf) {
      return {
        productId,
        filesArchived: 0,
        legacyArchived: false,
        bytesFreed: 0,
        skippedReason: "no_hot_pdf",
      };
    }
  }

  await prisma.iml_products.update({
    where: { id: productId },
    data: { archived_at: now },
  });

  return { productId, filesArchived, legacyArchived, bytesFreed };
}

export type ReactivateProductResult = {
  productId: number;
  restoredToHot: boolean;
  filesRestored: number;
  legacyRestored: boolean;
};

/**
 * Zruší archivní příznak produktu.
 * Při restoreToHot=true zkopíruje PDF z disku zpět do BLOB (admin „hot data“).
 * Jinak soubory zůstanou na disku a API je čte přes archive_path.
 */
export async function reactivateProduct(
  productId: number,
  opts?: { restoreToHot?: boolean }
): Promise<ReactivateProductResult> {
  const restoreToHot = opts?.restoreToHot === true;
  const product = await prisma.iml_products.findUnique({
    where: { id: productId },
    select: { id: true, archived_at: true, pdf_archive_path: true, pdf_data: true },
  });
  if (!product) {
    throw new Error("Produkt nenalezen");
  }

  let filesRestored = 0;
  let legacyRestored = false;

  if (restoreToHot) {
    const files = await prisma.iml_product_files.findMany({
      where: { product_id: productId, archive_path: { not: null } },
    });

    for (const file of files) {
      if (!file.archive_path) continue;
      const existing = toBuffer(file.pdf_data);
      if (existing) continue;

      const abs = resolveArchiveAbsolutePath(file.archive_path);
      const buffer = await fs.readFile(abs);
      await prisma.iml_product_files.update({
        where: { id: file.id },
        data: {
          pdf_data: buffer,
          archived_at: null,
          // archive_path ponecháme jako zálohu; BLOB je zdroj pravdy
        },
      });
      filesRestored += 1;
    }

    const legacyExisting = toBuffer(product.pdf_data);
    if (!legacyExisting && product.pdf_archive_path) {
      const abs = resolveArchiveAbsolutePath(product.pdf_archive_path);
      const buffer = await fs.readFile(abs);
      await prisma.iml_products.update({
        where: { id: productId },
        data: { pdf_data: buffer },
      });
      legacyRestored = true;
    }
  }

  await prisma.iml_products.update({
    where: { id: productId },
    data: {
      archived_at: null,
      is_active: true,
    },
  });

  return {
    productId,
    restoredToHot: restoreToHot,
    filesRestored,
    legacyRestored,
  };
}

export type ArchiveBatchOptions = {
  dryRun?: boolean;
  limit?: number;
  inactiveMonths?: number;
};

export type ArchiveBatchResult = {
  dryRun: boolean;
  inactiveMonths: number;
  candidateIds: number[];
  processed: ArchiveProductResult[];
  totalBytesFreed: number;
};

/**
 * Najde produkty s hot PDF BLOB neaktivní ≥ N měsíců a archivuje je.
 */
export async function runImlProductArchiveBatch(
  opts?: ArchiveBatchOptions
): Promise<ArchiveBatchResult> {
  const dryRun = opts?.dryRun === true;
  const limit = Math.min(Math.max(opts?.limit ?? IML_ARCHIVE_DEFAULT_BATCH, 1), 100);
  const inactiveMonths = Math.min(
    Math.max(opts?.inactiveMonths ?? IML_ARCHIVE_INACTIVE_MONTHS, 1),
    120
  );

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - inactiveMonths);

  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT p.id
    FROM iml_products p
    WHERE p.archived_at IS NULL
      AND (
        (p.pdf_data IS NOT NULL AND OCTET_LENGTH(p.pdf_data) > 0)
        OR EXISTS (
          SELECT 1 FROM iml_product_files f
          WHERE f.product_id = p.id
            AND f.pdf_data IS NOT NULL
            AND OCTET_LENGTH(f.pdf_data) > 0
        )
      )
      AND GREATEST(
        p.updated_at,
        COALESCE(
          (SELECT MAX(oi.created_at) FROM iml_order_items oi WHERE oi.product_id = p.id),
          p.updated_at
        ),
        COALESCE(
          (SELECT MAX(f.last_accessed_at) FROM iml_product_files f WHERE f.product_id = p.id),
          p.updated_at
        )
      ) < ${cutoff}
    ORDER BY p.id ASC
    LIMIT ${limit}
  `;

  const candidateIds = rows.map((r) => Number(r.id));
  const processed: ArchiveProductResult[] = [];
  let totalBytesFreed = 0;

  if (dryRun) {
    return {
      dryRun: true,
      inactiveMonths,
      candidateIds,
      processed: [],
      totalBytesFreed: 0,
    };
  }

  for (const id of candidateIds) {
    try {
      const result = await archiveProductFiles(id);
      processed.push(result);
      totalBytesFreed += result.bytesFreed;
    } catch (e) {
      console.error("IML product archive failed for", id, e);
      processed.push({
        productId: id,
        filesArchived: 0,
        legacyArchived: false,
        bytesFreed: 0,
        skippedReason: e instanceof Error ? e.message : "error",
      });
    }
  }

  return {
    dryRun: false,
    inactiveMonths,
    candidateIds,
    processed,
    totalBytesFreed,
  };
}

/** Smaže archivní soubor z disku (best-effort). */
export async function deleteArchiveFileIfExists(relativePath: string | null | undefined): Promise<void> {
  if (!relativePath) return;
  try {
    const abs = resolveArchiveAbsolutePath(relativePath);
    await fs.unlink(abs);
  } catch {
    /* ignore missing */
  }
}
