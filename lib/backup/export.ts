import * as archiverRoot from "archiver";
import { readFile } from "fs/promises";
import { PassThrough } from "stream";
import type { Readable } from "stream";
import { readFileSync } from "fs";
import path from "path";
import { exportTablesData } from "@/lib/backup/db-export";
import {
  collectUkolyAttachmentFiles,
  collectUploadFilesForExport,
} from "@/lib/backup/files";
import { getModuleWarnings } from "@/lib/backup/module-registry";
import {
  BACKUP_FORMAT_VERSION,
  type BackupExportOptions,
  type BackupManifest,
  type BackupModuleId,
} from "@/lib/backup/types";

export async function buildBackupZipStream(
  options: BackupExportOptions
): Promise<{ stream: Readable; filename: string }> {
  const { modules, createdByUserId } = options;
  const pass = new PassThrough();
  // archiver v8: named export ZipArchive (@types/archiver ještě popisuje staré API)
  const { ZipArchive } = archiverRoot as unknown as {
    ZipArchive: new (options?: { zlib?: { level?: number } }) => {
      pipe: (dest: PassThrough) => void;
      append: (source: string | Buffer, data: { name: string }) => unknown;
      on: (event: "error", listener: (err: Error) => void) => void;
      finalize: () => Promise<void>;
    };
  };
  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.pipe(pass);

  const warnings = getModuleWarnings(modules);
  const tableExports = await exportTablesData(modules);

  const manifestTables: BackupManifest["tables"] = [];

  for (const { table, rows, blobFiles } of tableExports) {
    manifestTables.push({ name: table.name, rowCount: rows.length });
    const json = JSON.stringify(rows, null, 0);
    archive.append(json, { name: `data/${table.name}.json` });
    for (const blob of blobFiles) {
      archive.append(blob.buffer, { name: blob.zipPath });
    }
  }

  const uploadFiles = await collectUploadFilesForExport(modules);
  for (const f of uploadFiles) {
    const buf = await readFile(f.absPath);
    archive.append(buf, { name: f.zipPath });
  }

  if (modules.includes("ukoly")) {
    const ukolyFiles = await collectUkolyAttachmentFiles();
    for (const f of ukolyFiles) {
      if (uploadFiles.some((u) => u.zipPath === f.zipPath)) continue;
      const buf = await readFile(f.absPath);
      archive.append(buf, { name: f.zipPath });
    }
  }

  const pkg = JSON.parse(
    readFileSync(path.join(process.cwd(), "package.json"), "utf-8")
  ) as { version?: string };

  const manifest: BackupManifest = {
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: pkg.version ?? "0.0.0",
    createdAt: new Date().toISOString(),
    createdByUserId,
    modules,
    tables: manifestTables,
    warnings,
  };

  archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `integraf-backup-${ts}.zip`;

  archive.on("error", (err: Error) => pass.destroy(err));
  void archive.finalize();

  return { stream: pass, filename };
}

export function allModuleIds(): BackupModuleId[] {
  return [
    "system",
    "contacts",
    "equipment",
    "calendar",
    "ukoly",
    "personalistika",
    "contracts",
    "planovani",
    "vyroba",
    "materialy",
    "iml",
    "kiosk",
    "training",
    "audit",
  ];
}
