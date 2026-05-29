import { access, mkdir, readdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import type { BackupModuleId } from "@/lib/backup/types";
import {
  getExtraUploadDirs,
  getFileUploadModulesForExport,
} from "@/lib/backup/module-registry";

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

export function uploadsRoot(): string {
  return UPLOADS_ROOT;
}

export function resolveUploadFilePath(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.startsWith("/uploads/")) {
    return path.join(process.cwd(), "public", normalized.slice(1));
  }
  if (normalized.startsWith("uploads/")) {
    return path.join(process.cwd(), "public", normalized);
  }
  if (path.isAbsolute(filePath)) return filePath;
  return null;
}

export function zipPathForUpload(filePath: string): string | null {
  const abs = resolveUploadFilePath(filePath);
  if (!abs) return null;
  const rel = path.relative(UPLOADS_ROOT, abs).replace(/\\/g, "/");
  if (rel.startsWith("..")) return null;
  return `files/${rel}`;
}

export async function collectUploadFilesForExport(modules: BackupModuleId[]): Promise<
  { zipPath: string; absPath: string }[]
> {
  const files: { zipPath: string; absPath: string }[] = [];
  const seen = new Set<string>();

  const fuModules = getFileUploadModulesForExport(modules);
  if (fuModules.length > 0) {
    const moduleNames = fuModules.map((f) => f.module);
    const rows = await prisma.file_uploads.findMany({
      where: { module: { in: moduleNames } },
      select: { file_path: true },
    });
    for (const row of rows) {
      const zp = zipPathForUpload(row.file_path);
      if (!zp || seen.has(zp)) continue;
      const abs = resolveUploadFilePath(row.file_path);
      if (!abs) continue;
      try {
        await access(abs);
        seen.add(zp);
        files.push({ zipPath: zp, absPath: abs });
      } catch {
        /* soubor na disku chybí */
      }
    }
  }

  for (const subdir of getExtraUploadDirs(modules)) {
    const dir = path.join(UPLOADS_ROOT, subdir);
    try {
      await collectDirRecursive(dir, `files/${subdir}`, seen, files);
    } catch {
      /* složka neexistuje */
    }
  }

  return files;
}

async function collectDirRecursive(
  absDir: string,
  zipPrefix: string,
  seen: Set<string>,
  out: { zipPath: string; absPath: string }[]
): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(absDir);
  } catch {
    return;
  }
  for (const name of entries) {
    const abs = path.join(absDir, name);
    const st = await stat(abs);
    const zp = `${zipPrefix}/${name}`.replace(/\\/g, "/");
    if (st.isDirectory()) {
      await collectDirRecursive(abs, zp, seen, out);
    } else if (!seen.has(zp)) {
      seen.add(zp);
      out.push({ zipPath: zp, absPath: abs });
    }
  }
}

/** Úkoly – attachment_path mimo file_uploads */
export async function collectUkolyAttachmentFiles(): Promise<
  { zipPath: string; absPath: string }[]
> {
  const rows = await prisma.ukoly.findMany({
    where: { attachment_path: { not: null } },
    select: { attachment_path: true },
  });
  const files: { zipPath: string; absPath: string }[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.attachment_path) continue;
    const zp = zipPathForUpload(row.attachment_path);
    if (!zp || seen.has(zp)) continue;
    const abs = resolveUploadFilePath(row.attachment_path);
    if (!abs) continue;
    try {
      await access(abs);
      seen.add(zp);
      files.push({ zipPath: zp, absPath: abs });
    } catch {
      /* skip */
    }
  }
  return files;
}

export async function restoreFileFromZip(
  zipPath: string,
  buffer: Buffer
): Promise<string> {
  const rel = zipPath.replace(/^files\//, "");
  const abs = path.join(UPLOADS_ROOT, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buffer);
  return `/uploads/${rel.replace(/\\/g, "/")}`;
}

export async function clearUploadDir(subdir: string): Promise<void> {
  const dir = path.join(UPLOADS_ROOT, subdir);
  try {
    await rmDirRecursive(dir);
  } catch {
    /* */
  }
}

async function rmDirRecursive(dir: string): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const p = path.join(dir, name);
    const st = await stat(p);
    if (st.isDirectory()) await rmDirRecursive(p);
    else await unlink(p);
  }
}

export async function deleteFileUploadsByModules(moduleNames: string[]): Promise<void> {
  if (moduleNames.length === 0) return;
  const rows = await prisma.file_uploads.findMany({
    where: { module: { in: moduleNames } },
    select: { file_path: true },
  });
  for (const row of rows) {
    const abs = resolveUploadFilePath(row.file_path);
    if (abs) {
      try {
        await unlink(abs);
      } catch {
        /* */
      }
    }
  }
}
