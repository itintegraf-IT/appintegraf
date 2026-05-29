import path from "path";
import { prisma } from "@/lib/db";
import { importTablesReplace, loadZipEntries } from "@/lib/backup/db-import";
import {
  clearUploadDir,
  deleteFileUploadsByModules,
  restoreFileFromZip,
} from "@/lib/backup/files";
import {
  getExtraUploadDirs,
  getFileUploadModulesForExport,
  normalizeModuleIds,
} from "@/lib/backup/module-registry";
import { resolveBackupRestoreModules } from "@/lib/backup/restore-modules";
import type {
  BackupImportResult,
  BackupManifest,
  BackupModuleId,
} from "@/lib/backup/types";
import { isBackupRestoreEnabled } from "@/lib/backup/config";

async function clearModuleUploadDirs(modules: BackupModuleId[]): Promise<void> {
  const fu = getFileUploadModulesForExport(modules);
  for (const f of fu) {
    await deleteFileUploadsByModules([f.module]);
    await clearUploadDir(f.uploadSubdir);
  }
  for (const d of getExtraUploadDirs(modules)) {
    await clearUploadDir(d);
  }
  if (modules.includes("ukoly")) {
    await clearUploadDir("ukoly");
  }
  if (modules.includes("kiosk")) {
    await clearUploadDir("kiosk");
  }
}

async function restoreFilesFromZip(zipEntries: Map<string, Buffer>): Promise<number> {
  let count = 0;
  for (const [zipPath, buffer] of zipEntries) {
    if (!zipPath.startsWith("files/")) continue;
    await restoreFileFromZip(zipPath, buffer);
    count++;
  }
  return count;
}

async function runRestoreWithExtractedZip(
  manifest: BackupManifest,
  effective: BackupModuleId[],
  modulesRequested: BackupModuleId[],
  tempDir: string,
  userId: number
): Promise<BackupImportResult> {
  const zipEntries = await loadZipEntries(tempDir);

  await clearModuleUploadDirs(effective);

  const tablesImported = await importTablesReplace(
    effective,
    path.join(tempDir, "data"),
    zipEntries
  );

  const filesRestored = await restoreFilesFromZip(zipEntries);

  await prisma.audit_log.create({
    data: {
      user_id: userId,
      module: "admin",
      action: "backup_restore",
      table_name: "backup",
      new_values: JSON.stringify({
        modulesRequested,
        modulesRestored: effective,
        manifestModules: manifest.modules,
        tablesImported,
        filesRestored,
        backupCreatedAt: manifest.createdAt,
      }),
    },
  });

  return {
    ok: true,
    modulesRestored: effective,
    errors: [],
    tablesImported,
  };
}

export async function runBackupRestore(
  zipPath: string,
  modules: BackupModuleId[],
  userId: number
): Promise<BackupImportResult> {
  if (!isBackupRestoreEnabled()) {
    return {
      ok: false,
      modulesRestored: [],
      errors: ["Obnova ze zálohy je na tomto serveru zakázána (BACKUP_RESTORE_ENABLED)."],
      tablesImported: [],
    };
  }

  const normalized = normalizeModuleIds(modules);
  if (normalized.length === 0) {
    return {
      ok: false,
      modulesRestored: [],
      errors: ["Nebyl vybrán žádný modul k obnově."],
      tablesImported: [],
    };
  }

  const errors: string[] = [];
  let tempDir: string | null = null;

  try {
    const zipRead = await import("@/lib/backup/zip-read");
    const manifest = await zipRead.readManifestFromZip(zipPath);
    const resolved = resolveBackupRestoreModules(normalized, manifest.modules);
    if (!resolved.ok) {
      return {
        ok: false,
        modulesRestored: [],
        errors: [resolved.error],
        tablesImported: [],
      };
    }

    tempDir = await zipRead.extractZipToTemp(zipPath);
    return await runRestoreWithExtractedZip(
      manifest,
      resolved.effective,
      normalized,
      tempDir,
      userId
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(msg);
    return {
      ok: false,
      modulesRestored: [],
      errors,
      tablesImported: [],
    };
  } finally {
    if (tempDir) {
      const { cleanupTempDir } = await import("@/lib/backup/zip-read");
      await cleanupTempDir(tempDir);
    }
  }
}

export async function runBackupRestoreFromBuffer(
  zipBuffer: Buffer,
  modules: BackupModuleId[],
  userId: number
): Promise<BackupImportResult> {
  if (!isBackupRestoreEnabled()) {
    return {
      ok: false,
      modulesRestored: [],
      errors: ["Obnova ze zálohy je na tomto serveru zakázána (BACKUP_RESTORE_ENABLED)."],
      tablesImported: [],
    };
  }

  const normalized = normalizeModuleIds(modules);
  if (normalized.length === 0) {
    return {
      ok: false,
      modulesRestored: [],
      errors: ["Nebyl vybrán žádný modul k obnově."],
      tablesImported: [],
    };
  }

  const errors: string[] = [];
  let tempDir: string | null = null;

  try {
    const zipRead = await import("@/lib/backup/zip-read");
    const manifest = await zipRead.readManifestFromBuffer(zipBuffer);
    const resolved = resolveBackupRestoreModules(normalized, manifest.modules);
    if (!resolved.ok) {
      return {
        ok: false,
        modulesRestored: [],
        errors: [resolved.error],
        tablesImported: [],
      };
    }

    tempDir = await zipRead.extractZipBufferToTemp(zipBuffer);
    return await runRestoreWithExtractedZip(
      manifest,
      resolved.effective,
      normalized,
      tempDir,
      userId
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(msg);
    return {
      ok: false,
      modulesRestored: [],
      errors,
      tablesImported: [],
    };
  } finally {
    if (tempDir) {
      const { cleanupTempDir } = await import("@/lib/backup/zip-read");
      await cleanupTempDir(tempDir);
    }
  }
}
