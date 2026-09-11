"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, ExternalLink, FileIcon, Loader2, Trash2, Upload } from "lucide-react";
import {
  IML_DIE_CUT_MAX_FILES,
  IML_DIE_CUT_MAX_MB,
} from "@/lib/iml-die-cut-upload-constants";

export type DieCutAttachmentRow = {
  id: number;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: number;
  created_at: string;
  users: { first_name: string; last_name: string } | null;
};

type Props = {
  dieCutId: number;
  canUpload: boolean;
  onCountChange?: (count: number) => void;
};

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
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
}): DieCutAttachmentRow {
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

function fileApiUrl(dieCutId: number, fileId: number, download = false): string {
  const base = `/api/iml/die-cuts/${dieCutId}/files/${fileId}`;
  return download ? `${base}?download=1` : base;
}

export function DieCutAttachments({ dieCutId, canUpload, onCountChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;
  const [files, setFiles] = useState<DieCutAttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/iml/die-cuts/${dieCutId}/files`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Načtení příloh se nezdařilo");
      const mapped = (data.files ?? []).map(mapFileRow);
      setFiles(mapped);
      onCountChangeRef.current?.(mapped.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba při načítání");
    } finally {
      setLoading(false);
    }
  }, [dieCutId]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError("");
    setUploading(true);
    try {
      let remaining = IML_DIE_CUT_MAX_FILES - files.length;
      for (let i = 0; i < fileList.length; i++) {
        if (remaining <= 0) {
          throw new Error(`Maximálně ${IML_DIE_CUT_MAX_FILES} přílohy na výsek.`);
        }
        const file = fileList[i];
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/iml/die-cuts/${dieCutId}/files`, {
          method: "POST",
          body: fd,
        });
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
      const res = await fetch(`/api/iml/die-cuts/${dieCutId}/files/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Smazání se nezdařilo");
      const next = files.filter((f) => f.id !== id);
      setFiles(next);
      onCountChangeRef.current?.(next.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setDeletingId(null);
    }
  }

  const canAddMore = files.length < IML_DIE_CUT_MAX_FILES;

  return (
    <div className="space-y-3 sm:col-span-2">
      <div>
        <p className="mb-1 text-sm font-medium text-gray-700">Přílohy (CAD / PDF)</p>
        <p className="text-xs text-gray-500">
          Max. {IML_DIE_CUT_MAX_FILES} · PDF / DXF / DWG · {IML_DIE_CUT_MAX_MB} MB / soubor
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
            accept=".pdf,.dxf,.dwg,application/pdf"
            onChange={(e) => uploadFiles(e.target.files)}
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
            const isPdf = f.mime_type.toLowerCase().includes("pdf");
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
                  <a
                    href={fileApiUrl(dieCutId, f.id, !isPdf)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                    title={isPdf ? "Otevřít" : "Stáhnout"}
                  >
                    {isPdf ? (
                      <ExternalLink className="h-4 w-4" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
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
    </div>
  );
}
