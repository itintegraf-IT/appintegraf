import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { deleteArchiveFileIfExists } from "@/lib/iml-product-archive";
import {
  IML_WIPE_ASSET_STATUSES,
  IML_WIPE_ASSETS_DEFAULT_BATCH,
  IML_WIPE_SELECTABLE_STATUSES,
  IML_WIPE_STATUS_NONE,
  isProductStatusEmpty,
  isWipeAssetStatus,
  isWipeSelectableStatus,
  type ImlWipeAssetStatus,
  type ImlWipeSelectableStatus,
} from "@/lib/iml-product-wipe-assets-shared";

export {
  IML_WIPE_ASSET_STATUSES,
  IML_WIPE_ASSETS_DEFAULT_BATCH,
  IML_WIPE_SELECTABLE_STATUSES,
  IML_WIPE_STATUS_NONE,
  isProductStatusEmpty,
  wipeStatusLabel,
  type ImlWipeAssetStatus,
  type ImlWipeSelectableStatus,
} from "@/lib/iml-product-wipe-assets-shared";

export type WipeProductAssetsResult = {
  productId: number;
  filesDeleted: number;
  clearedImage: boolean;
  clearedLegacyPdf: boolean;
  bytesFreed: number;
  skippedReason?: string;
};

export type WipeAssetsBatchOptions = {
  dryRun?: boolean;
  limit?: number;
  /** Podmnožina whitelistu; prázdné / neuvedené = všechny povolené. */
  statuses?: string[];
};

export type WipeAssetsBatchResult = {
  dryRun: boolean;
  allowedStatuses: readonly string[];
  selectedStatuses: string[];
  candidateIds: number[];
  processed: WipeProductAssetsResult[];
  totalBytesFreed: number;
  totalFilesDeleted: number;
};

export type WipeAssetsStatusCounts = {
  products: number;
  withAssets: number;
};

export type WipeAssetsStats = {
  allowedStatuses: readonly string[];
  byStatus: Record<string, WipeAssetsStatusCounts>;
  productsInStatus: number;
  productsWithAssets: number;
};

function productMatchesWipeSelection(
  itemStatus: string | null | undefined,
  selected: ImlWipeSelectableStatus[]
): boolean {
  if (isProductStatusEmpty(itemStatus)) {
    return selected.includes(IML_WIPE_STATUS_NONE);
  }
  return (
    typeof itemStatus === "string" &&
    isWipeAssetStatus(itemStatus) &&
    selected.includes(itemStatus)
  );
}

/** Validuje a seřadí stavy podle whitelistu. Prázdný vstup = všechny povolené. */
export function normalizeWipeStatuses(input: unknown): ImlWipeSelectableStatus[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [...IML_WIPE_SELECTABLE_STATUSES];
  }
  const picked = new Set(
    input.filter((s): s is ImlWipeSelectableStatus => typeof s === "string" && isWipeSelectableStatus(s))
  );
  return IML_WIPE_SELECTABLE_STATUSES.filter((s) => picked.has(s));
}

function blobLen(data: Buffer | Uint8Array | null | undefined): number {
  if (!data) return 0;
  return data.length;
}

const HAS_ASSETS_SQL = Prisma.sql`
  (
    (p.image_data IS NOT NULL AND OCTET_LENGTH(p.image_data) > 0)
    OR (p.pdf_data IS NOT NULL AND OCTET_LENGTH(p.pdf_data) > 0)
    OR (p.pdf_archive_path IS NOT NULL AND p.pdf_archive_path <> '')
    OR EXISTS (
      SELECT 1 FROM iml_product_files f WHERE f.product_id = p.id
    )
  )
`;

const EMPTY_STATUS_SQL = Prisma.sql`(p.item_status IS NULL OR TRIM(p.item_status) = '')`;

function buildStatusFilterSql(statuses: ImlWipeSelectableStatus[]): Prisma.Sql | null {
  const regular = statuses.filter(isWipeAssetStatus);
  const includeNone = statuses.includes(IML_WIPE_STATUS_NONE);
  const parts: Prisma.Sql[] = [];

  if (regular.length > 0) {
    parts.push(Prisma.sql`p.item_status IN (${Prisma.join(regular)})`);
  }
  if (includeNone) {
    parts.push(EMPTY_STATUS_SQL);
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!;
  return Prisma.sql`(${Prisma.join(parts, " OR ")})`;
}

/** Statistiky pro admin UI (per povolený stav). */
export async function getWipeAssetsStats(): Promise<WipeAssetsStats> {
  const byStatus: Record<string, WipeAssetsStatusCounts> = {};

  for (const status of IML_WIPE_ASSET_STATUSES) {
    const [products, withAssets] = await Promise.all([
      prisma.iml_products.count({ where: { item_status: status } }),
      prisma.$queryRaw<Array<{ cnt: bigint }>>`
        SELECT COUNT(*) AS cnt
        FROM iml_products p
        WHERE p.item_status = ${status}
          AND ${HAS_ASSETS_SQL}
      `,
    ]);
    byStatus[status] = {
      products,
      withAssets: Number(withAssets[0]?.cnt ?? 0),
    };
  }

  const [noneProducts, noneWithAssets] = await Promise.all([
    prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) AS cnt FROM iml_products p WHERE ${EMPTY_STATUS_SQL}
    `,
    prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) AS cnt
      FROM iml_products p
      WHERE ${EMPTY_STATUS_SQL}
        AND ${HAS_ASSETS_SQL}
    `,
  ]);
  byStatus[IML_WIPE_STATUS_NONE] = {
    products: Number(noneProducts[0]?.cnt ?? 0),
    withAssets: Number(noneWithAssets[0]?.cnt ?? 0),
  };

  const productsInStatus = Object.values(byStatus).reduce((a, c) => a + c.products, 0);
  const productsWithAssets = Object.values(byStatus).reduce(
    (a, c) => a + c.withAssets,
    0
  );

  return {
    allowedStatuses: IML_WIPE_SELECTABLE_STATUSES,
    byStatus,
    productsInStatus,
    productsWithAssets,
  };
}

