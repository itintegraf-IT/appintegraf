"use client";

import { useState, useEffect } from "react";
import type { InputHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { DOCUMENT_TYPES } from "@/lib/materialy/categories";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx";
export const MAX_MATERIAL_DEFERRED_FILES = 50;

export type PendingMaterialAttachment = {
  id: string;
  file: File;
  documentType: string;
};

function newAttachmentId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Nahrání na existující materiál (úprava / detail). */
export function MaterialyLiveAttachmentUploader({
  materialId,
  onUploaded,
}: {
  materialId: number;
  onUploaded?: () => void;
}) {
  const router = useRouter();
  const [docType, setDocType] = useState("SDS");
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [uploadOk, setUploadOk] = useState("");

  const uploadOne = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("document_type", docType);
    const res = await fetch(`/api/materialy/${materialId}/files`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Chyba nahrání");
    }
  };

  const onUploadFiles = async (list: FileList | File[] | null) => {
    if (!list || list.length === 0) return;
    const files = Array.from(list).slice(0, MAX_MATERIAL_DEFERRED_FILES);
    setUploading(true);
    setFileError("");
    setUploadOk("");
    try {
      for (const file of files) {
        await uploadOne(file);
      }
      setUploadOk(
        files.length === 1 ? "Soubor byl nahrán." : `Nahráno ${files.length} souborů.`
      );
      onUploaded?.();
      router.refresh();
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "Chyba nahrání");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/80 p-4">
      <h3 className="mb-1 text-sm font-semibold text-gray-900">Dokumenty (BL / SDS, TDS, certifikát…)</h3>
      <p className="mb-3 text-xs text-gray-600">
        Povolené typy: PDF, JPG/PNG, Word, Excel (max. 20 MB na soubor). Můžete vybrat více souborů najednou.
      </p>
      {fileError ? <p className="mb-2 text-sm text-red-600">{fileError}</p> : null}
      {uploadOk ? (
        <p className="mb-2 text-sm text-green-700" role="status">
          {uploadOk}
        </p>
      ) : null}
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
          {uploading ? "Nahrávám…" : "Vybrat soubor(y)"}
          <input
            type="file"
            className="hidden"
            accept={ACCEPT}
            multiple
            onChange={(ev) => void onUploadFiles(ev.target.files)}
            disabled={uploading}
          />
        </label>
      </div>
    </div>
  );
}

