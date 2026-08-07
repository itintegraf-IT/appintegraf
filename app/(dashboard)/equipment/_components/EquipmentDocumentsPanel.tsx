"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import {
  EQUIPMENT_ATTACHMENT_DOC_TYPES,
  equipmentAttachmentTypeLabel,
  type EquipmentAttachmentDocType,
} from "@/lib/equipment/upload";

type FileRow = {
  id: number;
  file_path: string;
  original_filename: string;
  document_type: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
  users?: { first_name: string; last_name: string } | null;
};

function formatBytes(n: number | null): string {
  if (n == null || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function EquipmentDocumentsPanel({
  equipmentId,
  canWrite,
}: {
  equipmentId: number;
  canWrite: boolean;
}) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<EquipmentAttachmentDocType>("invoice");

  const load = () => {
    fetch(`/api/equipment/${equipmentId}/photos?kind=attachment`)
      .then((r) => r.json())
      .then((d) => setFiles(d.files ?? []))
      .catch(() => setError("Chyba načtení dokumentů"));
  };

  useEffect(() => {
    load();
  }, [equipmentId]);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(list)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("document_type", docType);
        const res = await fetch(`/api/equipment/${equipmentId}/photos`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? "Chyba nahrání");
        }
      }
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba nahrání");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (fileId: number, name: string) => {
    if (!confirm(`Smazat dokument „${name}"?`)) return;
    const res = await fetch(`/api/equipment/${equipmentId}/photos?fileId=${fileId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Chyba mazání");
      return;
    }
    load();
  };

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="mb-1 font-semibold">Dokumenty</h2>
      <p className="mb-3 text-sm text-gray-500">
        Faktury, dodací listy, záruční listy a další přílohy (PDF, obrázky, Word).
      </p>
      {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}

      {canWrite ? (
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Typ dokumentu</label>
            <select
              className="rounded-lg border bg-white px-3 py-2 text-sm"
              value={docType}
              onChange={(e) => setDocType(e.target.value as EquipmentAttachmentDocType)}
            >
              {EQUIPMENT_ATTACHMENT_DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
            <Upload className="h-4 w-4" />
            {uploading ? "Nahrávám…" : "Nahrát soubor"}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                void upload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      ) : null}

      {files.length === 0 ? (
        <p className="text-sm text-gray-500">Zatím bez dokumentů.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
              <FileText className="h-5 w-5 shrink-0 text-red-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-900">{f.original_filename}</p>
                <p className="text-xs text-gray-500">
                  {equipmentAttachmentTypeLabel(f.document_type)}
                  {f.file_size ? ` · ${formatBytes(f.file_size)}` : ""}
                  {f.users
                    ? ` · ${f.users.last_name} ${f.users.first_name}`
                    : ""}
                  {f.created_at
                    ? ` · ${new Date(f.created_at).toLocaleDateString("cs-CZ")}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={f.file_path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-gray-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Otevřít
                </a>
                {canWrite ? (
                  <button
                    type="button"
                    onClick={() => void remove(f.id, f.original_filename)}
                    className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Smazat
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
