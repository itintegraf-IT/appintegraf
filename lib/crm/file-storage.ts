import { promises as fs } from "fs";
import { join, resolve, extname } from "path";
import { randomBytes } from "crypto";
import { AppError } from "./errors";

export interface SavedAttachment {
  path: string;
  size: number;
}

function baseDir(): string {
  return resolve(process.env.CRM_UPLOADS_DIR ?? "uploads/crm");
}

function assertInsideBase(absPath: string): void {
  const base = baseDir();
  if (!absPath.startsWith(base + "/") && absPath !== base) {
    throw new AppError("VALIDATION", "Neplatná cesta k souboru.");
  }
}

function fsError(op: string, dir: string, err: unknown): AppError {
  const code = (err as NodeJS.ErrnoException)?.code;
  console.error(`[crm-file-storage] ${op} selhal pro ${dir}`, err);
  if (code === "EACCES" || code === "EPERM") {
    return new AppError("INTERNAL", `Server nemá právo zapsat do úložiště příloh (${code}). Kontaktuj IT.`, {
      cause: err,
    });
  }
  if (code === "ENOSPC") {
    return new AppError("INTERNAL", "Na serveru došlo místo na disku. Kontaktuj IT.", { cause: err });
  }
  if (code === "ENOENT" || code === "EROFS") {
    return new AppError("INTERNAL", `Úložiště příloh není dostupné (${code}). Kontaktuj IT.`, { cause: err });
  }
  return new AppError("INTERNAL", "Nelze uložit přílohu.", { cause: err });
}

export async function saveAttachment(
  data: Buffer,
  originalName: string,
  _mime: string
): Promise<SavedAttachment> {
  const ext = extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, "") || "";
  const hash = randomBytes(16).toString("hex");
  const rel = `${hash.slice(0, 2)}/${hash}${ext}`;
  const abs = join(baseDir(), rel);
  assertInsideBase(abs);
  const subdir = join(baseDir(), hash.slice(0, 2));
  try {
    await fs.mkdir(subdir, { recursive: true });
  } catch (err) {
    throw fsError("mkdir", subdir, err);
  }
  try {
    await fs.writeFile(abs, data);
  } catch (err) {
    throw fsError("writeFile", abs, err);
  }
  return { path: rel, size: data.length };
}

export async function readAttachment(relPath: string): Promise<Buffer> {
  const abs = resolve(baseDir(), relPath);
  assertInsideBase(abs);
  try {
    return await fs.readFile(abs);
  } catch (err) {
    throw fsError("readFile", abs, err);
  }
}

export async function deleteAttachment(relPath: string): Promise<void> {
  const abs = resolve(baseDir(), relPath);
  assertInsideBase(abs);
  await fs.unlink(abs).catch(() => undefined);
}
