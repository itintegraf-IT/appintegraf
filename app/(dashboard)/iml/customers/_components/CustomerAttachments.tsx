"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Eye,
  EyeOff,
  FileIcon,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";

export type CustomerAttachmentRow = {
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
  customerId: number;
  initialFiles: CustomerAttachmentRow[];
  canUpload: boolean;
  currentUserId: number;
  isAdmin: boolean;
  /** Po uploadu/smazání – aktualizace stavu v nadřazeném formuláři (bez full page refresh). */
  onFilesChange?: (files: CustomerAttachmentRow[]) => void;
};

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdfMime(mime: string): boolean {
  return mime.trim().toLowerCase() === "application/pdf";
}

function canDeleteFile(
  f: CustomerAttachmentRow,
  currentUserId: number,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  return f.uploaded_by === currentUserId;
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
}): CustomerAttachmentRow {
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

export default function CustomerAttachments({
  customerId,
  initialFiles,
  canUpload,
  currentUserId,
  isAdmin,
  onFilesChange,
}: Props) {
  const router = useRouter();
  const files = initialFiles;
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pdfPreviewId, setPdfPreviewId] = useState<number | null>(null);

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError("");
    setUploading(true);
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/iml/customers/${customerId}/files`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data.error ?? `Nahrání „${file.name}" se nezdařilo`
          );
        }
      }
      if (onFilesChange) {
        const listRes = await fetch(`/api/iml/customers/${customerId}/files`);
        if (listRes.ok) {
          const listData = await listRes.json();
          onFilesChange((listData.files ?? []).map(mapFileRow));
        }
      } else {
        router.refresh();
      }
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
      const res = await fetch(`/api/iml/customers/${customerId}/files/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Smazání se nezdařilo");
      if (onFilesChange) {
        onFilesChange(files.filter((f) => f.id !== id));
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {canUpload && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
          <span className="text-xs text-gray-500">
            PDF, Word, Excel – lze vybrat více souborů (max. 20 MB / soubor)
          </span>
        </div>
      )}

      {files.length === 0 ? (
        <p className="text-sm text-gray-500">Zatím žádné přílohy.</p>
      ) : (
        <ul className="space-y-3">
          {files.map((f) => {
            const del = canUpload && canDeleteFile(f, currentUserId, isAdmin);
            const isPdf = isPdfMime(f.mime_type);
            const previewOpen = isPdf && pdfPreviewId === f.id;
            const uploaderName = f.users
              ? `${f.users.first_name} ${f.users.last_name}`.trim()
              : null;

            return (
              <li
                key={f.id}
                className="overflow-hidden rounded-lg border border-gray-200 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileIcon className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="truncate font-medium">{f.original_filename}</span>
                    <span className="shrink-0 text-gray-500">
                      ({formatSize(f.file_size)})
                    </span>
                    {uploaderName && (
                      <span className="hidden shrink-0 text-gray-400 sm:inline">
                        · {uploaderName}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {isPdf && (
                      <button
                        type="button"
                        onClick={() =>
                          setPdfPreviewId((id) => (id === f.id ? null : f.id))
                        }
                        className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                        title={previewOpen ? "Skrýt náhled" : "Náhled PDF"}
                      >
                        {previewOpen ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    <a
                      href={f.file_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                      title="Otevřít / stáhnout"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    {del && (
                      <button
                        type="button"
                        disabled={deletingId === f.id}
                        onClick={() => deleteFile(f.id)}
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
                </div>
                {previewOpen && (
                  <div className="border-t border-gray-100 bg-gray-50 px-2 pb-2 pt-2">
                    <iframe
                      title={`Náhled: ${f.original_filename}`}
                      src={`${f.file_path}#view=FitH`}
                      className="h-[min(70vh,560px)] w-full rounded-md border border-gray-200 bg-white"
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
