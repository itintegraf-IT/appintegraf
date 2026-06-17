import { readFile, readdir } from "fs/promises";
import path from "path";
import {
  parseCsvText,
  parseExcelBuffer,
  type ParsedCsvFromZip,
} from "@/lib/iml-product-import-parse";

/** Kód produktu ve stylu IMLEXport: 04-03-002 */
export const PRODUCT_CODE_REGEX = /^(\d{2}-\d{2}-\d{3})/i;

/** Kód produktu ve stylu Alimpex: 499073 (6 číslic na začátku názvu) */
export const PRODUCT_CODE_SIX_DIGIT_REGEX = /^(\d{6})(?:[-_.]|$)/;

/** Extrahuje kód z názvu souboru bez přípony (NN-NN-NNN nebo 6 číslic). */
export function extractProductCodeFromBasename(baseNoExt: string): string | null {
  const dashed = baseNoExt.match(PRODUCT_CODE_REGEX);
  if (dashed) return dashed[1].toUpperCase();
  const sixDigit = baseNoExt.match(PRODUCT_CODE_SIX_DIGIT_REGEX);
  if (sixDigit) return sixDigit[1].toUpperCase();
  return null;
}

export type ZipFileKind = "print" | "preview" | "unknown";

export type ClassifiedZipFile = {
  relativePath: string;
  basename: string;
  kind: ZipFileKind;
  productCode: string | null;
  ext: string;
};

export type FileIndexSummary = {
  total: number;
  print: number;
  preview: number;
  unknown: number;
  unmatchedCodes: string[];
  byCode: Record<
    string,
    { print: number; preview: number; paths: string[] }
  >;
};

const SKIP_BASENAMES = new Set([
  "products.csv",
  "thumbs.db",
  "desktop.ini",
]);

const MEDIA_EXT = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
]);

function normalizeBasename(name: string): string {
  return name.replace(/\\/g, "/").split("/").pop() ?? name;
}

function isCsvPath(p: string): boolean {
  const base = normalizeBasename(p).toLowerCase();
  return base.endsWith(".csv");
}

function shouldSkipFile(basename: string): boolean {
  const lower = basename.toLowerCase();
  if (SKIP_BASENAMES.has(lower)) return true;
  if (lower.startsWith(".")) return true;
  if (lower.startsWith("~$")) return true;
  return false;
}

/** Extrahuje kód produktu z názvu souboru. */
export function extractProductCodeFromFilename(basename: string): {
  kind: ZipFileKind;
  code: string | null;
} {
  const name = basename;
  const lower = name.toLowerCase();
  const baseNoExt = lower.replace(/\.[^.]+$/, "");

  if (/^softproof[-_]/.test(baseNoExt) || baseNoExt.startsWith("softproof")) {
    const after = baseNoExt.replace(/^softproof[-_]?/i, "");
    const code = extractProductCodeFromBasename(after);
    return { kind: "preview", code };
  }

  const code = extractProductCodeFromBasename(baseNoExt);
  if (code) {
    return { kind: "print", code };
  }

  return { kind: "unknown", code: null };
}

/** Softproof s placeholder kódem (0x-0x-00x) zdědí kód z tiskového PDF ve stejné složce. */
export function resolvePreviewCodesFromSiblings(
  files: ClassifiedZipFile[]
): ClassifiedZipFile[] {
  const byDir = new Map<string, ClassifiedZipFile[]>();
  for (const file of files) {
    const slash = file.relativePath.lastIndexOf("/");
    const dir = slash >= 0 ? file.relativePath.slice(0, slash) : "";
    const bucket = byDir.get(dir) ?? [];
    bucket.push(file);
    byDir.set(dir, bucket);
  }

  return files.map((file) => {
    if (file.productCode || file.kind !== "preview") return file;
    const slash = file.relativePath.lastIndexOf("/");
    const dir = slash >= 0 ? file.relativePath.slice(0, slash) : "";
    const siblings = byDir.get(dir) ?? [];
    const printSibling = siblings.find((s) => s.kind === "print" && s.productCode);
    if (!printSibling?.productCode) return file;
    return { ...file, productCode: printSibling.productCode };
  });
}

