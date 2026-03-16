"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, FileSpreadsheet } from "lucide-react";

export default function ContactsImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({
    email: 0,
    first_name: 1,
    last_name: 2,
    username: -1,
    phone: -1,
    landline: -1,
    landline2: -1,
    position: -1,
    department_name: -1,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");

  const parseCsv = (text: string): string[][] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const delimiter = lines[0]?.includes(";") ? ";" : ",";
    return lines.map((l) => {
      const parts: string[] = [];
      let cur = "";
      let inQ = false;
      for (let i = 0; i < l.length; i++) {
        const c = l[i];
        if (c === '"') inQ = !inQ;
        else if (!inQ && c === delimiter) {
          parts.push(cur.trim());
          cur = "";
        } else cur += c;
      }
      parts.push(cur.trim());
      return parts;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setResult(null);
    setError("");
    if (!f) {
      setPreview([]);
      setHeaders([]);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      const rows = parseCsv(text);
      setHeaders(rows[0] ?? []);
      setPreview(rows.slice(1, 6));
    };
    reader.readAsText(f, "UTF-8");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Vyberte soubor");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(mapping));
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba při importu");
      setResult({ imported: data.imported, errors: data.errors ?? [] });
      setFile(null);
      setPreview([]);
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
          <h1 className="text-2xl font-bold text-gray-900">Import kontaktů z CSV</h1>
          <p className="mt-1 text-gray-600">Nahrajte CSV soubor a namapujte sloupce</p>
        </div>
        <Link
          href="/contacts"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {result && (
          <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
            Importováno: {result.imported} kontaktů.
            {result.errors.length > 0 && (
              <div className="mt-2 text-amber-700">
                Chyby: {result.errors.slice(0, 5).join("; ")}
                {result.errors.length > 5 && ` (+${result.errors.length - 5})`}
              </div>
            )}
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            <FileSpreadsheet className="mr-1 inline h-4 w-4" /> CSV soubor
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 file:mr-2 file:rounded file:border-0 file:bg-red-50 file:px-3 file:py-1 file:text-red-600"
          />
        </div>

        {headers.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <p className="mb-2 text-sm font-medium text-gray-700">Mapování sloupců (povinné: email, first_name, last_name)</p>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-1 text-left">Pole</th>
                  <th className="px-2 py-1 text-left">Sloupec CSV</th>
                </tr>
              </thead>
              <tbody>
                {["email", "first_name", "last_name", "username", "phone", "landline", "landline2", "position", "department_name"].map((field) => (
                  <tr key={field} className="border-b">
                    <td className="px-2 py-1">{field}</td>
                    <td className="px-2 py-1">
                      <select
                        value={mapping[field] ?? -1}
                        onChange={(e) =>
                          setMapping((m) => ({ ...m, [field]: parseInt(e.target.value, 10) }))
                        }
                        className="rounded border border-gray-300 px-2 py-1"
                      >
                        <option value={-1}>—</option>
                        {headers.map((h, i) => (
                          <option key={i} value={i}>
                            {i}: {h}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-gray-500">Náhled: {preview.length} řádků</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !file}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {loading ? "Importuji…" : "Importovat"}
          </button>
          <Link
            href="/contacts"
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </Link>
        </div>
      </form>
    </>
  );
}
