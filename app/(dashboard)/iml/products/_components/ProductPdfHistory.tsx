"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Download, FileText, RotateCcw, Trash2 } from "lucide-react";

/**
 * Přehled historie verzí PDF pro produkt + akce:
 *  - Stáhnout (target=_blank)
 *  - Obnovit jako primární (PATCH /pdf/versions/[v]/primary)
 *  - Smazat ne-primární verzi (DELETE /pdf/versions?version=N)
 *
 * Primární verze se mění uploadem nové (POST /pdf) nebo
 * explicitním "Obnovit jako primární".
 */
type Uploader = { id: number; name: string };
type PdfVersion = {
  id: number;
  version: number;
  filename: string;
  file_size: number;
  mime_type: string;
  is_primary: boolean;
  uploaded_at: string;
  uploader: Uploader;
};

export default function ProductPdfHistory({
  productId,
  canWrite,
}: {
  productId: number;
  canWrite: boolean;
}) {
  const [versions, setVersions] = useState<PdfVersion[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/iml/products/${productId}/pdf/versions`, {
        cache: "no-store",
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? "Chyba při načítání historie");
        return;
      }
      setVersions((d.versions ?? []) as PdfVersion[]);
    } catch {
      setError("Chyba při načítání historie");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePromote = async (v: number) => {
    if (!canWrite) return;
    if (!confirm(`Obnovit verzi ${v} jako primární?`)) return;
    setBusy(true);
    try {
      const r = await fetch(
        `/api/iml/products/${productId}/pdf/versions/${v}/primary`,
        { method: "PATCH" }
      );
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        alert(d.error ?? "Chyba při přepínání primary");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (v: number) => {
    if (!canWrite) return;
    if (!confirm(`Opravdu smazat verzi ${v}? Tato akce je nevratná.`)) return;
    setBusy(true);
    try {
      const r = await fetch(
        `/api/iml/products/${productId}/pdf/versions?version=${v}`,
        { method: "DELETE" }
      );
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        alert(d.error ?? "Chyba při mazání");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Načítám historii verzí…</div>;
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (!versions || versions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        Žádné verze PDF nejsou uloženy. Nahrát PDF lze v editaci produktu.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-600">
          <tr>
            <th className="px-3 py-2 font-medium">Verze</th>
            <th className="px-3 py-2 font-medium">Název souboru</th>
            <th className="px-3 py-2 font-medium text-right">Velikost</th>
            <th className="px-3 py-2 font-medium">Nahrál</th>
            <th className="px-3 py-2 font-medium">Datum</th>
            <th className="px-3 py-2 font-medium text-right">Akce</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => (
            <tr
              key={v.id}
              className={
                "border-t " + (v.is_primary ? "bg-green-50/40" : "hover:bg-gray-50")
              }
            >
              <td className="px-3 py-2 font-mono">
                <span className="inline-flex items-center gap-2">
                  #{v.version}
                  {v.is_primary && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                      title="Aktuálně primární verze"
                    >
                      <Check className="h-3 w-3" />
                      primární
                    </span>
                  )}
                </span>
              </td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-gray-800">
                  <FileText className="h-4 w-4 text-gray-400" />
                  {v.filename}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatBytes(v.file_size)}
              </td>
              <td className="px-3 py-2 text-gray-700">{v.uploader.name}</td>
              <td className="px-3 py-2 text-gray-600">
                {formatDate(v.uploaded_at)}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center justify-end gap-1">
                  <a
                    href={`/api/iml/products/${productId}/pdf?version=${v.version}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded p-1.5 text-gray-600 hover:bg-gray-100"
                    title="Stáhnout / otevřít"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  {canWrite && !v.is_primary && (
                    <>
                      <button
                        type="button"
                        onClick={() => handlePromote(v.version)}
                        disabled={busy}
                        className="rounded p-1.5 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                        title="Obnovit jako primární"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(v.version)}
                        disabled={busy}
                        className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        title="Smazat verzi"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("cs-CZ", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
