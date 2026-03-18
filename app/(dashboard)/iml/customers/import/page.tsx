"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, FileSpreadsheet, GripVertical } from "lucide-react";
import * as XLSX from "xlsx";

const TARGET_FIELDS = [
  { key: "name", label: "Název zákazníka", required: true },
  { key: "email", label: "E-mail", required: false },
  { key: "phone", label: "Telefon", required: false },
  { key: "contact_person", label: "Kontaktní osoba", required: false },
  { key: "city", label: "Město", required: false },
  { key: "postal_code", label: "PSČ", required: false },
  { key: "country", label: "Země", required: false },
  { key: "billing_address", label: "Fakturační adresa", required: false },
  { key: "shipping_address", label: "Doručovací adresa", required: false },
  { key: "individual_requirements", label: "Individuální požadavky", required: false },
  { key: "customer_note", label: "Poznámka ke klientovi", required: false },
  { key: "allow_under_over_delivery_percent", label: "Povolená odchylka pod-/nadnáklad (%)", required: false },
] as const;

type Mapping = Record<string, number>;

function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const result: string[][] = [];
  for (const line of lines) {
    const parts: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inQ = !inQ;
      else if (!inQ && c === delimiter) {
        parts.push(cur.trim());
        cur = "";
      } else cur += c;
    }
    parts.push(cur.trim());
    result.push(parts);
  }
  return result;
}

