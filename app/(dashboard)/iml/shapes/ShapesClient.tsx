"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  IML_SHAPE_TOOL_PRIORITIES,
  IML_TOOL_TECHNOLOGY_LABELS,
  type ImlToolTechnology,
} from "@/lib/iml/shape-tool-constants";
import { ShapeExtrasPanel } from "./ShapeExtrasPanel";

type ToolOpt = {
  id: number;
  tool_code_new: string;
  tool_code_orig: string;
  technology: string;
};

type ShapeTypeOpt = { id: number; code: string; name: string };

type Assignment = {
  id: number;
  priority: string;
  tool: ToolOpt;
};

type ShapeRow = {
  id: number;
  shape_code: string;
  shape_type: string;
  width_mm: string | number;
  height_mm: string | number;
  internal_note: string | null;
  products_count: number;
  tool_assignments: Assignment[];
};

const emptyForm = {
  shape_code: "",
  shape_type: "CUP",
  width_mm: "",
  height_mm: "",
  internal_note: "",
};

export function ShapesClient() {
  const [rows, setRows] = useState<ShapeRow[]>([]);
  const [tools, setTools] = useState<ToolOpt[]>([]);
  const [shapeTypes, setShapeTypes] = useState<ShapeTypeOpt[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [assignShapeId, setAssignShapeId] = useState<number | null>(null);
  const [assignToolId, setAssignToolId] = useState("");
  const [assignPriority, setAssignPriority] = useState("PRIMARY");
  const [detailShapeId, setDetailShapeId] = useState<number | null>(null);
  const [newTypeCode, setNewTypeCode] = useState("");
  const [newTypeName, setNewTypeName] = useState("");
  const [showAddType, setShowAddType] = useState(false);

  const typeLabel = (code: string) =>
    shapeTypes.find((t) => t.code === code)?.name ?? code;

  const loadTypes = useCallback(async () => {
    const res = await fetch("/api/iml/shape-types");
    const data = await res.json().catch(() => ({}));
    if (res.ok) setShapeTypes(data.shape_types ?? []);
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const [shapesRes, toolsRes] = await Promise.all([
      fetch(`/api/iml/shapes?${params}`),
      fetch("/api/iml/tools"),
    ]);
    const shapesData = await shapesRes.json().catch(() => ({}));
    const toolsData = await toolsRes.json().catch(() => ({}));
    if (!shapesRes.ok) {
      setError(shapesData.error ?? "Nelze načíst tvary");
      return;
    }
    setRows(shapesData.shapes ?? []);
    setTools(toolsData.tools ?? []);
    setError(null);
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  const addShapeType = async () => {
    setError(null);
    const res = await fetch("/api/iml/shape-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: newTypeCode, name: newTypeName }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Nelze přidat typ");
      return;
    }
    const created = data.shape_type as ShapeTypeOpt;
    await loadTypes();
    setForm((f) => ({ ...f, shape_type: created.code }));
    setNewTypeCode("");
    setNewTypeName("");
    setShowAddType(false);
  };

  const save = async () => {
    setError(null);
    const payload = {
      shape_code: form.shape_code,
      shape_type: form.shape_type,
      width_mm: form.width_mm,
      height_mm: form.height_mm,
      internal_note: form.internal_note || null,
    };
    const res = await fetch(
      editingId ? `/api/iml/shapes/${editingId}` : "/api/iml/shapes",
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
    if (!confirm("Smazat tvar?")) return;
    const res = await fetch(`/api/iml/shapes/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Smazání selhalo");
      return;
    }
    await load();
  };

  const addAssignment = async () => {
    if (assignShapeId == null || !assignToolId) return;
    const res = await fetch(`/api/iml/shapes/${assignShapeId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool_id: Number(assignToolId),
        priority: assignPriority,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Přiřazení selhalo");
      return;
    }
    setAssignShapeId(null);
    setAssignToolId("");
    setAssignPriority("PRIMARY");
    await load();
  };

  const removeAssignment = async (shapeId: number, assignmentId: number) => {
    const res = await fetch(
      `/api/iml/shapes/${shapeId}/assignments?assignment_id=${assignmentId}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Odebrání selhalo");
      return;
    }
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tvary etiket</h1>
          <p className="mt-1 text-sm text-gray-600">
            Číselník geometrie (úroveň 1).{" "}
            <Link href="/iml/vyseky" className="text-violet-700 hover:underline">
              ← Výseky
            </Link>
          </p>
        </div>
        <input
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Hledat kód / poznámku…"
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
          {editingId ? `Upravit tvar #${editingId}` : "Nový tvar"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Kód</span>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.shape_code}
              onChange={(e) => setForm((f) => ({ ...f, shape_code: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Typ</span>
            <div className="flex gap-1">
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.shape_type}
                onChange={(e) => setForm((f) => ({ ...f, shape_type: e.target.value }))}
              >
                {shapeTypes.map((t) => (
                  <option key={t.id} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                title="Přidat typ do číselníku"
                className="shrink-0 rounded-lg border border-gray-300 px-2 text-sm text-violet-700 hover:bg-violet-50"
                onClick={() => setShowAddType((v) => !v)}
              >
                +
              </button>
            </div>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Šířka mm</span>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.width_mm}
              onChange={(e) => setForm((f) => ({ ...f, width_mm: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Výška mm</span>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.height_mm}
              onChange={(e) => setForm((f) => ({ ...f, height_mm: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Poznámka</span>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.internal_note}
              onChange={(e) => setForm((f) => ({ ...f, internal_note: e.target.value }))}
            />
          </label>
        </div>
        {showAddType && (
          <div className="mt-3 grid gap-2 rounded-lg border border-violet-200 bg-violet-50/60 p-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Kód typu</span>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="např. vanička → VANICKA"
                value={newTypeCode}
                onChange={(e) => setNewTypeCode(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Název</span>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="např. Tác"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => void addShapeType()}
                className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700"
              >
                Uložit typ
              </button>
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() => setShowAddType(false)}
              >
                Zrušit
              </button>
            </div>
          </div>
        )}
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
              <th className="px-3 py-2">Kód</th>
              <th className="px-3 py-2">Typ</th>
              <th className="px-3 py-2">Rozměr</th>
              <th className="px-3 py-2">Nástroje</th>
              <th className="px-3 py-2">Prod.</th>
              <th className="px-3 py-2">Akce</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.id}>
                <tr className="border-b border-gray-100 align-top">
                  <td className="px-3 py-2 font-medium">{row.shape_code}</td>
                  <td className="px-3 py-2">{typeLabel(row.shape_type)}</td>
                  <td className="px-3 py-2">
                    {Number(row.width_mm)} × {Number(row.height_mm)} mm
                  </td>
                  <td className="px-3 py-2">
                    <ul className="space-y-1">
                      {row.tool_assignments.map((a) => (
                        <li key={a.id} className="flex items-center gap-2 text-xs">
                          <span className="rounded bg-gray-100 px-1.5 py-0.5">{a.priority}</span>
                          {a.tool.tool_code_new} ({a.tool.tool_code_orig}) ·{" "}
                          {IML_TOOL_TECHNOLOGY_LABELS[a.tool.technology as ImlToolTechnology] ??
                            a.tool.technology}
                          <button
                            type="button"
                            className="text-red-600 hover:underline"
                            onClick={() => void removeAssignment(row.id, a.id)}
                          >
                            odebrat
                          </button>
                        </li>
                      ))}
                    </ul>
                    {assignShapeId === row.id ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select
                          className="rounded border px-2 py-1 text-xs"
                          value={assignToolId}
                          onChange={(e) => setAssignToolId(e.target.value)}
                        >
                          <option value="">Nástroj…</option>
                          {tools.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.tool_code_new} ({t.tool_code_orig})
                            </option>
                          ))}
                        </select>
                        <select
                          className="rounded border px-2 py-1 text-xs"
                          value={assignPriority}
                          onChange={(e) => setAssignPriority(e.target.value)}
                        >
                          {IML_SHAPE_TOOL_PRIORITIES.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="text-xs text-violet-700 hover:underline"
                          onClick={() => void addAssignment()}
                        >
                          Uložit
                        </button>
                        <button
                          type="button"
                          className="text-xs text-gray-500 hover:underline"
                          onClick={() => setAssignShapeId(null)}
                        >
                          Zrušit
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="mt-1 text-xs text-violet-700 hover:underline"
                        onClick={() => setAssignShapeId(row.id)}
                      >
                        + přiřadit nástroj
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">{row.products_count}</td>
                  <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      className="text-violet-700 hover:underline"
                      onClick={() => {
                        setEditingId(row.id);
                        setForm({
                          shape_code: row.shape_code,
                          shape_type: row.shape_type,
                          width_mm: String(row.width_mm),
                          height_mm: String(row.height_mm),
                          internal_note: row.internal_note ?? "",
                        });
                      }}
                    >
                      Upravit
                    </button>
                    <button
                      type="button"
                      className="text-violet-700 hover:underline"
                      onClick={() =>
                        setDetailShapeId((id) => (id === row.id ? null : row.id))
                      }
                    >
                      {detailShapeId === row.id ? "Skrýt" : "Matice"}
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
                {detailShapeId === row.id && (
                  <tr className="border-b border-gray-100">
                    <td colSpan={6} className="px-3 py-2">
                      <ShapeExtrasPanel
                        shapeId={row.id}
                        shapeCode={row.shape_code}
                        onError={setError}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  Žádné tvary
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