export function classifyFile(relativePath: string): ClassifiedZipFile {
  const basename = normalizeBasename(relativePath);
  const ext = path.extname(basename).toLowerCase();
  const { kind, code } = extractProductCodeFromFilename(basename);
  return {
    relativePath: relativePath.replace(/\\/g, "/"),
    basename,
    kind,
    productCode: code,
    ext,
  };
}

export async function findCsvInExtractedDir(
  rootDir: string
): Promise<ParsedCsvFromZip> {
  const csvCandidates: string[] = [];

  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!e.isFile() || !isCsvPath(e.name)) continue;
      csvCandidates.push(full);
    }
  }

  await walk(rootDir);

  if (csvCandidates.length === 0) {
    throw new Error(
      "V exportu nebyl nalezen CSV soubor (očekáván products.csv nebo jiný .csv)"
    );
  }

  const productsCsv = csvCandidates.find(
    (p) => normalizeBasename(p).toLowerCase() === "products.csv"
  );
  const csvPath = productsCsv ?? csvCandidates[0];

  const buf = await readFile(csvPath);
  const rel = path.relative(rootDir, csvPath).replace(/\\/g, "/");
  const lower = csvPath.toLowerCase();

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const { headers, dataRows } = parseExcelBuffer(buf);
    return { headers, dataRows, csvRelativePath: rel };
  }

  const { headers, dataRows } = parseCsvText(buf.toString("utf-8"));
  return { headers, dataRows, csvRelativePath: rel };
}

/** Klasifikace médií ze seznamu relativních cest (light preview bez zápisu na disk). */
export function classifyMediaFromPaths(paths: string[]): ClassifiedZipFile[] {
  const out: ClassifiedZipFile[] = [];
  for (const raw of paths) {
    const rel = raw.replace(/\\/g, "/");
    const basename = normalizeBasename(rel);
    if (shouldSkipFile(basename)) continue;
    if (isCsvPath(rel)) continue;
    const ext = path.extname(basename).toLowerCase();
    if (!MEDIA_EXT.has(ext)) continue;
    out.push(classifyFile(rel));
  }
  return resolvePreviewCodesFromSiblings(out);
}

export async function walkMediaFiles(rootDir: string): Promise<ClassifiedZipFile[]> {
  const out: ClassifiedZipFile[] = [];

  async function walk(dir: string, prefix: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full, rel);
        continue;
      }
      if (!e.isFile()) continue;
      const basename = normalizeBasename(e.name);
      if (shouldSkipFile(basename)) continue;
      if (isCsvPath(rel)) continue;
      const ext = path.extname(basename).toLowerCase();
      if (!MEDIA_EXT.has(ext)) continue;
      out.push(classifyFile(rel));
    }
  }

  await walk(rootDir, "");
  return resolvePreviewCodesFromSiblings(out);
}

export function summarizeFileIndex(
  files: ClassifiedZipFile[],
  knownCodes: Set<string>
): FileIndexSummary {
  const summary: FileIndexSummary = {
    total: files.length,
    print: 0,
    preview: 0,
    unknown: 0,
    unmatchedCodes: [],
    byCode: {},
  };

  const codesSeen = new Set<string>();

  for (const f of files) {
    if (f.kind === "print") summary.print++;
    else if (f.kind === "preview") summary.preview++;
    else summary.unknown++;

    if (!f.productCode) continue;
    const code = f.productCode;
    if (!summary.byCode[code]) {
      summary.byCode[code] = { print: 0, preview: 0, paths: [] };
    }
    if (f.kind === "print") summary.byCode[code].print++;
    if (f.kind === "preview") summary.byCode[code].preview++;
    summary.byCode[code].paths.push(f.relativePath);

    if (!knownCodes.has(code) && !codesSeen.has(code)) {
      codesSeen.add(code);
      summary.unmatchedCodes.push(code);
    }
  }

  return summary;
}
