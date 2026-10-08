"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  IML_TOOL_STATUSES,
  IML_TOOL_STATUS_LABELS,
  IML_TOOL_TECHNOLOGIES,
  IML_TOOL_TECHNOLOGY_LABELS,
  type ImlToolStatus,
  type ImlToolTechnology,
} from "@/lib/iml/shape-tool-constants";

type ToolRow = {
  id: number;
  tool_code_new: string;
  tool_code_orig: string;
  technology: string;
  primary_machine: string | null;
  weight_50g: string | number | null;
  weight_60g: string | number | null;
  status: string;
  note: string | null;
  products_count: number;
  shapes_count: number;
  impositions: Array<{
    id: number;
    imposition_code: string;
    positions_count: number;
    layout_type: string;
  }>;
};

const emptyForm = {
  tool_code_new: "",
  tool_code_orig: "",
  technology: "MONTEX" as ImlToolTechnology,
  primary_machine: "",
  status: "ACTIVE" as ImlToolStatus,
  note: "",
};

export function ToolsClient() {
  const [rows, setRows] = useState<ToolRow[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/iml/tools?${params}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Nelze načíst nástroje");
      return;
    }
    setRows(data.tools ?? []);
    setError(null);
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const payload = {
      ...form,
      primary_machine: form.primary_machine || null,
      note: form.note || null,
    };
    const res = await fetch(editingId ? `/api/iml/tools/${editingId}` : "/api/iml/tools", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Uložení selhalo");
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    await load();
  };

  const remove = async (id: number) => {
    if (!confirm("Smazat nástroj?")) return;
    const res = await fetch(`/api/iml/tools/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Smazání selhalo");
      return;
    }
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Výsekové nástroje</h1>
          <p className="mt-1 text-sm text-gray-600">
            Fyzická železa / plechy (úroveň 2).{" "}
            <Link href="/iml/vyseky" className="text-violet-700 hover:underline">
              ← Výseky
            </Link>
            {" · "}
            <Link href="/iml/tools/import" className="text-violet-700 hover:underline">
              Import
            </Link>
            {" · "}
            <Link href="/iml/impositions" className="text-violet-700 hover:underline">
              Montáže
            </Link>
          </p>
        </div>
        <input
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Hledat kód…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">
          {editingId ? `Upravit #${editingId}` : "Nový nástroj"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Kód nový</span>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.tool_code_new}
              onChange={(e) => setForm((f) => ({ ...f, tool_code_new: e.target.value }))}
              placeholder="IML0001"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Kód původní</span>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.tool_code_orig}
              onChange={(e) => setForm((f) => ({ ...f, tool_code_orig: e.target.value }))}
              placeholder="O-11"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Technologie</span>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.technology}
              onChange={(e) =>
                setForm((f) => ({ ...f, technology: e.target.value as ImlToolTechnology }))
              }
            >
              {IML_TOOL_TECHNOLOGIES.map((t) => (
                <option key={t} value={t}>
                  {IML_TOOL_TECHNOLOGY_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Stav</span>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as ImlToolStatus }))
              }
            >
              {IML_TOOL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {IML_TOOL_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Primární stroj</span>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.primary_machine}
              onChange={(e) => setForm((f) => ({ ...f, primary_machine: e.target.value }))}
              placeholder="např. Montex 1"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-gray-600">Poznámka</span>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </label>
          <p className="text-xs text-gray-500 sm:col-span-2 lg:col-span-4">
            Hmotnosti a balení se zadávají u tvaru (materiálová matice), ne u nástroje.
          </p>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void save()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            {editingId ? "Uložit" : "Přidat"}
          </button>
          {editingId != null && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
            >
              Zrušit
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Nový</th>
              <th className="px-3 py-2">Původní</th>
              <th className="px-3 py-2">Technologie</th>
              <th className="px-3 py-2">Stroj</th>
              <th className="px-3 py-2">Stav</th>
              <th className="px-3 py-2">Montáže</th>
              <th className="px-3 py-2">Akce</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100">
                <td className="px-3 py-2 font-medium">{row.tool_code_new}</td>
                <td className="px-3 py-2">{row.tool_code_orig}</td>
                <td className="px-3 py-2">
                  {IML_TOOL_TECHNOLOGY_LABELS[row.technology as ImlToolTechnology] ??
                    row.technology}
                </td>
                <td className="px-3 py-2">{row.primary_machine ?? "—"}</td>
                <td className="px-3 py-2">
                  {IML_TOOL_STATUS_LABELS[row.status as ImlToolStatus] ?? row.status}
                </td>
                <td className="px-3 py-2 text-xs">
                  {row.impositions.length === 0
                    ? "—"
                    : row.impositions
                        .map((i) => `${i.imposition_code} (${i.positions_count})`)
                        .join(", ")}
                </td>
                <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                  <button
                    type="button"
                    className="text-violet-700 hover:underline"
                    onClick={() => {
                      setEditingId(row.id);
                      setForm({
                        tool_code_new: row.tool_code_new,
                        tool_code_orig: row.tool_code_orig,
                        technology: row.technology as ImlToolTechnology,
                        primary_machine: row.primary_machine ?? "",
                        status: row.status as ImlToolStatus,
                        note: row.note ?? "",
                      });
                    }}
                  >
                    Upravit
                  </button>
                  <button
                    type="button"
                    className="text-red-600 hover:underline"
                    onClick={() => void remove(row.id)}
                  >
                    Smazat
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                  Žádné nástroje
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
