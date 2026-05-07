"use client";

import { useState, useEffect, useCallback } from "react";

type Row = {
  order_number: string;
  pantone_code: string;
  pantone_name: string | null;
  product_label: string;
  customer_name: string;
  pieces: number;
  labels_per_sheet: number | null;
  coverage_pct: number;
  consumption_kg: number | null;
  missing_labels_per_sheet: boolean;
};

type Summary = {
  total_kg: number;
  incomplete_row_count: number;
  row_count: number;
};

const GROUP_OPTIONS = [
  { value: "product", label: "Detail (řádek × objednávka)" },
  { value: "customer", label: "Seskupit: zákazník + produkt + Pantone" },
  { value: "pantone_only", label: "Seskupit: pouze Pantone" },
] as const;

export function ImlPantoneReportClient() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 12);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [statuses, setStatuses] = useState("nová,potvrzená,odeslaná");
  const [codes, setCodes] = useState("");
  const [groupBy, setGroupBy] = useState<(typeof GROUP_OPTIONS)[number]["value"]>("product");
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchJson = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    params.set("statuses", statuses);
    params.set("group_by", groupBy);
    if (codes.trim()) params.set("codes", codes.trim());
    params.set("format", "json");
    const res = await fetch(`/api/iml/reports/pantone?${params}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Chyba načítání");
      setRows([]);
      setSummary(null);
      setLoading(false);
      return;
    }
    setRows(data.rows ?? []);
    setSummary(data.summary ?? null);
    setLoading(false);
  }, [from, to, statuses, groupBy, codes]);

  useEffect(() => {
    const t = setTimeout(() => fetchJson(), 400);
    return () => clearTimeout(t);
  }, [fetchJson]);

  const exportUrl = (format: "csv" | "xlsx") => {
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    params.set("statuses", statuses);
    params.set("group_by", groupBy);
    if (codes.trim()) params.set("codes", codes.trim());
    params.set("format", format);
    return `/api/iml/reports/pantone?${params}`;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Filtry</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Od</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Do</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Stavy objednávek</label>
            <input
              type="text"
              value={statuses}
              onChange={(e) => setStatuses(e.target.value)}
              placeholder="nová,potvrzená,odeslaná"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Pantone kódy (volitelně, čárka)
            </label>
            <input
              type="text"
              value={codes}
              onChange={(e) => setCodes(e.target.value)}
              placeholder="např. PANTONE 485 C, P 1234"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Seskupení</label>
            <select
              value={groupBy}
              onChange={(e) =>
                setGroupBy(e.target.value as (typeof GROUP_OPTIONS)[number]["value"])
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              {GROUP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={exportUrl("csv")}
            className="inline-flex rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Export CSV
          </a>
          <a
            href={exportUrl("xlsx")}
            className="inline-flex rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Export Excel
          </a>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {summary && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm text-sm">
          <span className="font-medium">Součet kg (pouze řádky s doplněným počtem etiket/TA): </span>
          <span className="text-lg font-bold text-gray-900">{summary.total_kg}</span>
          <span className="ml-4 text-gray-600">
            Neúplných řádků: {summary.incomplete_row_count} / {summary.row_count}
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Objednávka</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Pantone</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Produkt</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Zákazník</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Ks</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Etiket/TA</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Pokrytí %</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">kg</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                  Načítání…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                  Žádná data
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={`${r.order_number}-${r.pantone_code}-${r.product_label}-${i}`}
                  className={`border-b border-gray-100 ${r.missing_labels_per_sheet ? "bg-amber-50" : ""}`}
                  title={
                    r.missing_labels_per_sheet
                      ? "Doplňte u produktu počet etiket na tiskový arch pro přesný výpočet"
                      : undefined
                  }
                >
                  <td className="px-3 py-2 font-mono">{r.order_number}</td>
                  <td className="px-3 py-2">{r.pantone_code}</td>
                  <td className="px-3 py-2">{r.product_label}</td>
                  <td className="px-3 py-2">{r.customer_name}</td>
                  <td className="px-3 py-2 text-right">{r.pieces}</td>
                  <td className="px-3 py-2 text-right">{r.labels_per_sheet ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{r.coverage_pct}</td>
                  <td className="px-3 py-2 text-right">
                    {r.consumption_kg != null ? r.consumption_kg : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