/** Volitelné soubory u nového materiálu — nahrají se až po úspěšném vytvoření záznamu; u každého řádku lze zvolit typ dokumentu. */
export function MaterialyDeferredAttachmentFields({
  compact = false,
  defaultTypeForNew,
  onDefaultTypeForNewChange,
  attachments,
  onAttachmentsChange,
}: {
  defaultTypeForNew: string;
  onDefaultTypeForNewChange: (v: string) => void;
  attachments: PendingMaterialAttachment[];
  onAttachmentsChange: (next: PendingMaterialAttachment[]) => void;
  compact?: boolean;
}) {
  const [bulkType, setBulkType] = useState(defaultTypeForNew);

  useEffect(() => {
    setBulkType(defaultTypeForNew);
  }, [defaultTypeForNew]);

  const addFromList = (list: FileList | null) => {
    if (!list?.length) return;
    const incoming = Array.from(list);
    const room = MAX_MATERIAL_DEFERRED_FILES - attachments.length;
    if (room <= 0) return;
    const slice = incoming.slice(0, room);
    const newRows: PendingMaterialAttachment[] = slice.map((file) => ({
      id: newAttachmentId(),
      file,
      documentType: defaultTypeForNew,
    }));
    onAttachmentsChange([...attachments, ...newRows]);
  };

  const applyBulkType = () => {
    if (attachments.length === 0) return;
    onAttachmentsChange(attachments.map((a) => ({ ...a, documentType: bulkType })));
  };

  const atLimit = attachments.length >= MAX_MATERIAL_DEFERRED_FILES;
  const singleAddLabel = attachments.length === 0 ? "Přidat soubor" : "Přidat další soubor";

  const selectCls = compact
    ? "max-w-[11rem] rounded border border-gray-300 px-1.5 py-1 text-xs"
    : "max-w-[14rem] rounded-lg border border-gray-300 px-2 py-1.5 text-sm";

  return (
    <div
      className={
        compact
          ? "rounded-md border border-dashed border-gray-300 bg-gray-50/80 p-2"
          : "rounded-lg border border-dashed border-gray-300 bg-gray-50/80 p-4"
      }
    >
      <h3 className={compact ? "mb-1 text-xs font-semibold text-gray-800" : "mb-1 text-sm font-semibold text-gray-900"}>
        Dokumenty (volitelné)
      </h3>
      {compact ? (
        <p className="mb-2 text-xs text-gray-500">
          PDF, obrázek, Office — max. 20 MB na soubor. Začněte „Přidat soubor“; po prvním souboru se zobrazí „Přidat další
          soubor“. Alternativně „Více souborů…“ nebo složka (Chrome / Edge). U každého řádku zvolte typ (SDS, TDS, …). Max.{" "}
          {MAX_MATERIAL_DEFERRED_FILES} souborů.
        </p>
      ) : (
        <p className="mb-3 text-xs text-gray-600">
          Po kliknutí na „Vytvořit“ se nejdřív uloží materiál a pak se nahrají vybrané soubory. Dokumenty můžete doplnit i
          později na detailu materiálu.
        </p>
      )}

      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <div>
          <label className="mb-0.5 block text-xs font-medium text-gray-600">Typ pro nově přidané soubory</label>
          <select
            value={defaultTypeForNew}
            onChange={(e) => onDefaultTypeForNewChange(e.target.value)}
            className={selectCls}
          >
            {DOCUMENT_TYPES.map((t: (typeof DOCUMENT_TYPES)[number]) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label
            className={`cursor-pointer rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 ${atLimit ? "pointer-events-none opacity-50" : ""}`}
          >
            {singleAddLabel}
            <input
              type="file"
              className="hidden"
              accept={ACCEPT}
              disabled={atLimit}
              onChange={(e) => {
                addFromList(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <label
            className={`cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 ${atLimit ? "pointer-events-none opacity-50" : ""}`}
          >
            Více souborů…
            <input
              type="file"
              className="hidden"
              accept={ACCEPT}
              multiple
              disabled={atLimit}
              onChange={(e) => {
                addFromList(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <label
            className={`cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 ${atLimit ? "pointer-events-none opacity-50" : ""}`}
          >
            Složka…
            <input
              type="file"
              className="hidden"
              multiple
              disabled={atLimit}
              {...({ webkitdirectory: "" } as InputHTMLAttributes<HTMLInputElement>)}
              onChange={(e) => {
                addFromList(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {atLimit ? (
        <p className="mb-2 text-xs font-medium text-amber-800">Byl dosažen limit {MAX_MATERIAL_DEFERRED_FILES} souborů.</p>
      ) : (
        <p className={`mb-2 text-gray-600 ${compact ? "text-xs" : "text-sm"}`}>
          Po přidání souboru se zobrazí řádek s typem dokumentu.{" "}
          <span className="whitespace-nowrap">Materiál uložíte tlačítkem „Vytvořit“ pod formulářem</span> (i bez příloh).
        </p>
      )}

      {attachments.length > 0 ? (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-2">
            <span className={compact ? "text-xs text-gray-600" : "text-sm text-gray-600"}>Nastavit všem:</span>
            <select
              value={bulkType}
              onChange={(e) => setBulkType(e.target.value)}
              className={selectCls}
            >
              {DOCUMENT_TYPES.map((t: (typeof DOCUMENT_TYPES)[number]) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyBulkType}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50 sm:text-sm"
            >
              Použít na všechny řádky
            </button>
          </div>

          <ul className={`divide-y divide-gray-200 rounded-md border border-gray-200 bg-white ${compact ? "text-xs" : "text-sm"}`}>
            {attachments.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 px-2 py-1.5 sm:gap-3">
                <span className="min-w-0 flex-1 truncate font-medium text-gray-800" title={row.file.name}>
                  {row.file.name}
                </span>
                <select
                  value={row.documentType}
                  onChange={(e) =>
                    onAttachmentsChange(
                      attachments.map((a) =>
                        a.id === row.id ? { ...a, documentType: e.target.value } : a
                      )
                    )
                  }
                  className={selectCls}
                >
                  {DOCUMENT_TYPES.map((t: (typeof DOCUMENT_TYPES)[number]) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onAttachmentsChange(attachments.filter((a) => a.id !== row.id))}
                  className="shrink-0 text-xs text-red-600 hover:underline sm:text-sm"
                >
                  Odebrat
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
