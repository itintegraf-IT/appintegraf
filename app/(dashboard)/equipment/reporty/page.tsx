"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Summary = {
  count: number;
  totalValue: number;
  byCategory: Record<string, { count: number; value: number }>;
  byRoom: Record<string, { count: number; value: number }>;
  warrantySoon: number;
  withoutRoom: number;
};

export default function ReportyClient() {
  const [scope, setScope] = useState("all");
  const [scopeId, setScopeId] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [cats, setCats] = useState<{ id: number; name: string }[]>([]);
  const [rooms, setRooms] = useState<{ id: number; name: string; code: string }[]>([]);

  const load = () => {
    const q = new URLSearchParams({ scope });
    if (scopeId) q.set("scope_id", scopeId);
    fetch(`/api/equipment/reports/summary?${q}`)
      .then((r) => r.json())
      .then(setSummary);
  };

  useEffect(() => {
    fetch("/api/equipment/categories")
      .then((r) => r.json())
      .then((d) => setCats(Array.isArray(d) ? d : []));
    fetch("/api/equipment/rooms")
      .then((r) => r.json())
      .then((d) => setRooms(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, scopeId]);

  const csvUrl = () => {
    const q = new URLSearchParams({ scope, format: "csv" });
    if (scopeId) q.set("scope_id", scopeId);
    return `/api/equipment/reports/summary?${q}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reporty a sestavy</h1>
          <p className="text-gray-600">Hodnoty majetku dle rozsahu</p>
        </div>
        <Link href="/equipment" className="rounded-lg border px-3 py-2 text-sm">
          Zpět
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="rounded border px-3 py-2"
          value={scope}
          onChange={(e) => {
            setScope(e.target.value);
            setScopeId("");
          }}
        >
          <option value="all">Kompletní</option>
          <option value="category">Skupina</option>
          <option value="room">Místnost</option>
        </select>
        {scope === "category" ? (
          <select
            className="rounded border px-3 py-2"
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
          >
            <option value="">—</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
        {scope === "room" ? (
          <select
            className="rounded border px-3 py-2"
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
          >
            <option value="">—</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} – {r.name}
              </option>
            ))}
          </select>
        ) : null}
        <a href={csvUrl()} className="rounded-lg bg-red-600 px-4 py-2 text-white">
          Export CSV
        </a>
      </div>

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-500">Položek</p>
              <p className="text-2xl font-bold">{summary.count}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-500">Celková hodnota</p>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat("cs-CZ").format(summary.totalValue)} Kč
              </p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-500">Záruka do 30 dní</p>
              <p className="text-2xl font-bold">{summary.warrantySoon}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-500">Bez místnosti</p>
              <p className="text-2xl font-bold">{summary.withoutRoom}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-white p-4">
              <h2 className="mb-2 font-semibold">Podle skupiny</h2>
              <ul className="text-sm space-y-1">
                {Object.entries(summary.byCategory).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span>
                      {v.count} ks / {new Intl.NumberFormat("cs-CZ").format(v.value)} Kč
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <h2 className="mb-2 font-semibold">Podle místnosti</h2>
              <ul className="text-sm space-y-1 max-h-64 overflow-auto">
                {Object.entries(summary.byRoom).map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-2">
                    <span className="truncate">{k}</span>
                    <span className="shrink-0">
                      {v.count} / {new Intl.NumberFormat("cs-CZ").format(v.value)} Kč
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : (
        <p className="text-gray-500">Načítání…</p>
      )}
    </div>
  );
}
