import {
  IML_PRODUCT_IMPORT_BATCH_MAX_BYTES,
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
  batchIndex?: number;
  batchCount?: number;
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

/** Kontrola velikosti ZIP (složka nemá celkový limit – nahrává se po dávkách). */
export function validateZipImportSizeClient(zip: File | null): string | null {
  if (!zip) return null;
  if (zip.size > IML_PRODUCT_IMPORT_MAX_BYTES) {
    return `Velikost ZIP ${formatImportSize(zip.size)} přesahuje limit ${IML_PRODUCT_IMPORT_MAX_MB} MB – použijte složku`;
  }
  return null;
}

/** @deprecated Použijte validateZipImportSizeClient – složka nemá celkový limit. */
export function validateImportSizeClient(files: File[] | null, zip: File | null): string | null {
  if (files && files.length > 0) return null;
  return validateZipImportSizeClient(zip);
}

export function getPathsForFiles(files: File[]): string[] {
  return normalizeFolderPathPrefixes(files.map(getFileRelativePath));
}

export function sortFolderFilesForImport(files: File[]): File[] {
  const csv = findProductsCsvInFileList(files);
  if (!csv) return files;
  const rest = files.filter((f) => f !== csv.file);
  return [csv.file, ...rest];
}

export function formatImportApiError(
  status: number,
  data: Record<string, unknown>,
  responseText?: string
): string {
  if (typeof data.error === "string" && data.error.trim()) {
    return data.error;
  }
  if (status === 413) {
    return `Požadavek byl odmítnut (413) – reverse proxy má pravděpodobně malý client_max_body_size. Pro dávkový import složky nastavte alespoň ${IML_PRODUCT_IMPORT_BATCH_MAX_BYTES / 1024 / 1024}M u location pro aplikaci a proveďte reload nginx.`;
  }
  if (status === 404) {
    return "API importu nebylo nalezeno (404) – na serveru pravděpodobně neběží aktuální verze aplikace.";
  }
  if (status === 401) return "Neautorizováno – přihlaste se znovu.";
  if (status === 403) return "Nemáte oprávnění importovat produkty.";
  const plain =
    responseText && !responseText.trimStart().startsWith("{")
      ? responseText.replace(/\s+/g, " ").trim().slice(0, 180)
      : "";
  if (status >= 500) {
    return plain
      ? `Chyba serveru (${status}): ${plain}`
      : `Chyba serveru (${status}) – zkontrolujte logy aplikace (pm2 logs).`;
  }
  if (status > 0) {
    return plain
      ? `Chyba při importu (HTTP ${status}): ${plain}`
      : `Chyba při importu (HTTP ${status})`;
  }
  return "Chyba při importu";
}

export function chunkFolderFilesForBatchUpload(
  files: File[],
  maxBatchBytes: number = IML_PRODUCT_IMPORT_BATCH_MAX_BYTES
): File[][] {
  const batches: File[][] = [];
  let current: File[] = [];
  let currentSize = 0;

  for (const file of files) {
    if (file.size > maxBatchBytes) {
      if (current.length > 0) {
        batches.push(current);
        current = [];
        currentSize = 0;
      }
      batches.push([file]);
      continue;
    }
    if (currentSize + file.size > maxBatchBytes && current.length > 0) {
      batches.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(file);
    currentSize += file.size;
  }

  if (current.length > 0) batches.push(current);
  return batches;
}

export async function createFolderImportSession(
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch("/api/iml/products/import/session", {
    method: "POST",
    signal,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Chyba při vytváření relace importu"
    );
  }
  const sessionId = data.sessionId;
  if (typeof sessionId !== "string" || !sessionId) {
    throw new Error("Server nevrátil identifikátor relace importu");
  }
  return sessionId;
}

export async function cancelFolderImportSession(
  sessionId: string,
  signal?: AbortSignal
): Promise<void> {
  await fetch(
    `/api/iml/products/import/session?sessionId=${encodeURIComponent(sessionId)}`,
    { method: "DELETE", signal }
  );
}

export async function executeFolderImportInBatches(
  files: File[],
  options: {
    mapping: ColumnMappingClient;
    resolutions: { default: string; byCode: Record<string, string> };
    signal?: AbortSignal;
    onSessionCreated?: (sessionId: string) => void;
    onProgress?: (state: UploadProgressState) => void;
    timeoutMs?: number;
  }
): Promise<{
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
  responseText?: string;
}> {
  const batches = chunkFolderFilesForBatchUpload(sortFolderFilesForImport(files));
  const totalBytes = sumFileListBytes(files);
  let sessionId: string | null = null;
  let uploadedBytes = 0;

  try {
    sessionId = await createFolderImportSession(options.signal);
    options.onSessionCreated?.(sessionId);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchBytes = sumFileListBytes(batch);
      const formData = new FormData();
      formData.append("sessionId", sessionId);
      for (const file of batch) {
        formData.append("files", file);
      }
      formData.append("paths", JSON.stringify(getPathsForFiles(batch)));

      const batchBaseBytes = uploadedBytes;
      const {
        ok,
        status,
        data,
        responseText,
      } = await postFormDataWithProgress(
        "/api/iml/products/import/batch",
        formData,
        {
          signal: options.signal,
          timeoutMs: options.timeoutMs ?? 600_000,
          onProgress: (p) => {
            const batchLoaded =
              p.phase === "processing"
                ? batchBytes
                : p.total > 0
                  ? (p.loaded / p.total) * batchBytes
                  : 0;
            const loaded = Math.min(totalBytes, batchBaseBytes + batchLoaded);
            options.onProgress?.({
              phase: p.phase,
              loaded,
              total: totalBytes,
              percent: totalBytes > 0 ? Math.round((loaded / totalBytes) * 100) : 0,
              batchIndex: i + 1,
              batchCount: batches.length,
            });
          },
        }
      );

      if (!ok) {
        if (sessionId) {
          await cancelFolderImportSession(sessionId, options.signal).catch(() => undefined);
          sessionId = null;
        }
        return { ok, status, data, responseText };
      }

      uploadedBytes += batchBytes;
      options.onProgress?.({
        phase: "uploading",
        loaded: uploadedBytes,
        total: totalBytes,
        percent: totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 100,
        batchIndex: i + 1,
        batchCount: batches.length,
      });
    }

    const execForm = new FormData();
    execForm.append("sessionId", sessionId);
    execForm.append("mapping", JSON.stringify(options.mapping));
    execForm.append("resolutions", JSON.stringify(options.resolutions));
    sessionId = null;

    return postFormDataWithProgress("/api/iml/products/import/execute", execForm, {
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? 600_000,
      onProgress: (p) => {
        options.onProgress?.({
          ...p,
          batchIndex: batches.length,
          batchCount: batches.length,
        });
      },
    });
  } catch (e) {
    if (sessionId) {
      await cancelFolderImportSession(sessionId).catch(() => undefined);
    }
    throw e;
  }
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
): Promise<{
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
  responseText: string;
}> {
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
        responseText: xhr.responseText,
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
