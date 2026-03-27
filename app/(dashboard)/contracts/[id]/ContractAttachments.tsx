"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Trash2, FileIcon, ExternalLink, Eye, EyeOff } from "lucide-react";

export type AttachmentRow = {
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
  contractId: number;
  initialFiles: AttachmentRow[];
  canUpload: boolean;
  currentUserId: number;
  isAdmin: boolean;
  createdBy: number;
  responsibleUserId: number | null;
  readOnly: boolean;
};

function canDeleteFile(
  f: AttachmentRow,
  currentUserId: number,
  isAdmin: boolean,
  createdBy: number,
  responsibleUserId: number | null
): boolean {
  if (isAdmin) return true;
  if (f.uploaded_by === currentUserId) return true;
  if (currentUserId === createdBy) return true;
  if (responsibleUserId != null && currentUserId === responsibleUserId) return true;
  return false;
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdfMime(mime: string): boolean {
  return mime.trim().toLowerCase() === "application/pdf";
}

export function ContractAttachments({
  contractId,
  initialFiles,
  canUpload,
  currentUserId,
  isAdmin,
  createdBy,
  responsibleUserId,
  readOnly,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  /** ID přílohy s otevřeným náhledem PDF v aplikaci */
  const [pdfPreviewId, setPdfPreviewId] = useState<number | null>(null);

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/contracts/${contractId}/files`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Nahrání se nezdařilo");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
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
      const res = await fetch(`/api/contracts/${contractId}/files/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Smazání se nezdařilo");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setDeletingId(null);
    }
  }

  const uploadAllowed = canUpload && !readOnly;

  return (
    <div
      className="rounded-xl border bg-card p-4 md:p-6 shadow-sm space-y-4"
      style={{ borderColor: "var(--border)" }}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Přílohy
      </h2>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {uploadAllowed && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
            onChange={onFileSelected}
            disabled={uploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Nahrát soubor
              </>
            )}
          </Button>
          <span className="text-xs text-muted-foreground">
            PDF, Word, Excel, obrázky (max. 20 MB)
          </span>
        </div>
      )}

      {initialFiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">Zatím žádné přílohy.</p>
      ) : (
        <ul className="space-y-3">
          {initialFiles.map((f) => {
            const del =
              !readOnly &&
              canDeleteFile(
                f,
                currentUserId,
                isAdmin,
                createdBy,
                responsibleUserId
              );
            const isPdf = isPdfMime(f.mime_type);
            const previewOpen = isPdf && pdfPreviewId === f.id;
            return (
              <li
                key={f.id}
                className="rounded-lg border text-sm overflow-hidden"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{f.original_filename}</span>
                    <span className="text-muted-foreground shrink-0">
                      ({formatSize(f.file_size)})
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isPdf && (
                      <Button
                        type="button"
                        variant={previewOpen ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() =>
                          setPdfPreviewId((id) => (id === f.id ? null : f.id))
                        }
                        title={
                          previewOpen
                            ? "Skrýt náhled"
                            : "Zobrazit náhled PDF v aplikaci"
                        }
                      >
                        {previewOpen ? (
                          <>
                            <EyeOff className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Skrýt</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Náhled</span>
                          </>
                        )}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" asChild>
                      <a
                        href={f.file_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={isPdf ? "Otevřít v novém okně" : "Stáhnout / otevřít"}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    {del && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={deletingId === f.id}
                        onClick={() => deleteFile(f.id)}
                      >
                        {deletingId === f.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                {previewOpen && (
                  <div
                    className="border-t bg-muted/30 px-2 pb-2 pt-2"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <iframe
                      title={`Náhled: ${f.original_filename}`}
                      src={`${f.file_path}#view=FitH`}
                      className="h-[min(70vh,560px)] w-full rounded-md border bg-background"
                      style={{ borderColor: "var(--border)" }}
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
