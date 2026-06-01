"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.eml,.msg,.mht,.mhtml,application/pdf,image/*,message/rfc822";

type FileRow = {
  id: number;
  original_filename: string;
  file_path: string;
  file_size: number;
  created_at: string;
  users: { first_name: string; last_name: string } | null;
};

export function MaketaFilesPanel({
  maketaId,
  canDelete,
  showUploadHint,
}: {
  maketaId: number;
  canDelete: boolean;
  showUploadHint?: boolean;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

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
    load();
  }, [maketaId]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length) return;

    setError(null);
    setWarnings([]);
    setUploading(true);
    setUploadProgress(`Nahrávám ${selected.length} soubor(ů)…`);

    const fd = new FormData();
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

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-gray-800">Dokumentace ({files.length})</h3>
      <p className="mb-3 text-xs text-gray-500">
        PDF, Word, Excel, obrázky, e-mail (.eml, .msg) · max. 20 MB na soubor · více souborů najednou
      </p>
      {showUploadHint && (
        <p className="mb-2 text-sm text-violet-700">
          Nahrajte podklady pro plotr — můžete vybrat více souborů najednou.
        </p>
      )}
      <input
        type="file"
        multiple
        accept={ACCEPT}
        disabled={uploading}
        onChange={onUpload}
        className="mb-3 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-violet-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-violet-700"
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
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <a
                href={f.file_path}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-violet-600 hover:underline"
              >
                {f.original_filename}
              </a>
              <span className="flex shrink-0 items-center gap-2 text-gray-500">
                {Math.round(f.file_size / 1024)} kB
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onDeleteFile(f.id)}
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
