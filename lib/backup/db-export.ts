import { prisma } from "@/lib/db";
import { ensurePersonalistikaTables } from "@/lib/personalistika-db";
import { extractBlobRefsForRow } from "@/lib/backup/blobs-iml";
import { serializeRow } from "@/lib/backup/serialize";
import type { BackupModuleId, BackupTableDef } from "@/lib/backup/types";
import {
  getFileUploadFilterForModule,
  getTablesForModules,
  moduleIncludesTable,
} from "@/lib/backup/module-registry";

type PrismaDelegate = {
  findMany: (args?: { where?: Record<string, unknown> }) => Promise<Record<string, unknown>[]>;
};

function getPrismaDelegate(model: string): PrismaDelegate {
  const client = prisma as unknown as Record<string, PrismaDelegate>;
  const delegate = client[model];
  if (!delegate?.findMany) {
    throw new Error(`Prisma model not found: ${model}`);
  }
  return delegate;
}

async function fetchRawTable(sqlTable: string): Promise<Record<string, unknown>[]> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM \`${sqlTable.replace(/`/g, "")}\``
  );
  return rows;
}

async function fetchTableRows(
  table: BackupTableDef,
  modules: BackupModuleId[]
): Promise<Record<string, unknown>[]> {
  if (table.name === "file_uploads") {
    const moduleFilters: string[] = [];
    for (const modId of modules) {
      const f = getFileUploadFilterForModule(modId);
      if (f) moduleFilters.push(...f);
    }
    if (moduleFilters.length === 0) return [];
    return prisma.file_uploads.findMany({
      where: { module: { in: moduleFilters } },
    }) as Promise<Record<string, unknown>[]>;
  }

  if (table.source === "raw" && table.sqlTable) {
    return fetchRawTable(table.sqlTable);
  }

  if (table.prismaModel) {
    return getPrismaDelegate(table.prismaModel).findMany();
  }

  return [];
}

export type TableExportResult = {
  table: BackupTableDef;
  rows: Record<string, unknown>[];
  blobFiles: { zipPath: string; buffer: Buffer }[];
};

export async function exportTablesData(
  modules: BackupModuleId[]
): Promise<TableExportResult[]> {
  if (modules.includes("personalistika")) {
    await ensurePersonalistikaTables();
  }
  const tables = getTablesForModules(modules);
  const results: TableExportResult[] = [];

  for (const table of tables) {
    if (table.name === "file_uploads" && !moduleIncludesTable(modules, "file_uploads")) {
      continue;
    }
    const rawRows = await fetchTableRows(table, modules);
    const blobFiles: { zipPath: string; buffer: Buffer }[] = [];
    const rows: Record<string, unknown>[] = [];

    for (const raw of rawRows) {
      const row = raw as Record<string, unknown>;
      const blobRefs = extractBlobRefsForRow(table, row);

      for (const col of table.blobColumns ?? []) {
        const zipPath = blobRefs[col];
        const val = row[col];
        if (zipPath && Buffer.isBuffer(val)) {
          blobFiles.push({ zipPath, buffer: val });
        }
      }

      rows.push(serializeRow(row, blobRefs));
    }

    results.push({ table, rows, blobFiles });
  }

  return results;
}
