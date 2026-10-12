"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  IML_IMPOSITION_LAYOUT_TYPES,
  type ImlImpositionLayoutType,
} from "@/lib/iml/shape-tool-constants";

type ToolOpt = { id: number; tool_code_new: string; tool_code_orig: string };

type Row = {
  id: number;
  tool_id: number;
  imposition_code: string;
  positions_count: number;
  layout_type: string;
  description: string | null;
  tool: ToolOpt;
};

const emptyForm = {
  tool_id: "",
  imposition_code: "",
  positions_count: "",
  layout_type: "SOLO" as ImlImpositionLayoutType,
  description: "",
};

export function ImpositionsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tools, setTools] = useState<ToolOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [impRes, toolsRes] = await Promise.all([
      fetch("/api/iml/impositions"),
      fetch("/api/iml/tools"),
    ]);
    const impData = await impRes.json().catch(() => ({}));
    const toolsData = await toolsRes.json().catch(() => ({}));
    if (!impRes.ok) {
      setError(impData.error ?? "Nelze načíst montáže");
      return;
    }
    setRows(impData.impositions ?? []);
    setTools(
      (toolsData.tools ?? []).map((t: ToolOpt & { id: number }) => ({
        id: t.id,
        tool_code_new: t.tool_code_new,
        tool_code_orig: t.tool_code_orig,
      }))
    );
    setError(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const payload = {
      tool_id: Number(form.tool_id),
      imposition_code: form.imposition_code,
      positions_count: Number(form.positions_count),
      layout_type: form.layout_type,
      description: form.description || null,
    };
    const res = await fetch(
      editingId ? `/api/iml/impositions/${editingId}` : "/api/iml/impositions",
      {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
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
    if (!confirm("Smazat montáž?")) return;
    const res = await fetch(`/api/iml/impositions/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Smazání selhalo");
      return;
    }
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Montáže / mustery</h1>
        <p className="mt-1 text-sm text-gray-600">
          Předpisy archů (úroveň 3, Prepress).{" "}
          <Link href="/iml/vyseky" className="text-violet-700 hover:underline">
            ← Výseky
          </Link>
          {" · "}
          <Link href="/iml/tools" className="text-violet-700 hover:underline">
            Nástroje
          </Link>
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Nástroj</span>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.tool_id}
              onChange={(e) => setForm((f) => ({ ...f, tool_id: e.target.value }))}
            >
              <option value="">Vyberte…</option>
              {tools.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tool_code_new} ({t.tool_code_orig})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Kód montáže</span>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.imposition_code}
              onChange={(e) => setForm((f) => ({ ...f, imposition_code: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Užitků</span>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.positions_count}
              onChange={(e) => setForm((f) => ({ ...f, positions_count: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Layout</span>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.layout_type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  layout_type: e.target.value as ImlImpositionLayoutType,
                }))
              }
            >
              {IML_IMPOSITION_LAYOUT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Popis</span>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
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
              className="rounded-lg border px-4 py-2 text-sm"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
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
              <th className="px-3 py-2">Kód</th>
              <th className="px-3 py-2">Nástroj</th>
              <th className="px-3 py-2">Užitků</th>
              <th className="px-3 py-2">Layout</th>
              <th className="px-3 py-2">Akce</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100">
                <td className="px-3 py-2 font-medium">{row.imposition_code}</td>
                <td className="px-3 py-2">
                  {row.tool.tool_code_new} ({row.tool.tool_code_orig})
                </td>
                <td className="px-3 py-2">{row.positions_count}</td>
                <td className="px-3 py-2">{row.layout_type}</td>
                <td className="px-3 py-2 space-x-2">
                  <button
                    type="button"
                    className="text-violet-700 hover:underline"
                    onClick={() => {
                      setEditingId(row.id);
                      setForm({
                        tool_id: String(row.tool_id),
                        imposition_code: row.imposition_code,
                        positions_count: String(row.positions_count),
                        layout_type: row.layout_type as ImlImpositionLayoutType,
                        description: row.description ?? "",
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
                <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                  Žádné montáže
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