export default function ImlCustomersImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [draggedCol, setDraggedCol] = useState<number | null>(null);

  const parseFile = useCallback((f: File) => {
    const ext = f.name.toLowerCase();
    if (ext.endsWith(".xlsx") || ext.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const firstSheet = wb.SheetNames[0];
          const ws = wb.Sheets[firstSheet];
          const arr = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" });
          const matrix = arr as string[][];
          if (matrix.length > 0) {
            setHeaders(matrix[0].map((h, i) => (h ? String(h) : `Sloupec ${i + 1}`)));
            setRows(matrix.slice(1, 21));
          } else {
            setHeaders([]);
            setRows([]);
          }
        } catch (err) {
          setError("Nepodařilo se načíst Excel soubor");
        }
      };
      reader.readAsArrayBuffer(f);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result);
        const matrix = parseCsv(text);
        if (matrix.length > 0) {
          setHeaders(matrix[0].map((h, i) => (h ? String(h) : `Sloupec ${i + 1}`)));
          setRows(matrix.slice(1, 21));
        } else {
          setHeaders([]);
          setRows([]);
        }
      };
      reader.readAsText(f, "UTF-8");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setResult(null);
    setError("");
    setMapping({});
    if (f) parseFile(f);
    else {
      setHeaders([]);
      setRows([]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const f = e.dataTransfer.files?.[0];
    if (f && (f.name.toLowerCase().endsWith(".csv") || f.name.toLowerCase().endsWith(".xlsx") || f.name.toLowerCase().endsWith(".xls"))) {
      setFile(f);
      setResult(null);
      setError("");
      setMapping({});
      parseFile(f);
    } else {
      setError("Podporované formáty: CSV, Excel (.xlsx, .xls)");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver("zone");
  };

  const handleDragLeave = () => setDragOver(null);

  const onDropTarget = (fieldKey: string) => {
    setDragOver(null);
    if (draggedCol !== null) {
      setMapping((m) => ({ ...m, [fieldKey]: draggedCol }));
      setDraggedCol(null);
    }
  };

  const onDragStartCol = (colIndex: number) => setDraggedCol(colIndex);
  const onDragEndCol = () => setDraggedCol(null);

  const removeMapping = (fieldKey: string) => {
    setMapping((m) => {
      const next = { ...m };
      delete next[fieldKey];
      return next;
    });
  };

  const canImport = () => {
    return file && typeof mapping.name === "number" && mapping.name >= 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !canImport()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(mapping));
      const res = await fetch("/api/iml/customers/import", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba při importu");
      setResult({ imported: data.imported, errors: data.errors ?? [] });
      setFile(null);
      setHeaders([]);
      setRows([]);
      setMapping({});
      fileInputRef.current!.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba při importu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import zákazníků z CSV/Excel</h1>
          <p className="mt-1 text-gray-600">
            Nahrajte soubor, zobrazte náhled a přetáhněte sloupce na cílová pole
          </p>
        </div>
        <Link
          href="/iml/imports"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {result && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            Importováno: {result.imported} zákazníků.
            {result.errors.length > 0 && (
              <div className="mt-2 text-amber-700">
                Chyby: {result.errors.slice(0, 5).join("; ")}
                {result.errors.length > 5 && ` (+${result.errors.length - 5})`}
              </div>
            )}
          </div>
        )}

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragOver === "zone"
              ? "border-red-400 bg-red-50"
              : "border-gray-300 bg-gray-50 hover:border-gray-400"
          }`}
        >
          <FileSpreadsheet className="mx-auto mb-2 h-10 w-10 text-gray-500" />
          <p className="mb-2 text-sm font-medium text-gray-700">
            Přetáhněte soubor sem nebo klikněte pro výběr
          </p>
          <p className="mb-4 text-xs text-gray-500">CSV, Excel (.xlsx, .xls)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Vybrat soubor
          </button>
          {file && (
            <p className="mt-2 text-sm text-gray-600">
              <strong>{file.name}</strong>
            </p>
          )}
        </div>

        {headers.length > 0 && (
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-700">
                Mapování sloupců – přetáhněte sloupec ze zdroje na cílové pole
              </h3>
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-500">Sloupce v souboru</p>
                  <div className="flex flex-wrap gap-2">
                    {headers.map((h, i) => (
                      <div
                        key={i}
                        draggable
                        onDragStart={() => onDragStartCol(i)}
                        onDragEnd={onDragEndCol}
                        className={`flex cursor-grab items-center gap-1 rounded-lg border px-3 py-2 text-sm ${
                          draggedCol === i
                            ? "border-red-400 bg-red-50 opacity-80"
                            : "border-gray-300 bg-white hover:border-gray-400"
                        }`}
                      >
                        <GripVertical className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{h}</span>
                        <span className="text-gray-400">({i})</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-500">Cílová pole</p>
                  <div className="space-y-2">
                    {TARGET_FIELDS.map((f) => (
                      <div
                        key={f.key}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOver(f.key);
                        }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={() => onDropTarget(f.key)}
                        className={`flex items-center justify-between rounded-lg border-2 px-3 py-2 ${
                          dragOver === f.key
                            ? "border-red-400 bg-red-50"
                            : mapping[f.key] != null
                              ? "border-green-300 bg-green-50/50"
                              : "border-dashed border-gray-300 bg-gray-50"
                        }`}
                      >
                        <span className="text-sm">
                          {f.label}
                          {f.required && <span className="text-red-500"> *</span>}
                        </span>
                        {mapping[f.key] != null ? (
                          <span className="flex items-center gap-1">
                            <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                              {headers[mapping[f.key]]} ({mapping[f.key]})
                            </span>
                            <button
                              type="button"
                              onClick={() => removeMapping(f.key)}
                              className="text-red-600 hover:text-red-700"
                            >
                              ×
                            </button>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Přetáhněte sloupec</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-700">Náhled dat</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      {headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-medium text-gray-700">
                          {h}
                          {Object.entries(mapping).some(([, v]) => v === i) && (
                            <span className="ml-1 text-green-600">✓</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-gray-100">
                        {headers.map((_, ci) => (
                          <td key={ci} className="max-w-[200px] truncate px-3 py-2">
                            {row[ci] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Zobrazeno prvních {rows.length} řádků
              </p>
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !canImport()}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {loading ? "Importuji…" : "Importovat"}
          </button>
          <Link
            href="/iml/imports"
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </Link>
        </div>
      </form>
    </>
  );
}
