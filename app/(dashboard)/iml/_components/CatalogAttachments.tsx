"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Eye, FileIcon, Loader2, Trash2, Upload, X } from "lucide-react";
import {
  IML_CATALOG_ATTACHMENT_MAX_FILES,
  IML_CATALOG_ATTACHMENT_MAX_MB,
} from "@/lib/iml-catalog-attachment-constants";

export type CatalogAttachmentRow = {
  id: number;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: number;
  created_at: string;
  users: { first_name: string; last_name: string } | null;
};

type Kind = "shape" | "tool";

type Props = {
  kind: Kind;
  recordId: number;
  canUpload?: boolean;
  title?: string;
};

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function baseApi(kind: Kind, recordId: number): string {
  return kind === "shape"
    ? `/api/iml/shapes/${recordId}/files`
    : `/api/iml/tools/${recordId}/files`;
}

function fileUrl(kind: Kind, recordId: number, fileId: number, download = false): string {
  const base = `${baseApi(kind, recordId)}/${fileId}`;
  return download ? `${base}?download=1` : base;
}

function mapFileRow(f: {
  id: number;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: number;
  created_at: string | Date;
  users: { first_name: string; last_name: string } | null;
}): CatalogAttachmentRow {
  return {
    id: f.id,
    original_filename: f.original_filename,
    file_path: f.file_path,
    file_size: f.file_size,
    mime_type: f.mime_type,
    uploaded_by: f.uploaded_by,
    created_at:
      typeof f.created_at === "string"
        ? f.created_at
        : new Date(f.created_at).toISOString(),
    users: f.users,
  };
}

function previewKind(mime: string): "pdf" | "image" | null {
  const m = mime.toLowerCase();
  if (m.includes("pdf")) return "pdf";
  if (m.startsWith("image/")) return "image";
  return null;
}

export function CatalogAttachments({
  kind,
  recordId,
  canUpload = true,
  title = "Přílohy (PDF / JPG / CAD)",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<CatalogAttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [preview, setPreview] = useState<CatalogAttachmentRow | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(baseApi(kind, recordId));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Načtení příloh se nezdařilo");
      setFiles((data.files ?? []).map(mapFileRow));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba při načítání");
    } finally {
      setLoading(false);
    }
  }, [kind, recordId]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError("");
    setUploading(true);
    try {
      let remaining = IML_CATALOG_ATTACHMENT_MAX_FILES - files.length;
      for (let i = 0; i < fileList.length; i++) {
        if (remaining <= 0) {
          throw new Error(`Maximálně ${IML_CATALOG_ATTACHMENT_MAX_FILES} příloh.`);
        }
        const file = fileList[i];
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(baseApi(kind, recordId), { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error ?? `Nahrání „${file.name}" se nezdařilo`);
        }
        remaining -= 1;
      }
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba při nahrávání");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function deleteFile(id: number) {
    if (!confirm("Smazat tento soubor?")) return;
    setError("");
    setDeletingId(id);
    try {
      const res = await fetch(`${baseApi(kind, recordId)}/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Smazání se nezdařilo");
      setFiles((prev) => prev.filter((f) => f.id !== id));
      if (preview?.id === id) setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setDeletingId(null);
    }
  }

  const canAddMore = files.length < IML_CATALOG_ATTACHMENT_MAX_FILES;
  const previewType = preview ? previewKind(preview.mime_type) : null;

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-sm font-medium text-gray-700">{title}</p>
        <p className="text-xs text-gray-500">
          Max. {IML_CATALOG_ATTACHMENT_MAX_FILES} · PDF / JPG / PNG / DXF / DWG / CAD ·{" "}
          {IML_CATALOG_ATTACHMENT_MAX_MB} MB / soubor
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {canUpload && canAddMore && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.dxf,.dwg,.cad,application/pdf,image/jpeg,image/png"
            onChange={(e) => void uploadFiles(e.target.files)}
            disabled={uploading}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Nahrát soubor
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Načítám přílohy…</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-gray-500">Zatím žádné přílohy.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => {
            const uploaderName = f.users
              ? `${f.users.first_name} ${f.users.last_name}`.trim()
              : null;
            const pk = previewKind(f.mime_type);
            return (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileIcon className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="truncate font-medium">{f.original_filename}</span>
                  <span className="shrink-0 text-gray-500">({formatSize(f.file_size)})</span>
                  {uploaderName && (
                    <span className="hidden shrink-0 text-gray-400 sm:inline">
                      · {uploaderName}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {pk && (
                    <button
                      type="button"
                      onClick={() => setPreview(f)}
                      className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                      title="Náhled"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  <a
                    href={fileUrl(kind, recordId, f.id, !pk)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                    title={pk ? "Otevřít" : "Stáhnout"}
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  {canUpload && (
                    <button
                      type="button"
                      disabled={deletingId === f.id}
                      onClick={() => void deleteFile(f.id)}
                      className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      title="Smazat"
                    >
                      {deletingId === f.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {preview && previewType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="truncate text-sm font-medium text-gray-900">
                {preview.original_filename}
              </p>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-gray-100 p-2">
              {previewType === "pdf" ? (
                <iframe
                  title={preview.original_filename}
                  src={fileUrl(kind, recordId, preview.id)}
                  className="h-[70vh] w-full rounded border border-gray-200 bg-white"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fileUrl(kind, recordId, preview.id)}
                  alt={preview.original_filename}
                  className="mx-auto max-h-[70vh] max-w-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
