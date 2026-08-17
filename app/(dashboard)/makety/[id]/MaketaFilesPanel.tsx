"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Download, GripVertical, Upload } from "lucide-react";
import {
  MAKETY_FILE_KINDS,
  maketyFileKindBadgeClass,
  maketyFileKindLabel,
  type MaketyFileKind,
} from "@/lib/makety-file-kind";

const ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.eml,.msg,.mht,.mhtml,application/pdf,image/*,message/rfc822";

type FileRow = {
  id: number;
  original_filename: string;
  file_path: string;
  file_size: number;
  document_type: string | null;
  created_at: string;
  users: { first_name: string; last_name: string } | null;
};

function fileApiUrl(maketaId: number, fileId: number, download = false): string {
  const base = `/api/makety/${maketaId}/files/${fileId}`;
  return download ? `${base}?download=1` : base;
}

export function MaketaFilesPanel({
  maketaId,
  canDelete,
  showUploadHint,
  uploadHintText = "Nahrajte podklady — můžete vybrat více souborů najednou.",
  canChangeType = true,
}: {
  maketaId: number;
  canDelete: boolean;
  showUploadHint?: boolean;
  uploadHintText?: string;
  canChangeType?: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragFileCache = useRef<Map<number, File>>(new Map());
  const prefetchingRef = useRef<Set<number>>(new Set());
  const dragZoneCounter = useRef(0);

  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [documentType, setDocumentType] = useState<MaketyFileKind | "">("");
  const [dragOver, setDragOver] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [dragReadyIds, setDragReadyIds] = useState<Set<number>>(() => new Set());
  const [prefetchingIds, setPrefetchingIds] = useState<Set<number>>(() => new Set());
  const [dragHint, setDragHint] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/makety/${maketaId}/files`);
      const data = await res.json();
      if (res.ok) setFiles(data.files ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [maketaId]);

  const uploadFiles = async (selected: File[]) => {
    if (!selected.length) return;

    if (!documentType) {
      setError("Nejdřív vyberte typ souboru (softproof / tisková data / jiné)");
      return;
    }

    setError(null);
    setWarnings([]);
    setUploading(true);
    setUploadProgress(`Nahrávám ${selected.length} soubor(ů)…`);

    const fd = new FormData();
    fd.append("document_type", documentType);
    for (const file of selected) {
      fd.append("file", file);
    }

    try {
      const res = await fetch(`/api/makety/${maketaId}/files`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));

      if (!res.ok && !data.partial) {
        setError(typeof data.error === "string" ? data.error : "Nahrání se nezdařilo");
      } else {
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          setWarnings(data.errors as string[]);
        }
        if (data.partial && typeof data.error === "string") {
          setWarnings((prev) => [...prev, data.error]);
        }
        await load();
        router.refresh();
      }
    } catch {
      setError("Síťová chyba");
    }

    setUploading(false);
    setUploadProgress(null);
  };

  const onFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length) return;
    await uploadFiles(Array.from(selected));
    e.target.value = "";
  };

  const onDropFiles = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragZoneCounter.current = 0;
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) await uploadFiles(dropped);
  };

  const onDragEnterZone = (e: React.DragEvent) => {
    e.preventDefault();
    dragZoneCounter.current += 1;
    setDragOver(true);
  };

  const onDragLeaveZone = (e: React.DragEvent) => {
    e.preventDefault();
    dragZoneCounter.current -= 1;
    if (dragZoneCounter.current <= 0) {
      dragZoneCounter.current = 0;
      setDragOver(false);
    }
  };

  const onDeleteFile = async (fileId: number) => {
    if (!confirm("Smazat soubor?")) return;
    const res = await fetch(`/api/makety/${maketaId}/files/${fileId}`, { method: "DELETE" });
    if (res.ok) {
      dragFileCache.current.delete(fileId);
      await load();
      router.refresh();
    }
  };

  const onChangeType = async (fileId: number, next: MaketyFileKind) => {
    const res = await fetch(`/api/makety/${maketaId}/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_type: next }),
    });
    if (res.ok) {
      await load();
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Změna typu se nezdařila");
    }
  };

  const prefetchForDrag = (f: FileRow) => {
    if (dragFileCache.current.has(f.id) || prefetchingRef.current.has(f.id)) return;
    prefetchingRef.current.add(f.id);
    setPrefetchingIds((prev) => new Set(prev).add(f.id));
    void fetch(fileApiUrl(maketaId, f.id, true), { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.blob();
      })
      .then((blob) => {
        dragFileCache.current.set(
          f.id,
          new File([blob], f.original_filename, {
            type: "application/octet-stream",
          })
        );
        setDragReadyIds((prev) => new Set(prev).add(f.id));
      })
      .catch(() => {
        setDragHint("Soubor se nepodařilo připravit k přetažení — použijte Stáhnout.");
      })
      .finally(() => {
        prefetchingRef.current.delete(f.id);
        setPrefetchingIds((prev) => {
          const next = new Set(prev);
          next.delete(f.id);
          return next;
        });
      });
  };

  const onDragStartFile = (e: React.DragEvent, f: FileRow) => {
    const cached = dragFileCache.current.get(f.id);
    if (!cached) {
      e.preventDefault();
      setDragHint("Počkejte na načtení souboru, pak přetáhněte znovu.");
      prefetchForDrag(f);
      return;
    }
    e.dataTransfer.clearData();
    e.dataTransfer.items.add(cached);
    e.dataTransfer.effectAllowed = "copy";
    setDragHint(null);
  };

  const onDownloadFile = async (f: FileRow) => {
    setDownloadingId(f.id);
    setError(null);
    try {
      const res = await fetch(fileApiUrl(maketaId, f.id, true), { credentials: "same-origin" });
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = f.original_filename;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError("Stažení se nezdařilo");
    } finally {
      setDownloadingId(null);
    }
  };

  const uploadDisabled = uploading || !documentType;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-gray-800">Dokumentace ({files.length})</h3>
      <p className="mb-3 text-xs text-gray-500">
        PDF, Word, Excel, obrázky, e-mail (.eml, .msg) · max. 20 MB na soubor · více souborů najednou
      </p>
      {showUploadHint && (
        <p className="mb-2 text-sm text-violet-700">{uploadHintText}</p>
      )}

      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Typ souboru <span className="text-red-600">*</span>
        </label>
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value as MaketyFileKind | "")}
          disabled={uploading}
          className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">— vyberte před nahráním —</option>
          {MAKETY_FILE_KINDS.map((k) => (
            <option key={k} value={k}>
              {maketyFileKindLabel(k)}
            </option>
          ))}
        </select>
      </div>

      <div
        onDragEnter={onDragEnterZone}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={onDragLeaveZone}
        onDrop={onDropFiles}
        className={`mb-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          uploadDisabled
            ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-70"
            : dragOver
              ? "border-violet-400 bg-violet-50"
              : "border-gray-300 bg-gray-50 hover:border-gray-400"
        }`}
      >
        <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
        <p className="text-sm text-gray-700">
          {documentType
            ? "Přetáhněte soubory sem nebo "
            : "Nejdřív zvolte typ souboru, pak přetáhněte soubory sem nebo "}
          <button
            type="button"
            disabled={uploadDisabled}
            onClick={() => fileInputRef.current?.click()}
            className="font-medium text-violet-700 underline disabled:cursor-not-allowed disabled:no-underline disabled:text-gray-400"
          >
            vyberte soubory
          </button>
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {documentType
            ? "Podporované formáty: PDF, Word, Excel, obrázky, e-mail"
            : "Typ souboru je povinný před nahráním"}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT}
          disabled={uploadDisabled}
          onChange={onFileInputChange}
          className="hidden"
        />
      </div>

      {uploadProgress && <p className="mb-2 text-sm text-violet-700">{uploadProgress}</p>}
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {dragHint && <p className="mb-2 text-sm text-amber-800">{dragHint}</p>}
      {warnings.length > 0 && (
        <ul className="mb-2 list-inside list-disc text-sm text-amber-800">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      {loading ? (
        <p className="text-sm text-gray-500">Načítám soubory…</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-gray-500">Zatím žádné přílohy.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => {
            const ready = dragReadyIds.has(f.id);
            const waiting = prefetchingIds.has(f.id);
            return (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-2 py-2 text-sm"
              onMouseEnter={() => prefetchForDrag(f)}
              onPointerEnter={() => prefetchForDrag(f)}
            >
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <span
                  draggable={ready}
                  role="button"
                  tabIndex={0}
                  title={
                    ready
                      ? "Přetáhněte na plochu pro stažení souboru"
                      : waiting
                        ? "Načítám soubor…"
                        : "Najetím se soubor připraví ke stažení na plochu"
                  }
                  aria-label={`Přetáhnout ${f.original_filename} na plochu`}
                  onDragStart={(e) => onDragStartFile(e, f)}
                  className={`mt-0.5 shrink-0 rounded p-0.5 ${
                    ready
                      ? "cursor-grab text-gray-500 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing"
                      : "cursor-wait text-gray-300"
                  }`}
                >
                  <GripVertical className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <a
                    href={fileApiUrl(maketaId, f.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all font-medium text-violet-600 hover:underline"
                  >
                    {f.original_filename}
                  </a>
                  <div className="flex flex-wrap items-center gap-2">
                    {canChangeType ? (
                      <select
                        value={
                          f.document_type &&
                          MAKETY_FILE_KINDS.includes(f.document_type as MaketyFileKind)
                            ? f.document_type
                            : ""
                        }
                        onChange={(e) => {
                          const v = e.target.value as MaketyFileKind;
                          if (v) void onChangeType(f.id, v);
                        }}
                        className="rounded border border-gray-300 px-1.5 py-0.5 text-xs"
                        aria-label="Typ souboru"
                      >
                        {!f.document_type && <option value="">Bez typu</option>}
                        {MAKETY_FILE_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {maketyFileKindLabel(k)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${maketyFileKindBadgeClass(f.document_type)}`}
                      >
                        {maketyFileKindLabel(f.document_type)}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">{Math.round(f.file_size / 1024)} kB</span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void onDownloadFile(f)}
                  disabled={downloadingId === f.id}
                  className="inline-flex items-center gap-1 text-sm text-violet-700 hover:underline disabled:opacity-50"
                  title="Stáhnout soubor"
                >
                  <Download className="h-3.5 w-3.5" />
                  {downloadingId === f.id ? "…" : "Stáhnout"}
                </button>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onDeleteFile(f.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Smazat
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
