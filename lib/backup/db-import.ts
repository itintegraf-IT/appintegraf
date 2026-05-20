import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { ensurePersonalistikaTables } from "@/lib/personalistika-db";
import { isBlobRef } from "@/lib/backup/serialize";
import { BLOB_REF_KEY, type BackupModuleId, type BackupTableDef } from "@/lib/backup/types";
import {
  getFileUploadFilterForModule,
  getTablesForDelete,
  getTablesForModules,
} from "@/lib/backup/module-registry";
import type { PrismaTransactionClient } from "@/lib/db";

const BATCH_SIZE = 200;

type ZipEntryMap = Map<string, Buffer>;

function getPrismaDelegate(tx: PrismaTransactionClient, model: string) {
  const client = tx as unknown as Record<
    string,
    {
      deleteMany: (args?: { where?: Record<string, unknown> }) => Promise<unknown>;
      createMany: (args: {
        data: Record<string, unknown>[];
        skipDuplicates?: boolean;
      }) => Promise<unknown>;
    }
  >;
  const delegate = client[model];
  if (!delegate) throw new Error(`Prisma model not found: ${model}`);
  return delegate;
}

async function deleteTable(
  tx: PrismaTransactionClient,
  table: BackupTableDef,
  modules: BackupModuleId[]
): Promise<void> {
  if (table.name === "file_uploads") {
    const moduleFilters: string[] = [];
    for (const modId of modules) {
      const f = getFileUploadFilterForModule(modId);
      if (f) moduleFilters.push(...f);
    }
    if (moduleFilters.length > 0) {
      await tx.file_uploads.deleteMany({ where: { module: { in: moduleFilters } } });
    }
    return;
  }

  if (table.source === "raw" && table.sqlTable) {
    await tx.$executeRawUnsafe(`DELETE FROM \`${table.sqlTable.replace(/`/g, "")}\``);
    return;
  }

  if (table.prismaModel) {
    await getPrismaDelegate(tx, table.prismaModel).deleteMany();
  }
}

function prepareRowForInsert(
  row: Record<string, unknown>,
  table: BackupTableDef,
  zipEntries: ZipEntryMap
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const col of table.blobColumns ?? []) {
    const val = out[col];
    if (isBlobRef(val)) {
      const buf = zipEntries.get(val[BLOB_REF_KEY]);
      out[col] = buf ?? null;
    }
  }
  for (const [key, val] of Object.entries(out)) {
    if (val && typeof val === "object" && isBlobRef(val)) {
      out[key] = null;
    }
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
      out[key] = new Date(val);
    }
  }
  return out;
}

async function insertTable(
  tx: PrismaTransactionClient,
  table: BackupTableDef,
  rows: Record<string, unknown>[],
  zipEntries: ZipEntryMap
): Promise<void> {
  if (rows.length === 0) return;

  const prepared = rows.map((r) => prepareRowForInsert(r, table, zipEntries));

  if (table.source === "raw" && table.sqlTable) {
    for (let i = 0; i < prepared.length; i += BATCH_SIZE) {
      const batch = prepared.slice(i, i + BATCH_SIZE);
      for (const row of batch) {
        const cols = Object.keys(row);
        const placeholders = cols.map(() => "?").join(", ");
        const colList = cols.map((c) => `\`${c}\``).join(", ");
        const values = cols.map((c) => row[c]);
        await tx.$executeRawUnsafe(
          `INSERT INTO \`${table.sqlTable!.replace(/`/g, "")}\` (${colList}) VALUES (${placeholders})`,
          ...values
        );
      }
    }
    return;
  }

  if (table.prismaModel) {
    const delegate = getPrismaDelegate(tx, table.prismaModel);
    for (let i = 0; i < prepared.length; i += BATCH_SIZE) {
      const batch = prepared.slice(i, i + BATCH_SIZE);
      await delegate.createMany({ data: batch, skipDuplicates: false });
    }
  }
}

export async function loadZipEntries(extractDir: string): Promise<ZipEntryMap> {
  const { readdir, readFile: rf } = await import("fs/promises");
  const map = new Map<string, Buffer>();

  async function walk(dir: string, prefix: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      const zipPath = prefix ? `${prefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        await walk(abs, zipPath.replace(/\\/g, "/"));
      } else {
        const buf = await rf(abs);
        map.set(zipPath.replace(/\\/g, "/"), buf);
      }
    }
  }

  await walk(extractDir, "");
  return map;
}

export async function importTablesReplace(
  modules: BackupModuleId[],
  dataDir: string,
  zipEntries: ZipEntryMap
): Promise<{ name: string; rowCount: number }[]> {
  if (modules.includes("personalistika")) {
    await ensurePersonalistikaTables();
  }

  const tablesDelete = getTablesForDelete(modules);
  const tablesImport = getTablesForModules(modules);
  const imported: { name: string; rowCount: number }[] = [];

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");

      for (const table of tablesDelete) {
        await deleteTable(tx, table, modules);
      }

      for (const table of tablesImport) {
        const jsonPath = path.join(dataDir, `${table.name}.json`);
        let rows: Record<string, unknown>[] = [];
        try {
          const raw = await readFile(jsonPath, "utf-8");
          rows = JSON.parse(raw) as Record<string, unknown>[];
        } catch {
          rows = [];
        }
        const zipKey = `data/${table.name}.json`;
        if (rows.length === 0 && zipEntries.has(zipKey)) {
          const parsed = JSON.parse(zipEntries.get(zipKey)!.toString("utf-8")) as Record<
            string,
            unknown
          >[];
          rows = parsed;
        }
        await insertTable(tx, table, rows, zipEntries);
        imported.push({ name: table.name, rowCount: rows.length });
      }

      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
    },
    { timeout: 600_000 }
  );

  return imported;
}
