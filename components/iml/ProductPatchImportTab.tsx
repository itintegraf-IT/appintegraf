"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import {
  ProductImportMappingPanel,
  type ProductImportMapping,
} from "@/components/iml/ProductImportMapping";

type PatchStep = "upload" | "mapping" | "summary" | "done";

type PatchPreview = {
  foundCount: number;
  notFoundCodes: string[];
  rowCount: number;
};

type PatchResult = {
  updated: number;
  skipped: number;
  notFound: string[];
  errors: string[];
};

export function ProductPatchImportTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<PatchStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ProductImportMapping>({});
  const [preview, setPreview] = useState<PatchPreview | null>(null);
  const [result, setResult] = useState<PatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [dragOver, setDragOver] = useState<string | null>(null);
  const [draggedCol, setDraggedCol] = useState<number | null>(null);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setPreview(null);
    setResult(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const loadPreview = async (f: File, mappingOverride?: ProductImportMapping) => {
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", f);
      if (mappingOverride && Object.keys(mappingOverride).length > 0) {
        formData.append("mapping", JSON.stringify(mappingOverride));
      }
      const res = await fetch("/api/iml/products/import/patch/preview", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba při náhledu");

      setHeaders((data.headers as string[]) ?? []);
      setRows((data.previewRows as string[][]) ?? []);
      if (data.suggestedMapping && !mappingOverride) {
        setMapping(data.suggestedMapping as ProductImportMapping);
      }
      setPreview({
        foundCount: (data.foundCount as number) ?? 0,
        notFoundCodes: (data.notFoundCodes as string[]) ?? [],
        rowCount: (data.rowCount as number) ?? 0,
      });
      setStep("mapping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba při načtení dat");
      setStep("upload");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (f: File | null) => {
    if (!f) {
      reset();
      return;
    }
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      setError("Očekáván soubor CSV nebo Excel (.xlsx, .xls)");
      return;
    }
    setFile(f);
    setResult(null);
    setMapping({});
    await loadPreview(f);
  };

  const onDropTarget = (fieldKey: string) => {
    setDragOver(null);
    if (draggedCol !== null) {
      setMapping((m) => ({ ...m, [fieldKey]: draggedCol }));
      setDraggedCol(null);
    }
  };

  const removeMapping = (fieldKey: string) => {
    setMapping((m) => {
      const next = { ...m };
      delete next[fieldKey];
      return next;
    });
  };

  const hasIgCodeMapping = typeof mapping.ig_code === "number";

  const refreshSummary = async () => {
    if (!file || !hasIgCodeMapping) return;
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(mapping));
      const res = await fetch("/api/iml/products/import/patch/preview", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba při náhledu");
      setPreview({
        foundCount: (data.foundCount as number) ?? 0,
        notFoundCodes: (data.notFoundCodes as string[]) ?? [],
        rowCount: (data.rowCount as number) ?? 0,
      });
      setStep("summary");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba při náhledu");
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!file || !hasIgCodeMapping) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(mapping));
      const res = await fetch("/api/iml/products/import/patch", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba při doplnění");
      setResult({
        updated: (data.updated as number) ?? 0,
        skipped: (data.skipped as number) ?? 0,
        notFound: (data.notFound as string[]) ?? [],
        errors: (data.errors as string[]) ?? [],
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba při doplnění");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {step === "done" && result && (
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-900">
          <p className="font-semibold">Doplnění dokončeno</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Aktualizováno: {result.updated}</li>
            <li>Přeskočeno: {result.skipped}</li>
            {result.notFound.length > 0 && (
              <li>Kódy nenalezeny v DB: {result.notFound.length}</li>
            )}
          </ul>
          {result.notFound.length > 0 && (
            <p className="mt-2 text-xs text-amber-800">
              Nenalezené kódy: {result.notFound.slice(0, 20).join(", ")}
              {result.notFound.length > 20 ? "…" : ""}
            </p>
          )}
          {result.errors.length > 0 && (
            <ul className="mt-2 max-h-32 list-inside list-disc overflow-y-auto text-xs text-amber-800">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-lg border border-green-700 px-3 py-1.5 text-green-900 hover:bg-green-100"
          >
            Nové doplnění
          </button>
        </div>
      )}

      {step === "upload" && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
          <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-gray-600" />
          <p className="mb-2 text-sm font-medium text-gray-800">
            Doplnění existujících produktů z tabulky
          </p>
          <p className="mb-4 text-xs text-gray-500">
            Aktualizuje jen namapovaná a neprázdná pole podle kódu IG. Nové produkty se
            nevytvářejí. Vzor: Jepa+vysek.xlsx (Kód, Nástroj číslo, Zákazník…).
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Načítám…" : "Vybrat CSV / Excel"}
          </button>
          {file && (
            <p className="mt-3 text-sm text-gray-700">
              <strong>{file.name}</strong>
            </p>
          )}
        </div>
      )}

      {(step === "mapping" || step === "summary") && headers.length > 0 && (
        <div className="space-y-6">
          {file && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <strong>{file.name}</strong>
              {preview && (
                <span className="ml-2 text-blue-700">· {preview.rowCount} řádků</span>
              )}
            </div>
          )}

          {step === "mapping" && (
            <>
              <ProductImportMappingPanel
                mode="patch"
                headers={headers}
                rows={rows}
                mapping={mapping}
                dragOver={dragOver}
                draggedCol={draggedCol}
                setDragOver={setDragOver}
                setDraggedCol={setDraggedCol}
                onDropTarget={onDropTarget}
                removeMapping={removeMapping}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void refreshSummary()}
                  disabled={loading || !hasIgCodeMapping}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? "Počítám…" : "Pokračovat – shrnutí"}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Zrušit
                </button>
              </div>
            </>
          )}

          {step === "summary" && preview && (
            <>
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">Shrnutí před spuštěním</h3>
                <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
                  <li>
                    Aktualizuje se přibližně <strong>{preview.foundCount}</strong> řádků s platným
                    doplněním
                  </li>
                  <li>
                    Kódů nenalezeno v databázi: <strong>{preview.notFoundCodes.length}</strong>
                  </li>
                  <li>Celkem řádků v souboru: {preview.rowCount}</li>
                </ul>
                {preview.notFoundCodes.length > 0 && (
                  <p className="mt-3 text-xs text-amber-800">
                    Příklady nenalezených kódů:{" "}
                    {preview.notFoundCodes.slice(0, 10).join(", ")}
                    {preview.notFoundCodes.length > 10 ? "…" : ""}
                  </p>
                )}
                <p className="mt-3 text-xs text-gray-500">
                  Prázdné buňky u namapovaných sloupců nemění příslušná pole. Nenamapované
                  sloupce se ignorují.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleExecute()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {loading ? "Aktualizuji…" : "Spustit doplnění"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("mapping")}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Zpět na mapování
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
