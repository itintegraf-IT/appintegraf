"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { PaletovkaPreview } from "../paletovky/_components/PaletovkaPreview";
import {
  parsePaletovkaDocumentData,
  type PaletovkaDocumentData,
  type PaletovkaLayoutVariant,
} from "@/lib/stitky/paletovky/types";

type TemplateListItem = {
  id: number;
  name: string;
  layout_variant: string;
  blocks_per_page: number;
  source_filename: string | null;
};

type ImportPreview = {
  name: string;
  layoutVariant: PaletovkaLayoutVariant;
  blocksPerPage: number;
  layoutJson: unknown;
  defaultsJson: PaletovkaDocumentData;
  sourceFilename: string;
  warnings?: string[];
};

export function PaletovkaTemplatesSettings() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [bulkDir, setBulkDir] = useState("");
  const [bulkLimit, setBulkLimit] = useState(50);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedPreview, setExpandedPreview] = useState<{
    data: PaletovkaDocumentData;
    layoutVariant: PaletovkaLayoutVariant;
  } | null>(null);

  const load = () => {
    fetch("/api/stitky/paletovky/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []));
  };

  useEffect(() => {
    load();
  }, []);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/stitky/paletovky/templates/import", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Import selhal");
      const p = json.preview as ImportPreview;
      const defaults = parsePaletovkaDocumentData(p.defaultsJson);
      if (!defaults) throw new Error("Neplatná data z importu");
      setPreview({ ...p, defaultsJson: defaults });
      setName(String(p.name ?? ""));
      setWarnings((p.warnings as string[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/stitky/paletovky/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || preview.name,
          layoutVariant: preview.layoutVariant,
          blocksPerPage: preview.blocksPerPage,
          layoutJson: preview.layoutJson,
          defaultsJson: preview.defaultsJson,
          sourceFilename: preview.sourceFilename,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Uložení selhalo");
      setPreview(null);
      setFile(null);
      setName("");
      setMsg("Šablona uložena");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setBusy(false);
    }
  };

  const togglePreview = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedPreview(null);
      return;
    }
    const res = await fetch(`/api/stitky/paletovky/templates/${id}`);
    const json = await res.json().catch(() => ({}));
    const t = json.template;
    if (!t) return;
    const data = parsePaletovkaDocumentData(t.defaults_json);
    if (!data) return;
    setExpandedId(id);
    setExpandedPreview({
      data,
      layoutVariant: t.layout_variant as PaletovkaLayoutVariant,
    });
  };

  const bulkImport = async () => {
    setBusy(true);
    setBulkResult(null);
    setError(null);
    try {
      const res = await fetch("/api/stitky/paletovky/templates/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dir: bulkDir || undefined, limit: bulkLimit }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Import selhal");
      setBulkResult(`Importováno ${json.imported} / ${json.processed}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="paletovky-sablony" className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="mb-2 text-lg font-semibold text-gray-900">Šablony paletovek</h2>
      <p className="mb-4 text-sm text-gray-600">
        Import vlastních šablon z Excelu a hromadný import ze síťové složky. Výchozí šablony se
        nasadí při deployi (<code className="text-xs">db:paletovka-templates-seed</code>).
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {msg && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          {msg}
        </div>
      )}

      <div className="mb-6 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Import z XLS/XLSX</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            Soubor
            <input
              type="file"
              accept=".xls,.xlsx"
              className="mt-1 block"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            onClick={upload}
            disabled={!file || busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            Načíst
          </button>
        </div>

        {preview && (
          <div className="space-y-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <label className="block text-sm">
              Název šablony
              <input
                className="mt-1 w-full max-w-md rounded border border-gray-300 px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <p className="text-sm text-gray-600">
              Layout: <strong>{preview.layoutVariant}</strong>, bloků:{" "}
              <strong>{preview.blocksPerPage}</strong>
            </p>
            {warnings.length > 0 && (
              <ul className="list-inside list-disc text-sm text-amber-800">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Náhled</p>
              <PaletovkaPreview
                data={preview.defaultsJson}
                layoutVariant={preview.layoutVariant}
              />
            </div>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              Uložit šablonu
            </button>
          </div>
        )}
      </div>

      <div className="mb-6 space-y-3 border-t border-gray-100 pt-6">
        <h3 className="text-sm font-semibold text-gray-800">Hromadný import ze složky</h3>
        <div className="flex flex-wrap gap-3">
          <input
            placeholder="Cesta ke složce (volitelné)"
            className="min-w-[280px] flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
            value={bulkDir}
            onChange={(e) => setBulkDir(e.target.value)}
          />
          <input
            type="number"
            min={1}
            max={500}
            className="w-24 rounded border border-gray-300 px-2 py-2 text-sm"
            value={bulkLimit}
            onChange={(e) => setBulkLimit(Number(e.target.value))}
          />
          <button
            type="button"
            onClick={bulkImport}
            disabled={busy}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Importovat
          </button>
        </div>
        {bulkResult && <p className="text-sm text-gray-700">{bulkResult}</p>}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-800">Katalog šablon ({templates.length})</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2">Název</th>
                <th className="px-3 py-2">Layout</th>
                <th className="px-3 py-2">Bloků</th>
                <th className="px-3 py-2">Zdroj</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                    Žádné šablony
                  </td>
                </tr>
              ) : (
                templates.map((t) => (
                  <Fragment key={t.id}>
                    <tr className="border-b border-gray-50">
                      <td className="px-3 py-2 font-medium">{t.name}</td>
                      <td className="px-3 py-2">{t.layout_variant}</td>
                      <td className="px-3 py-2">{t.blocks_per_page}</td>
                      <td className="px-3 py-2 text-gray-500">{t.source_filename ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="mr-3 text-gray-600 hover:underline"
                          onClick={() => togglePreview(t.id)}
                        >
                          {expandedId === t.id ? "Skrýt" : "Náhled"}
                        </button>
                        <Link
                          href={`/stitky/paletovky/templates/${t.id}/edit`}
                          className="text-red-700 hover:underline"
                        >
                          Upravit
                        </Link>
                      </td>
                    </tr>
                    {expandedId === t.id && expandedPreview && (
                      <tr>
                        <td colSpan={5} className="bg-gray-50 px-3 py-4">
                          <PaletovkaPreview
                            data={expandedPreview.data}
                            layoutVariant={expandedPreview.layoutVariant}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
