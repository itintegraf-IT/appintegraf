import {
  IML_PRODUCT_IMPORT_MAX_BYTES,
  IML_PRODUCT_IMPORT_MAX_MB,
} from "@/lib/iml-product-import-limits";
import { normalizeFolderPathPrefixes } from "@/lib/iml-product-import-paths";

export type ColumnMappingClient = Record<string, number>;

export type UploadProgressState = {
  phase: "uploading" | "processing";
  loaded: number;
  total: number;
  percent: number;
};

export function getFileRelativePath(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

export function collectFolderPaths(files: File[]): string[] {
  return normalizeFolderPathPrefixes(files.map(getFileRelativePath));
}

export function findProductsCsvInFileList(
  files: File[]
): { file: File; path: string } | null {
  for (const file of files) {
    const rel = getFileRelativePath(file);
    const base = rel.split("/").pop()?.toLowerCase();
    if (base === "products.csv") {
      return { file, path: rel };
    }
  }
  for (const file of files) {
    const rel = getFileRelativePath(file);
    if (rel.toLowerCase().endsWith(".csv")) {
      return { file, path: rel };
    }
  }
  return null;
}

export function appendFolderFilesToFormData(formData: FormData, files: File[]): void {
  const paths = collectFolderPaths(files);
  for (const file of files) {
    formData.append("files", file);
  }
  formData.append("paths", JSON.stringify(paths));
  formData.append("source", "folder");
}

export function buildLightPreviewFormData(
  files: File[],
  options: { mapping?: ColumnMappingClient; checkConflicts?: boolean } = {}
): FormData {
  const csv = findProductsCsvInFileList(files);
  if (!csv) {
    throw new Error("Ve složce chybí soubor products.csv");
  }
  const paths = collectFolderPaths(files);
  const formData = new FormData();
  formData.append("previewMode", "light");
  formData.append("csv", csv.file);
  formData.append("csvPath", csv.path);
  formData.append("paths", JSON.stringify(paths));
  formData.append("source", "folder");
  formData.append("mapping", JSON.stringify(options.mapping ?? {}));
  if (options.checkConflicts) formData.append("checkConflicts", "true");
  return formData;
}

export function sumFileListBytes(files: File[]): number {
  return files.reduce((sum, f) => sum + f.size, 0);
}

export function formatImportSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateImportSizeClient(files: File[] | null, zip: File | null): string | null {
  const total =
    files && files.length > 0 ? sumFileListBytes(files) : (zip?.size ?? 0);
  if (total > IML_PRODUCT_IMPORT_MAX_BYTES) {
    return `Celková velikost ${formatImportSize(total)} přesahuje limit ${IML_PRODUCT_IMPORT_MAX_MB} MB`;
  }
  return null;
}

export function estimateFormDataBytes(files: File[] | null, zip: File | null): number {
  if (files?.length) return sumFileListBytes(files);
  return zip?.size ?? 0;
}

export function postFormDataWithProgress(
  url: string,
  formData: FormData,
  options?: {
    onProgress?: (state: UploadProgressState) => void;
    signal?: AbortSignal;
    timeoutMs?: number;
  }
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const timeoutMs = options?.timeoutMs ?? 600_000;

    const timeoutId = window.setTimeout(() => {
      xhr.abort();
      reject(new Error("Požadavek vypršel – zkuste to znovu nebo menší export"));
    }, timeoutMs);

    const abortHandler = () => {
      xhr.abort();
      reject(new DOMException("Požadavek zrušen", "AbortError"));
    };
    options?.signal?.addEventListener("abort", abortHandler);

    xhr.upload.addEventListener("progress", (e) => {
      if (!e.lengthComputable) return;
      options?.onProgress?.({
        phase: "uploading",
        loaded: e.loaded,
        total: e.total,
        percent: Math.round((e.loaded / e.total) * 100),
      });
    });

    xhr.addEventListener("load", () => {
      window.clearTimeout(timeoutId);
      options?.signal?.removeEventListener("abort", abortHandler);
      options?.onProgress?.({
        phase: "processing",
        loaded: 1,
        total: 1,
        percent: 100,
      });
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(xhr.responseText) as Record<string, unknown>;
      } catch {
        data = {};
      }
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        data,
      });
    });

    xhr.addEventListener("error", () => {
      window.clearTimeout(timeoutId);
      options?.signal?.removeEventListener("abort", abortHandler);
      reject(new Error("Chyba sítě při nahrávání"));
    });

    xhr.addEventListener("abort", () => {
      window.clearTimeout(timeoutId);
      options?.signal?.removeEventListener("abort", abortHandler);
      reject(new DOMException("Požadavek zrušen", "AbortError"));
    });

    xhr.open("POST", url);
    xhr.send(formData);
  });
}
