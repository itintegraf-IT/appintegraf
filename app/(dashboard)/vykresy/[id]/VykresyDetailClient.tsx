"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Eye,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import {
  getPreviewKind,
  VYKRESY_DOCUMENT_KIND_LABELS,
  type VykresyDocumentKind,
} from "@/lib/vykresy/constants";
import {
  VykresyFilePreviewModal,
  type VykresyPreviewFile,
} from "../_components/VykresyFilePreviewModal";

type FileRow = {
  id: number;
  original_filename: string;
  file_path: string;
  file_size: number;
  document_type: string | null;
  created_at: string;
  users?: { first_name: string; last_name: string };
};

type Item = {
  id: number;
  name: string;
  document_kind: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  departments: { id: number; name: string } | null;
  vykresy_machines: { id: number; name: string } | null;
  users_created_by: { first_name: string; last_name: string };
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function kindLabel(kind: string): string {
  if (kind in VYKRESY_DOCUMENT_KIND_LABELS) {
    return VYKRESY_DOCUMENT_KIND_LABELS[kind as VykresyDocumentKind];
  }
  return kind;
}

export function VykresyDetailClient({
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
  const [fileDeletingId, setFileDeletingId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewFile, setPreviewFile] = useState<VykresyPreviewFile | null>(null);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const [rItem, rFiles] = await Promise.all([
        fetch(`/api/vykresy/${id}`),
        fetch(`/api/vykresy/${id}/files`),
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
      const res = await fetch(`/api/vykresy/${id}/files`, { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? "Nahrání se nezdařilo.");
        return;
      }
      await load();
    } catch {
      setActionError("Chyba při nahrávání.");
    } finally {
      setUploading(false);
    }
  };

  const onDeleteFile = async (fileId: number) => {
    if (!confirm("Smazat tento soubor?")) return;
    setFileDeletingId(fileId);
    setActionError("");
    try {
      const res = await fetch(`/api/vykresy/${id}/files/${fileId}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? "Smazání se nezdařilo.");
        return;
      }
      await load();
    } catch {
      setActionError("Chyba při mazání souboru.");
    } finally {
      setFileDeletingId(null);
    }
  };

  const onDeleteRecord = async () => {
    if (!confirm("Trvale smazat záznam včetně všech souborů?")) return;
    setDeleting(true);
    setActionError("");
    try {
      const res = await fetch(`/api/vykresy/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? "Smazání se nezdařilo.");
        return;
      }
      router.push("/vykresy");
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
        <Link href="/vykresy" className="inline-flex items-center gap-1 text-sm text-gray-600">
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/vykresy"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět na seznam
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{item.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {kindLabel(item.document_kind)}
            {item.departments ? ` · ${item.departments.name}` : ""}
            {item.vykresy_machines ? ` · ${item.vykresy_machines.name}` : ""}
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/vykresy/${id}/edit`}
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
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Metadata</h2>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-gray-500">Typ</dt>
            <dd className="font-medium text-gray-900">{kindLabel(item.document_kind)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Oddělení</dt>
            <dd className="font-medium text-gray-900">{item.departments?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Stroj</dt>
            <dd className="font-medium text-gray-900">
              {item.vykresy_machines?.name ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Vytvořil</dt>
            <dd className="font-medium text-gray-900">
              {item.users_created_by.first_name} {item.users_created_by.last_name}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Popis</dt>
            <dd className="mt-1 whitespace-pre-wrap text-gray-800">
              {item.description?.trim() || "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Soubory</h2>

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
              Přetáhněte soubor sem, nebo{" "}
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
              STL, 3MF, OBJ, STEP, DWG, DXF, PDF, JPG/PNG/WebP/GIF/TIFF · max 50 MB
            </p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".stl,.3mf,.obj,.step,.stp,.iges,.igs,.dwg,.dxf,.pdf,.jpg,.jpeg,.png,.webp,.gif,.tif,.tiff,image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadFile(f);
                e.target.value = "";
              }}
            />
            {uploading && <p className="mt-2 text-gray-500">Nahrávám…</p>}
          </div>
        )}

        {(() => {
          const imageFiles = files.filter(
            (f) => getPreviewKind(f.original_filename) === "image"
          );
          if (imageFiles.length === 0) return null;
          return (
            <div className="mb-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Náhledy obrázků
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {imageFiles.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() =>
                      setPreviewFile({
                        id: f.id,
                        original_filename: f.original_filename,
                        vykresId: id,
                      })
                    }
                    className="group overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-left shadow-sm transition hover:border-red-300 hover:shadow"
                    title={`Zvětšit: ${f.original_filename}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/vykresy/${id}/files/${f.id}?inline=1`}
                      alt={f.original_filename}
                      className="aspect-square w-full object-cover"
                    />
                    <div className="truncate px-2 py-1.5 text-xs text-gray-700 group-hover:text-red-700">
                      {f.original_filename}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {files.length === 0 ? (
          <p className="text-sm text-gray-500">Zatím žádné soubory.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {files.map((f) => {
              const previewKind = getPreviewKind(f.original_filename);
              const canPreview = previewKind === "pdf" || previewKind === "image";
              const openPreview = () =>
                setPreviewFile({
                  id: f.id,
                  original_filename: f.original_filename,
                  vykresId: id,
                });
              return (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div>
                    <button
                      type="button"
                      onClick={openPreview}
                      className="text-left font-medium text-red-700 hover:underline"
                      title="Otevřít náhled"
                    >
                      {f.original_filename}
                    </button>
                    <div className="text-xs text-gray-500">
                      {formatBytes(f.file_size)}
                      {f.document_type ? ` · ${f.document_type.toUpperCase()}` : ""}
                      {f.users
                        ? ` · ${f.users.first_name} ${f.users.last_name}`
                        : ""}
                      {" · "}
                      {new Date(f.created_at).toLocaleString("cs-CZ")}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {canPreview && (
                      <button
                        type="button"
                        onClick={openPreview}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
                      >
                        <Eye className="h-4 w-4" />
                        Náhled
                      </button>
                    )}
                    <a
                      href={`/api/vykresy/${id}/files/${f.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
                    >
                      <Download className="h-4 w-4" />
                      Stáhnout
                    </a>
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => void onDeleteFile(f.id)}
                        disabled={fileDeletingId === f.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        {fileDeletingId === f.id ? "…" : "Smazat"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <VykresyFilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}
