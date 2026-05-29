import { mkdir, mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { cleanupTempDir, extractZipBufferToTemp } from "@/lib/backup/zip-read";
import { parseCsvText } from "@/lib/iml-product-import-parse";
import {
  classifyMediaFromPaths,
  type ClassifiedZipFile,
} from "@/lib/iml-product-import-zip";
import { normalizeFolderPathPrefixes } from "@/lib/iml-product-import-paths";
import {
  IML_PRODUCT_IMPORT_MAX_BYTES,
  IML_PRODUCT_IMPORT_MAX_MB,
} from "@/lib/iml-product-import-limits";

export type ImportUploadSource = "folder" | "zip";

export function sanitizeImportRelativePath(rel: string): string {
  const norm = path.posix.normalize(rel.replace(/\\/g, "/"));
  const segments = norm.split("/").filter(Boolean);
  if (segments.some((s) => s === "..")) {
    throw new Error(`Neplatná cesta souboru: ${rel}`);
  }
  return segments.join("/");
}

export function getFolderFilesFromFormData(formData: FormData): File[] {
  return formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
}

export function getFolderPathsFromFormData(formData: FormData, files: File[]): string[] {
  const pathsStr = formData.get("paths");
  if (pathsStr) {
    const parsed = JSON.parse(String(pathsStr)) as string[];
    if (Array.isArray(parsed) && parsed.length === files.length) {
      return normalizeFolderPathPrefixes(parsed);
    }
  }
  return normalizeFolderPathPrefixes(files.map((f) => f.name));
}

export type LightPreviewParsed = {
  headers: string[];
  dataRows: string[][];
  csvRelativePath: string;
  mediaFiles: ClassifiedZipFile[];
};

export async function parseLightPreviewFromFormData(
  formData: FormData
): Promise<LightPreviewParsed> {
  const csv = formData.get("csv");
  if (!(csv instanceof File) || csv.size === 0) {
    throw new Error("Chybí soubor products.csv");
  }
  const pathsStr = formData.get("paths");
  const paths: string[] = pathsStr
    ? normalizeFolderPathPrefixes(JSON.parse(String(pathsStr)) as string[])
    : [];
  const csvPath = String(formData.get("csvPath") || "products.csv");
  const buf = Buffer.from(await csv.arrayBuffer());
  const { headers, dataRows } = parseCsvText(buf.toString("utf-8"));
  if (dataRows.length === 0) {
    throw new Error("CSV neobsahuje žádná data");
  }
  const mediaFiles = classifyMediaFromPaths(paths);
  return {
    headers,
    dataRows,
    csvRelativePath: csvPath.replace(/\\/g, "/"),
    mediaFiles,
  };
}

export function isLightPreviewMode(formData: FormData): boolean {
  return formData.get("previewMode") === "light";
}

export function assertTotalSizeWithinLimit(totalBytes: number): void {
  if (totalBytes > IML_PRODUCT_IMPORT_MAX_BYTES) {
    throw new Error(
      `Import je příliš velký (max ${IML_PRODUCT_IMPORT_MAX_MB} MB celkem). Použijte menší výběr souborů.`
    );
  }
}

export async function writeFilesToTemp(files: File[], paths: string[]): Promise<string> {
  if (files.length === 0) {
    throw new Error("Složka neobsahuje žádné soubory");
  }

  const dir = await mkdtemp(path.join(tmpdir(), "iml-import-"));
  let total = 0;

  try {
    const normalizedPaths = normalizeFolderPathPrefixes(paths);
    for (let i = 0; i < files.length; i++) {
      const rel = sanitizeImportRelativePath(normalizedPaths[i] ?? files[i].name);
      const buf = Buffer.from(await files[i].arrayBuffer());
      total += buf.length;
      assertTotalSizeWithinLimit(total);

      const dest = path.join(dir, rel);
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, buf);
    }
    return dir;
  } catch (e) {
    await cleanupTempDir(dir);
    throw e;
  }
}

export async function prepareImportTempDir(formData: FormData): Promise<{
  tempDir: string;
  source: ImportUploadSource;
}> {
  const folderFiles = getFolderFilesFromFormData(formData);
  if (folderFiles.length > 0) {
    const paths = getFolderPathsFromFormData(formData, folderFiles);
    let total = 0;
    for (const f of folderFiles) total += f.size;
    assertTotalSizeWithinLimit(total);
    const tempDir = await writeFilesToTemp(folderFiles, paths);
    return { tempDir, source: "folder" };
  }

  const zip = formData.get("zip");
  if (zip instanceof File && zip.size > 0) {
    assertTotalSizeWithinLimit(zip.size);
    const name = zip.name.toLowerCase();
    if (!name.endsWith(".zip")) {
      throw new Error("Očekáván soubor .zip");
    }
    const buf = Buffer.from(await zip.arrayBuffer());
    const tempDir = await extractZipBufferToTemp(buf);
    return { tempDir, source: "zip" };
  }

  throw new Error("Vyberte složku s exportem nebo nahrajte ZIP archiv");
}

export async function withImportTempDir<T>(
  formData: FormData,
  fn: (tempDir: string) => Promise<T>
): Promise<T> {
  const { tempDir } = await prepareImportTempDir(formData);
  try {
    return await fn(tempDir);
  } finally {
    await cleanupTempDir(tempDir);
  }
}
