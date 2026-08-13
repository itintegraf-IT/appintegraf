"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [documentType, setDocumentType] = useState<MaketyFileKind | "">("");

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

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length) return;

    if (!documentType) {
      setError("Nejdřív vyberte typ souboru (softproof / tisková data / jiné)");
      e.target.value = "";
      return;
    }

    setError(null);
    setWarnings([]);
    setUploading(true);
    setUploadProgress(`Nahrávám ${selected.length} soubor(ů)…`);

    const fd = new FormData();
    fd.append("document_type", documentType);
    for (let i = 0; i < selected.length; i++) {
      fd.append("file", selected[i]);
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
    e.target.value = "";
  };

  const onDeleteFile = async (fileId: number) => {
    if (!confirm("Smazat soubor?")) return;
    const res = await fetch(`/api/makety/${maketaId}/files/${fileId}`, { method: "DELETE" });
    if (res.ok) {
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

      <input
        type="file"
        multiple
        accept={ACCEPT}
        disabled={uploading || !documentType}
        onChange={onUpload}
        className="mb-3 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-violet-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-violet-700 disabled:opacity-50"
      />
      {uploadProgress && <p className="mb-2 text-sm text-violet-700">{uploadProgress}</p>}
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
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
          {files.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-2 py-2 text-sm"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <a
                  href={`/api/makety/${maketaId}/files/${f.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-medium text-violet-600 hover:underline"
                >
                  {f.original_filename}
                </a>
                <div className="flex flex-wrap items-center gap-2">
                  {canChangeType ? (
                    <select
                      value={f.document_type && MAKETY_FILE_KINDS.includes(f.document_type as MaketyFileKind) ? f.document_type : ""}
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
              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDeleteFile(f.id)}
                  className="shrink-0 text-sm text-red-600 hover:underline"
                >
                  Smazat
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
