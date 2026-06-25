"use client";

import { useCallback, useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import { HELPDESK_ALLOWED_FORMATS_LABEL } from "@/lib/helpdesk/file-constants";

const ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.webp,.gif,.txt,.log,.csv,.zip,.doc,.docx,.xls,.xlsx,application/pdf,image/*,text/plain";

export type HelpdeskFileRow = {
  id: number;
  original_filename: string;
  file_path: string;
  file_size: number;
  created_at: string;
  users: { first_name: string; last_name: string } | null;
};

function filesApiUrl(ticketId: number, commentId?: number): string {
  if (commentId != null) {
    return `/api/helpdesk/tickets/${ticketId}/comments/${commentId}/files`;
  }
  return `/api/helpdesk/tickets/${ticketId}/files`;
}

function deleteApiUrl(ticketId: number, fileId: number, commentId?: number): string {
  if (commentId != null) {
    return `/api/helpdesk/tickets/${ticketId}/comments/${commentId}/files/${fileId}`;
  }
  return `/api/helpdesk/tickets/${ticketId}/files/${fileId}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function HelpdeskAttachmentsPanel({
  ticketId,
  commentId,
  canUpload,
  canDelete,
  compact = false,
  title,
}: {
  ticketId: number;
  commentId?: number;
  canUpload: boolean;
  canDelete: boolean;
  compact?: boolean;
  title?: string;
}) {
  const [files, setFiles] = useState<HelpdeskFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(filesApiUrl(ticketId, commentId));
      const data = await res.json();
      if (res.ok) setFiles(data.files ?? []);
    } finally {
      setLoading(false);
    }
  }, [ticketId, commentId]);

  useEffect(() => {
    load();
  }, [load]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch(filesApiUrl(ticketId, commentId), { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Nahrání se nezdařilo");
      } else {
        await load();
      }
    } catch {
      setError("Síťová chyba");
    }

    setUploading(false);
    e.target.value = "";
  };

  const onDelete = async (fileId: number) => {
    if (!confirm("Smazat přílohu?")) return;
    const res = await fetch(deleteApiUrl(ticketId, fileId, commentId), { method: "DELETE" });
    if (res.ok) await load();
  };

  const heading =
    title ?? (commentId != null ? "Přílohy komentáře" : `Přílohy ticketu (${files.length})`);

  if (compact && files.length === 0 && !canUpload && !loading) {
    return null;
  }

  return (
    <div className={compact ? "mt-2" : "rounded-lg border border-gray-200 bg-gray-50 p-3"}>
      {!compact && (
        <h4 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-800">
          <Paperclip className="h-4 w-4" />
          {heading}
        </h4>
      )}
      {!compact && (
        <p className="mb-2 text-xs text-gray-500">
          {HELPDESK_ALLOWED_FORMATS_LABEL} · max. 20 MB · přidávejte po jednom souboru
        </p>
      )}
      {canUpload && (
        <input
          type="file"
          accept={ACCEPT}
          disabled={uploading}
          onChange={onUpload}
          className={`block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-red-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-red-700 ${compact ? "mb-1" : "mb-2"}`}
        />
      )}
      {uploading && <p className="mb-1 text-xs text-gray-600">Nahrávám…</p>}
      {error && <p className="mb-1 text-xs text-red-600">{error}</p>}
      {loading ? (
        <p className="text-xs text-gray-500">Načítám přílohy…</p>
      ) : files.length === 0 ? (
        !compact && <p className="text-xs text-gray-500">Zatím žádné přílohy.</p>
      ) : (
        <ul className="space-y-1">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <a
                href={f.file_path}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-red-600 hover:underline"
              >
                {f.original_filename}
              </a>
              <span className="flex shrink-0 items-center gap-2 text-gray-500">
                {formatSize(f.file_size)}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(f.id)}
                    className="text-red-600 hover:underline"
                  >
                    Smazat
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Fronta souborů před vytvořením ticketu / odesláním komentáře. */
export function HelpdeskPendingFilesPicker({
  files,
  onChange,
  label = "Přílohy",
}: {
  files: File[];
  onChange: (files: File[]) => void;
  label?: string;
}) {
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange([...files, file]);
    e.target.value = "";
  };

  const remove = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <p className="mb-2 text-xs text-gray-500">
        {HELPDESK_ALLOWED_FORMATS_LABEL} · max. 20 MB · přidávejte po jednom souboru
      </p>
      <input
        type="file"
        accept={ACCEPT}
        onChange={onPick}
        className="mb-2 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-red-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-red-700"
      />
      {files.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2">
              <span className="truncate text-gray-800">{f.name}</span>
              <span className="flex shrink-0 items-center gap-2 text-gray-500">
                {formatSize(f.size)}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-red-600 hover:underline"
                >
                  Odebrat
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export async function uploadHelpdeskTicketFiles(ticketId: number, files: File[]): Promise<string[]> {
  const errors: string[] = [];
  for (const file of files) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/helpdesk/tickets/${ticketId}/files`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      errors.push(typeof data.error === "string" ? data.error : `Chyba: ${file.name}`);
    }
  }
  return errors;
}

export async function uploadHelpdeskCommentFiles(
  ticketId: number,
  commentId: number,
  files: File[]
): Promise<string[]> {
  const errors: string[] = [];
  for (const file of files) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(
      `/api/helpdesk/tickets/${ticketId}/comments/${commentId}/files`,
      { method: "POST", body: fd }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      errors.push(typeof data.error === "string" ? data.error : `Chyba: ${file.name}`);
    }
  }
  return errors;
}
