"use client";

import { useState } from "react";
import { DOCUMENT_TYPES } from "@/lib/materialy/categories";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx";

/** Nahrání na existující materiál (úprava / detail). */
export function MaterialyLiveAttachmentUploader({
  materialId,
  onUploaded,
}: {
  materialId: number;
  onUploaded?: () => void;
}) {
  const [docType, setDocType] = useState("SDS");
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState("");

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFileError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("document_type", docType);
    const res = await fetch(`/api/materialy/${materialId}/files`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setFileError(typeof data.error === "string" ? data.error : "Chyba nahrání");
    } else {
      onUploaded?.();
    }
    setUploading(false);
    e.target.value = "";
  };

  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/80 p-4">
      <h3 className="mb-1 text-sm font-semibold text-gray-900">Dokumenty (BL / SDS, TDS, certifikát…)</h3>
      <p className="mb-3 text-xs text-gray-600">
        Povolené typy: PDF, JPG/PNG, Word, Excel (max. 20 MB). Nahrajte ihned — soubor se uloží k tomuto materiálu.
      </p>
      {fileError ? <p className="mb-2 text-sm text-red-600">{fileError}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
        >
          {DOCUMENT_TYPES.map((t: (typeof DOCUMENT_TYPES)[number]) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
          {uploading ? "Nahrávám…" : "Vybrat soubor"}
          <input type="file" className="hidden" accept={ACCEPT} onChange={(ev) => void onUpload(ev)} disabled={uploading} />
        </label>
      </div>
    </div>
  );
}

/** Volitelný soubor u nového materiálu — nahraje se až po úspěšném vytvoření záznamu. */
export function MaterialyDeferredAttachmentFields({
  docType,
  onDocTypeChange,
  onFileChange,
}: {
  docType: string;
  onDocTypeChange: (v: string) => void;
  onFileChange: (f: File | null) => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/80 p-4">
      <h3 className="mb-1 text-sm font-semibold text-gray-900">Bezpečnostní list a další dokumenty (volitelné)</h3>
      <p className="mb-3 text-xs text-gray-600">
        Po kliknutí na „Vytvořit“ se nejdřív uloží materiál a pak se případně nahraje vybraný soubor (PDF, obrázek,
        Word, Excel, max. 20 MB). Dokumenty můžete doplnit i později na detailu materiálu.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={docType}
          onChange={(e) => onDocTypeChange(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
        >
          {DOCUMENT_TYPES.map((t: (typeof DOCUMENT_TYPES)[number]) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
          Vybrat soubor
          <input
            type="file"
            className="hidden"
            accept={ACCEPT}
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
    </div>
  );
}
