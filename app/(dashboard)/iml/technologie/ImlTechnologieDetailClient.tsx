"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Eye } from "lucide-react";
import { VykresyPdfPreview } from "@/app/(dashboard)/vykresy/_components/VykresyPdfPreview";

type FileRow = {
  id: number;
  original_filename: string;
  file_size: number;
  created_at: string;
};

type Item = {
  id: number;
  code: string;
  name: string;
  format_text: string | null;
  is_iml?: boolean;
  note: string | null;
  preview_updated_at: string | null;
  technologie_sheet_types: { id: number; name: string } | null;
  technologie_sheet_sizes: { id: number; name: string } | null;
  shared_machines: { id: number; name: string } | null;
  users_created_by: { first_name: string; last_name: string };
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImlTechnologieDetailClient({ id }: { id: number }) {
  const [item, setItem] = useState<Item | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loadError, setLoadError] = useState("");
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
      if (dItem.item && dItem.item.is_iml === false) {
        setItem(null);
        setFiles([]);
        setLoadError("Tato technologie není označená jako IML.");
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

  if (loadError) {
    return (
      <div>
        <Link
          href="/iml/technologie"
          className="inline-flex items-center gap-1 text-sm text-gray-600"
        >
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
      <div>
        <Link
          href="/iml/technologie"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět na seznam
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          <span className="font-mono text-lg text-gray-600">{item.code}</span>
          <span className="mx-2 text-gray-300">·</span>
          {item.name}
          <span className="ml-2 align-middle rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
            IML
          </span>
        </h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Metadata</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
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
            <dd className="mt-1 whitespace-pre-wrap text-gray-800">
              {item.note?.trim() || "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">PDF rozkres</h2>
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
              </div>
            </div>

            {item.preview_updated_at && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Miniatura
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