export async function findWipeAssetCandidates(
  limit: number,
  statuses: ImlWipeSelectableStatus[]
): Promise<number[]> {
  const statusFilter = buildStatusFilterSql(statuses);
  if (!statusFilter) return [];
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT p.id
    FROM iml_products p
    WHERE ${statusFilter}
      AND ${HAS_ASSETS_SQL}
    ORDER BY p.id ASC
    LIMIT ${safeLimit}
  `;

  return rows.map((r) => Number(r.id));
}

/**
 * Smaže všechna tisková PDF (verze + legacy + disk) a softproof (`image_data`).
 * Metadata produktu zůstávají. Povoleno jen pro stavy z whitelistu / běhu.
 */
export async function wipeProductPrintAndPreview(
  productId: number,
  statusesForRun: ImlWipeSelectableStatus[] = [...IML_WIPE_SELECTABLE_STATUSES]
): Promise<WipeProductAssetsResult> {
  const product = await prisma.iml_products.findUnique({
    where: { id: productId },
    select: {
      id: true,
      item_status: true,
      image_data: true,
      pdf_data: true,
      pdf_archive_path: true,
    },
  });

  if (!product) {
    return {
      productId,
      filesDeleted: 0,
      clearedImage: false,
      clearedLegacyPdf: false,
      bytesFreed: 0,
      skippedReason: "Produkt nenalezen",
    };
  }

  if (!productMatchesWipeSelection(product.item_status, statusesForRun)) {
    return {
      productId,
      filesDeleted: 0,
      clearedImage: false,
      clearedLegacyPdf: false,
      bytesFreed: 0,
      skippedReason: `Nepovolený stav: ${product.item_status?.trim() || "bez stavu"}`,
    };
  }

  const files = await prisma.iml_product_files.findMany({
    where: { product_id: productId },
    select: {
      id: true,
      pdf_data: true,
      archive_path: true,
    },
  });

  let bytesFreed = blobLen(product.image_data) + blobLen(product.pdf_data);
  for (const f of files) {
    bytesFreed += blobLen(f.pdf_data);
  }

  const archivePaths = [
    ...files.map((f) => f.archive_path),
    product.pdf_archive_path,
  ].filter((p): p is string => Boolean(p?.trim()));

  const clearedImage = blobLen(product.image_data) > 0;
  const clearedLegacyPdf =
    blobLen(product.pdf_data) > 0 || Boolean(product.pdf_archive_path?.trim());
  const filesDeleted = files.length;

  if (filesDeleted === 0 && !clearedImage && !clearedLegacyPdf) {
    return {
      productId,
      filesDeleted: 0,
      clearedImage: false,
      clearedLegacyPdf: false,
      bytesFreed: 0,
      skippedReason: "Žádná tisková data ani softproof",
    };
  }

  await prisma.$transaction(async (tx) => {
    if (filesDeleted > 0) {
      await tx.iml_product_files.deleteMany({ where: { product_id: productId } });
    }
    await tx.iml_products.update({
      where: { id: productId },
      data: {
        image_data: null,
        pdf_data: null,
        pdf_archive_path: null,
      },
    });
  });

  for (const rel of archivePaths) {
    await deleteArchiveFileIfExists(rel);
  }

  return {
    productId,
    filesDeleted,
    clearedImage,
    clearedLegacyPdf,
    bytesFreed,
  };
}

export async function runImlWipeAssetsBatch(
  opts?: WipeAssetsBatchOptions
): Promise<WipeAssetsBatchResult> {
  const dryRun = opts?.dryRun === true;
  const limit = Math.min(
    Math.max(opts?.limit ?? IML_WIPE_ASSETS_DEFAULT_BATCH, 1),
    100
  );
  const selectedStatuses = normalizeWipeStatuses(opts?.statuses);

  const candidateIds = await findWipeAssetCandidates(limit, selectedStatuses);

  if (dryRun) {
    return {
      dryRun: true,
      allowedStatuses: IML_WIPE_SELECTABLE_STATUSES,
      selectedStatuses,
      candidateIds,
      processed: [],
      totalBytesFreed: 0,
      totalFilesDeleted: 0,
    };
  }

  const processed: WipeProductAssetsResult[] = [];
  let totalBytesFreed = 0;
  let totalFilesDeleted = 0;

  for (const id of candidateIds) {
    try {
      const result = await wipeProductPrintAndPreview(id, selectedStatuses);
      processed.push(result);
      totalBytesFreed += result.bytesFreed;
      totalFilesDeleted += result.filesDeleted;
    } catch (e) {
      console.error("IML wipe assets failed for", id, e);
      processed.push({
        productId: id,
        filesDeleted: 0,
        clearedImage: false,
        clearedLegacyPdf: false,
        bytesFreed: 0,
        skippedReason: e instanceof Error ? e.message : "error",
      });
    }
  }

  return {
    dryRun: false,
    allowedStatuses: IML_WIPE_SELECTABLE_STATUSES,
    selectedStatuses,
    candidateIds,
    processed,
    totalBytesFreed,
    totalFilesDeleted,
  };
}
