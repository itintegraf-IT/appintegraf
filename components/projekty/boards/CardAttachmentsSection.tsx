"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/projekty/ui/button";
import { ConfirmDialog } from "@/components/projekty/ui/confirm-dialog";
import { EmptyState } from "@/components/projekty/ui/empty-state";
import { Skeleton } from "@/components/projekty/ui/skeleton";
import { Paperclip, Upload, Trash2, FileText } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { toast } from "sonner";

type Attachment = {
  id: string;
  parentType: "CARD";
  parentId: string;
  fileName: string;
  size: number;
  mime: string;
  uploadedBy: number | null;
  createdAt: string;
};

const MAX_BYTES = 25 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CardAttachmentsSection({
  cardId,
  currentUserId,
}: {
  cardId: string;
  currentUserId: number;
}) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setStatus("loading");
    fetch(`/api/projekty/attachments?parentType=CARD&parentId=${cardId}`)
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("fetch failed")),
      )
      .then((data: { attachments: Attachment[] }) => {
        setItems(data.attachments);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, [cardId]);

  useEffect(() => load(), [load]);

  async function handleUpload(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error(`Soubor je větší než ${formatSize(MAX_BYTES)}.`);
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("parentType", "CARD");
      form.append("parentId", cardId);
      const res = await fetch("/api/projekty/attachments", { method: "POST", body: form });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Upload selhal.");
        return;
      }
      const { attachment } = (await res.json()) as { attachment: Attachment };
      setItems((prev) => [attachment, ...prev]);
    } catch {
      toast.error("Upload selhal (chyba sítě).");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/projekty/attachments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Smazání selhalo.");
      return;
    }
    setItems((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-tight text-foreground">
        <Paperclip className="size-4" /> Přílohy ({items.length})
      </h3>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void handleUpload(file);
        }}
        className={`rounded border-2 border-dashed p-4 text-center text-sm transition-colors ${
          dragging ? "border-primary bg-primary/10" : "border-muted-foreground/30"
        }`}
      >
        <Upload className="mx-auto mb-2 size-5 text-muted-foreground" />
        <p className="text-muted-foreground">
          Přetáhni soubor sem nebo{" "}
          <button
            className="text-primary underline"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            vyber
          </button>
        </p>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
            e.target.value = "";
          }}
        />
        <p className="mt-1 text-xs text-muted-foreground">Max {formatSize(MAX_BYTES)}</p>
      </div>

      {status === "loading" ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      ) : null}
      {status === "error" ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>Přílohy se nepodařilo načíst.</span>
          <Button variant="outline" size="sm" onClick={load}>
            Zkusit znovu
          </Button>
        </div>
      ) : null}
      {status === "ok" && items.length === 0 ? (
        <EmptyState
          icon={Paperclip}
          title="Zatím žádné přílohy"
          description="Přetáhni soubor do pole výše, nebo klikni na „vyber“."
          className="py-6"
        />
      ) : null}
      <ul className="space-y-1">
        {items.map((a) => {
          const canDelete = a.uploadedBy === currentUserId;
          return (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/40"
            >
              <FileText className="size-4 text-muted-foreground" />
              <a
                href={`/api/projekty/attachments/${a.id}/download`}
                className="flex-1 truncate text-sm hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {a.fileName}
              </a>
              <span className="text-xs text-muted-foreground">{formatSize(a.size)}</span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(a.createdAt), "d. M. yyyy", { locale: cs })}
              </span>
              {canDelete ? (
                <ConfirmDialog
                  trigger={
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      aria-label="Smazat přílohu"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  }
                  title={`Smazat přílohu „${a.fileName}"?`}
                  destructive
                  confirmLabel="Smazat"
                  onConfirm={() => handleDelete(a.id)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
