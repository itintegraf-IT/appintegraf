"use client";

import { useEffect, useState } from "react";

type FileRow = {
  id: number;
  file_path: string;
  original_filename: string;
  document_type: string | null;
};

export function EquipmentPhotoGallery({
  equipmentId,
  canWrite,
}: {
  equipmentId: number;
  canWrite: boolean;
}) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = () => {
    fetch(`/api/equipment/${equipmentId}/photos?kind=photo`)
      .then((r) => r.json())
      .then((d) => setFiles(d.files ?? []));
  };

  useEffect(() => {
    load();
  }, [equipmentId]);

  const upload = async (list: FileList | null, docType: string) => {
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
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (fileId: number) => {
    if (!confirm("Smazat fotku?")) return;
    await fetch(`/api/equipment/${equipmentId}/photos?fileId=${fileId}`, {
      method: "DELETE",
    });
    load();
  };

  const setCover = async (fileId: number) => {
    await fetch(`/api/equipment/${equipmentId}/photos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId }),
    });
    load();
  };

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="mb-2 font-semibold">Fotogalerie</h2>
      {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
      {canWrite ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
            {uploading ? "Nahrávám…" : "Vybrat soubory"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => void upload(e.target.files, "photo")}
            />
          </label>
          <label className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
            Vyfotit
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={uploading}
              onChange={(e) => void upload(e.target.files, "photo")}
            />
          </label>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {files.map((f) => (
          <div key={f.id} className="relative overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.file_path} alt={f.original_filename} className="h-28 w-full object-cover" />
            {canWrite ? (
              <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-black/50 p-1 text-[10px] text-white">
                <button type="button" onClick={() => void setCover(f.id)}>
                  Hlavní
                </button>
                <button type="button" onClick={() => void remove(f.id)}>
                  Smazat
                </button>
              </div>
            ) : null}
            {f.document_type === "photo_cover" ? (
              <span className="absolute left-1 top-1 rounded bg-amber-400 px-1 text-[10px]">★</span>
            ) : null}
          </div>
        ))}
      </div>
      {files.length === 0 ? <p className="text-sm text-gray-500">Zatím bez fotek.</p> : null}
    </div>
  );
}
