"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Eye, Pencil, Trash2, Upload } from "lucide-react";
import { VykresyPdfPreview } from "@/app/(dashboard)/vykresy/_components/VykresyPdfPreview";

type FileRow = {
  id: number;
  original_filename: string;
  file_size: number;
  created_at: string;
  users?: { first_name: string; last_name: string };
};

type Item = {
  id: number;
  code: string;
  name: string;
  format_text: string | null;
  note: string | null;
  preview_updated_at: string | null;
  updated_at: string;
  technologie_sheet_types: { id: number; name: string } | null;
  technologie_sheet_sizes: { id: number; name: string } | null;
  shared_machines: { id: number; name: string; machine_group?: string } | null;
  users_created_by: { first_name: string; last_name: string };
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function TechnologieDetailClient({
  id,
  canWrite,
}: {
  id: number;
  canWrite: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fileDeleting, setFileDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const [rItem, rFiles] = await Promise.all([
        fetch(`/api/technologie/${id}`),
        fetch(`/api/technologie/${id}/files`),
      ]);
      const dItem = (await rItem.json().catch(() => ({}))) as {
        item?: Item;
        error?: string;
      };
      const dFiles = (await rFiles.json().catch(() => ({}))) as { files?: FileRow[] };
      if (!rItem.ok) {
        setItem(null);
        setFiles([]);
        setLoadError(dItem.error ?? "Záznam se nepodařilo načíst.");
        return;
      }
      setItem(dItem.item ?? null);
      setFiles(rFiles.ok && Array.isArray(dFiles.files) ? dFiles.files : []);
    } catch {
      setLoadError("Chyba při načítání.");
      setItem(null);
      setFiles([]);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setActionError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/technologie/${id}/files`, { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        thumbnailCreated?: boolean;
      };
      if (!res.ok) {
        setActionError(data.error ?? "Nahrání se nezdařilo.");
        return;
      }
      if (data.thumbnailCreated === false) {
        setActionError(
          "PDF bylo uloženo, ale náhled se nepodařilo vygenerovat (zkontrolujte @napi-rs/canvas na serveru)."
        );
      }
      await load();
      router.refresh();
    } catch {
      setActionError("Chyba při nahrávání.");
    } finally {
      setUploading(false);
    }
  };

  const onDeletePdf = async () => {
    const pdf = files[0];
    if (!pdf) return;
    if (!confirm("Smazat PDF rozkresu včetně náhledu?")) return;
    setFileDeleting(true);
    setActionError("");
    try {
      const res = await fetch(`/api/technologie/${id}/files/${pdf.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? "Smazání se nezdařilo.");
        return;
      }
      setShowPdfPreview(false);
      await load();
      router.refresh();
    } catch {
      setActionError("Chyba při mazání souboru.");
    } finally {
      setFileDeleting(false);
    }
  };

  const onDeleteRecord = async () => {
    if (!confirm("Trvale smazat rozkres včetně PDF a náhledu?")) return;
    setDeleting(true);
    setActionError("");
    try {
      const res = await fetch(`/api/technologie/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? "Smazání se nezdařilo.");
        return;
      }
      router.push("/technologie");
      router.refresh();
    } catch {
      setActionError("Chyba při mazání.");
    } finally {
      setDeleting(false);
    }
  };

  if (loadError) {
    return (
      <div>
        <Link href="/technologie" className="inline-flex items-center gap-1 text-sm text-gray-600">
          <ArrowLeft className="h-4 w-4" />
          Zpět na seznam
        </Link>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {loadError}
        </div>
      </div>
    );
  }

  if (!item) {
    return <div className="p-8 text-center text-gray-500">Načítání…</div>;
  }

  const pdfFile = files[0];
  const previewQ = item.preview_updated_at
    ? `?t=${encodeURIComponent(item.preview_updated_at)}`
    : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/technologie"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět na seznam
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            <span className="font-mono text-lg text-gray-600">{item.code}</span>
            <span className="mx-2 text-gray-300">·</span>
            {item.name}
          </h1>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/technologie/${id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4" />
              Upravit
            </Link>
            <button
              type="button"
              onClick={() => void onDeleteRecord()}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "Mažu…" : "Smazat"}
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {actionError}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Metadata</h2>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-gray-500">Typ archu</dt>
            <dd className="font-medium text-gray-900">
              {item.technologie_sheet_types?.name ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Tiskový stroj</dt>
            <dd className="font-medium text-gray-900">
              {item.shared_machines?.name ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Formát</dt>
            <dd className="font-medium text-gray-900">{item.format_text ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Velikost archu</dt>
            <dd className="font-medium text-gray-900">
              {item.technologie_sheet_sizes?.name ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Vytvořil</dt>
            <dd className="font-medium text-gray-900">
              {item.users_created_by.first_name} {item.users_created_by.last_name}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Poznámka</dt>
            <dd className="mt-1 whitespace-pre-wrap text-gray-800">{item.note?.trim() || "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">PDF rozkres</h2>

        {canWrite && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void uploadFile(f);
            }}
            className={`mb-4 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm ${
              dragOver ? "border-red-400 bg-red-50" : "border-gray-300 bg-gray-50"
            }`}
          >
            <Upload className="mx-auto mb-2 h-6 w-6 text-gray-400" />
            <p className="text-gray-600">
              Přetáhněte PDF sem, nebo{" "}
              <button
                type="button"
                className="font-medium text-red-700 underline"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                vyberte ze zařízení
              </button>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Pouze PDF · max 50 MB · náhled se vygeneruje z 1. stránky
            </p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadFile(f);
                e.target.value = "";
              }}
            />
            {uploading && <p className="mt-2 text-gray-500">Nahrávám…</p>}
          </div>
        )}

        {!pdfFile ? (
          <p className="text-sm text-gray-500">Zatím není nahráno PDF.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <p className="font-medium text-gray-900">{pdfFile.original_filename}</p>
                <p className="text-xs text-gray-500">
                  {formatBytes(pdfFile.file_size)} ·{" "}
                  {new Date(pdfFile.created_at).toLocaleString("cs-CZ")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowPdfPreview((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
                >
                  <Eye className="h-4 w-4" />
                  {showPdfPreview ? "Skrýt náhled" : "Náhled PDF"}
                </button>
                <a
                  href={`/api/technologie/${id}/files/${pdfFile.id}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
                >
                  <Download className="h-4 w-4" />
                  Stáhnout
                </a>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => void onDeletePdf()}
                    disabled={fileDeleting}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {fileDeleting ? "…" : "Smazat PDF"}
                  </button>
                )}
              </div>
            </div>

            {item.preview_updated_at && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Miniatura (seznam)
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/technologie/${id}/preview${previewQ}`}
                  alt="Náhled rozkresu"
                  className="max-h-40 rounded border border-gray-200 bg-white"
                />
              </div>
            )}

            {showPdfPreview && (
              <VykresyPdfPreview
                title={pdfFile.original_filename}
                src={`/api/technologie/${id}/files/${pdfFile.id}?inline=1`}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
