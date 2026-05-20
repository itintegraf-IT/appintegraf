import { createReadStream } from "fs";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import unzipper from "unzipper";
import {
  BACKUP_FORMAT_VERSION,
  type BackupManifest,
} from "@/lib/backup/types";

export async function readManifestFromZip(zipPath: string): Promise<BackupManifest> {
  const directory = await unzipper.Open.file(zipPath);
  const entry = directory.files.find((f) => f.path === "manifest.json");
  if (!entry) {
    throw new Error("V archivu chybí manifest.json");
  }
  const buf = await entry.buffer();
  return parseManifest(buf.toString("utf-8"));
}

export async function readManifestFromBuffer(zipBuffer: Buffer): Promise<BackupManifest> {
  const directory = await unzipper.Open.buffer(zipBuffer);
  const entry = directory.files.find((f) => f.path === "manifest.json");
  if (!entry) {
    throw new Error("V archivu chybí manifest.json");
  }
  const buf = await entry.buffer();
  return parseManifest(buf.toString("utf-8"));
}

export function parseManifest(json: string): BackupManifest {
  const manifest = JSON.parse(json) as BackupManifest;
  if (manifest.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error(
      `Nepodporovaná verze zálohy: ${manifest.formatVersion} (očekáváno ${BACKUP_FORMAT_VERSION})`
    );
  }
  if (!manifest.modules?.length) {
    throw new Error("Manifest neobsahuje moduly");
  }
  return manifest;
}

export async function extractZipToTemp(zipPath: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "integraf-restore-"));
  await new Promise<void>((resolve, reject) => {
    createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: dir }))
      .on("close", () => resolve())
      .on("error", reject);
  });
  return dir;
}

export async function extractZipBufferToTemp(zipBuffer: Buffer): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "integraf-restore-"));
  const directory = await unzipper.Open.buffer(zipBuffer);
  for (const file of directory.files) {
    if (file.type === "Directory") continue;
    const content = await file.buffer();
    const dest = path.join(dir, file.path);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, content);
  }
  return dir;
}

export async function cleanupTempDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    /* */
  }
}
