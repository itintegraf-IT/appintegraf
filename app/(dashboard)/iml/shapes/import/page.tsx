"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SHAPE_IMPORT_FIELDS, autoMapShapeColumns } from "@/lib/iml/shapes-import";

export default function ShapesImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const previewReady = file != null && headers.length > 0;

  const fieldOptions = useMemo(
    () =>
      headers.map((h, i) => (
        <option key={`${h}-${i}`} value={i}>
          {h || `(sloupec ${i + 1})`}
        </option>
      )),
    [headers]
  );

  const previewHeaders = async (f: File) => {
    setError(null);
    setResult(null);
    setWarnings(null);
    const formData = new FormData();
    formData.set("file", f);
    formData.set("preview", "1");
    const res = await fetch("/api/iml/shapes/import", { method: "POST", body: formData });
    const data = await res.json().catch(() => ({}));
    if (data.headers && Array.isArray(data.headers)) {
      setHeaders(data.headers);
      setMapping(data.autoMapping ?? autoMapShapeColumns(data.headers));
      return;
    }
    setError(data.error ?? "Nelze načíst hlavičky. Zkontrolujte soubor.");
  };

  const onFile = async (f: File | null) => {
    setFile(f);
    setHeaders([]);
    setMapping({});
    if (f) await previewHeaders(f);
  };

  const runImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setWarnings(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("mapping", JSON.stringify(mapping));
      const res = await fetch("/api/iml/shapes/import", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Import selhal");
        if (data.headers) {
          setHeaders(data.headers);
          setMapping(data.autoMapping ?? mapping);
        }
        return;
      }
      setResult(
        `Hotovo: tvary vytvořeno ${data.created}, aktualizováno ${data.updated}` +
          `, nástroje nové ${data.toolsCreated ?? 0}` +
          `, vazby PRIMARY ${data.assignmentsUpserted ?? 0}` +
          `, zákazníci ${data.customersLinked ?? 0}` +
          (data.errors?.length ? `, chyb ${data.errors.length}` : "") +
          (data.warnings?.length ? `, varování ${data.warnings.length}` : "")
      );
      if (data.errors?.length) {
        setError(data.errors.slice(0, 30).join("\n"));
      }
      if (data.warnings?.length) {
        setWarnings(data.warnings.slice(0, 30).join("\n"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/iml/shapes" className="text-sm text-violet-700 hover:underline">
          ← Tvary
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Import tvarů a nástrojů
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Excel/CSV (např. Oprava CUP/LID): kód tvaru, nástroj, formát Š×V, typ, technologie,
          zákazníci. Upsert tvarů + PRIMARY vazba na nástroj.
        </p>
      </div>

      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />

      {previewReady && (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-800">Mapování sloupců</p>
          {SHAPE_IMPORT_FIELDS.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {f.label}
                {f.required ? " *" : ""}
              </span>
              <select
                className="rounded border px-2 py-1"
                value={mapping[f.key] ?? ""}
                onChange={(e) =>
                  setMapping((m) => {
                    const next = { ...m };
                    if (e.target.value === "") delete next[f.key];
                    else next[f.key] = Number(e.target.value);
                    return next;
                  })
                }
              >
                <option value="">—</option>
                {fieldOptions}
              </select>
            </label>
          ))}
          <button
            type="button"
            disabled={loading}
            onClick={() => void runImport()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {loading ? "Importuji…" : "Spustit import"}
          </button>
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {result}
        </div>
      )}
      {warnings && (
        <pre className="whitespace-pre-wrap rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {warnings}
        </pre>
      )}
      {error && (
        <pre className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </pre>
      )}
    </div>
  );
}
