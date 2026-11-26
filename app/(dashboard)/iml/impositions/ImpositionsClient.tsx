"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IML_IMPOSITION_LAYOUT_TYPES,
  type ImlImpositionLayoutType,
} from "@/lib/iml/shape-tool-constants";

type ToolOpt = { id: number; tool_code_new: string; tool_code_orig: string };
type NamedOpt = { id: number; name: string };
type ShapeOpt = { id: number; shape_code: string; shape_type: string };
type MachineOpt = NamedOpt & { machine_group?: string };

type ShapeRow = {
  shape_id: number;
  positions_on_sheet: number;
  is_primary: boolean;
  shape?: ShapeOpt;
};

type Row = {
  id: number;
  tool_id: number | null;
  imposition_code: string;
  positions_count: number;
  layout_type: string;
  description: string | null;
  sheet_size_id: number | null;
  print_machine_id: number | null;
  die_cut_device_id: number | null;
  is_cut_only: boolean;
  tool: ToolOpt | null;
  sheet_size: NamedOpt | null;
  print_machine: NamedOpt | null;
  die_cut_device: NamedOpt | null;
  shapes: Array<{
    shape_id: number;
    positions_on_sheet: number;
    is_primary: boolean;
    shape: ShapeOpt;
  }>;
};

type FormState = {
  tool_id: string;
  imposition_code: string;
  layout_type: ImlImpositionLayoutType;
  description: string;
  sheet_size_id: string;
  print_machine_id: string;
  die_cut_device_id: string;
  is_cut_only: boolean;
  shapes: ShapeRow[];
};

const emptyForm: FormState = {
  tool_id: "",
  imposition_code: "",
  layout_type: "SOLO",
  description: "",
  sheet_size_id: "",
  print_machine_id: "",
  die_cut_device_id: "",
  is_cut_only: false,
  shapes: [],
};

function isCutDeviceName(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = name.trim().toLocaleLowerCase("cs");
  return n === "řezačka" || n === "rezacka" || n === "řezání" || n === "rezani";
}

export function ImpositionsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tools, setTools] = useState<ToolOpt[]>([]);
  const [dieCutDevices, setDieCutDevices] = useState<NamedOpt[]>([]);
  const [sheetSizes, setSheetSizes] = useState<NamedOpt[]>([]);
  const [printMachines, setPrintMachines] = useState<MachineOpt[]>([]);
  const [shapes, setShapes] = useState<ShapeOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [shapeFilter, setShapeFilter] = useState("");

  const selectedDevice = dieCutDevices.find(
    (d) => String(d.id) === form.die_cut_device_id
  );
  const cutMode = form.is_cut_only || isCutDeviceName(selectedDevice?.name);

  const load = useCallback(async () => {
    const qs = shapeFilter ? `?shape_id=${encodeURIComponent(shapeFilter)}` : "";
    const [impRes, toolsRes, lookupsRes] = await Promise.all([
      fetch(`/api/iml/impositions${qs}`),
      fetch("/api/iml/tools"),
      fetch("/api/iml/impositions/lookups"),
    ]);
    const impData = await impRes.json().catch(() => ({}));
    const toolsData = await toolsRes.json().catch(() => ({}));
    const lookups = await lookupsRes.json().catch(() => ({}));
    if (!impRes.ok) {
      setError(impData.error ?? "Nelze načíst montáže");
      return;
    }
    setRows(impData.impositions ?? []);
    setTools(
      (toolsData.tools ?? []).map((t: ToolOpt) => ({
        id: t.id,
        tool_code_new: t.tool_code_new,
        tool_code_orig: t.tool_code_orig,
      }))
    );
    if (lookupsRes.ok) {
      setDieCutDevices(lookups.dieCutDevices ?? []);
      setSheetSizes(lookups.sheetSizes ?? []);
      setPrintMachines(lookups.printMachines ?? []);
      setShapes(lookups.shapes ?? []);
    }
    setError(null);
  }, [shapeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPositions = useMemo(
    () => form.shapes.reduce((a, s) => a + (Number(s.positions_on_sheet) || 0), 0),
    [form.shapes]
  );

  const save = async () => {
    const payload = {
      tool_id: cutMode ? (form.tool_id ? Number(form.tool_id) : null) : Number(form.tool_id) || null,
      imposition_code: form.imposition_code,
      positions_count: totalPositions || 1,
      layout_type: form.layout_type,
      description: form.description || null,
      sheet_size_id: form.sheet_size_id ? Number(form.sheet_size_id) : null,
      print_machine_id: form.print_machine_id ? Number(form.print_machine_id) : null,
      die_cut_device_id: form.die_cut_device_id ? Number(form.die_cut_device_id) : null,
      is_cut_only: cutMode,
      shapes: form.shapes.map((s) => ({
        shape_id: s.shape_id,
        positions_on_sheet: Number(s.positions_on_sheet),
        is_primary: s.is_primary,
      })),
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

  const addShapeRow = () => {
    const first = shapes.find((s) => !form.shapes.some((r) => r.shape_id === s.id));
    if (!first) {
      setError("Žádný volný tvar k přidání.");
      return;
    }
    setForm((f) => ({
      ...f,
      layout_type: f.shapes.length >= 1 ? "SET" : f.layout_type,
      shapes: [
        ...f.shapes,
        {
          shape_id: first.id,
          positions_on_sheet: 1,
          is_primary: f.shapes.length === 0,
        },
      ],
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Montáže / mustery</h1>
        <p className="mt-1 text-sm text-gray-600">
          Předpisy archů (úroveň 3).{" "}
          <Link href="/iml/vyseky" className="text-violet-700 hover:underline">
            ← Výseky
          </Link>
          {" · "}
          <Link href="/iml/tools" className="text-violet-700 hover:underline">
            Nástroje
          </Link>
          {" · "}
          <Link href="/iml/shapes" className="text-violet-700 hover:underline">
            Tvary
          </Link>
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm sm:col-span-2 lg:col-span-1">
            <span className="mb-1 block text-gray-600">Kód montáže *</span>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Montáž A23A / MT097+078"
              value={form.imposition_code}
              onChange={(e) => setForm((f) => ({ ...f, imposition_code: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Formát archu</span>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.sheet_size_id}
              onChange={(e) => setForm((f) => ({ ...f, sheet_size_id: e.target.value }))}
            >
              <option value="">—</option>
              {sheetSizes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Tiskový stroj</span>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.print_machine_id}
              onChange={(e) => setForm((f) => ({ ...f, print_machine_id: e.target.value }))}
            >
              <option value="">—</option>
              {printMachines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Výsek / zařízení</span>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.die_cut_device_id}
              onChange={(e) => {
                const id = e.target.value;
                const device = dieCutDevices.find((d) => String(d.id) === id);
                const cut = isCutDeviceName(device?.name);
                setForm((f) => ({
                  ...f,
                  die_cut_device_id: id,
                  is_cut_only: cut ? true : f.is_cut_only,
                  tool_id: cut ? "" : f.tool_id,
                }));
              }}
            >
              <option value="">—</option>
              {dieCutDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">
              Výs. nástroj {cutMode ? "(volitelný)" : "*"}
            </span>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
              value={form.tool_id}
              disabled={cutMode}
              onChange={(e) => setForm((f) => ({ ...f, tool_id: e.target.value }))}
            >
              <option value="">{cutMode ? "— bez nástroje —" : "Vyberte…"}</option>
              {tools.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tool_code_new} ({t.tool_code_orig})
                </option>
              ))}
            </select>
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
          <label className="flex items-end gap-2 text-sm pb-2">
            <input
              type="checkbox"
              checked={form.is_cut_only}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  is_cut_only: e.target.checked,
                  tool_id: e.target.checked ? "" : f.tool_id,
                }))
              }
            />
            <span className="text-gray-700">Režim řezání (bez železa)</span>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-gray-600">Popis</span>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">
              Užitky na archu {totalPositions > 0 && `(celkem ${totalPositions})`}
            </h3>
            <button
              type="button"
              onClick={addShapeRow}
              className="rounded-lg border border-violet-300 px-3 py-1 text-sm text-violet-800 hover:bg-violet-50"
            >
              + Přidat tvar
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Tvar</th>
                  <th className="px-3 py-2 text-left">Násobnost</th>
                  <th className="px-3 py-2 text-left">Primární</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {form.shapes.map((row, idx) => (
                  <tr key={`${row.shape_id}-${idx}`} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded border border-gray-300 px-2 py-1"
                        value={row.shape_id}
                        onChange={(e) => {
                          const shape_id = Number(e.target.value);
                          setForm((f) => {
                            const next = [...f.shapes];
                            next[idx] = { ...next[idx], shape_id };
                            return { ...f, shapes: next };
                          });
                        }}
                      >
                        {shapes.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.shape_code} ({s.shape_type})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        className="w-24 rounded border border-gray-300 px-2 py-1"
                        value={row.positions_on_sheet}
                        onChange={(e) => {
                          const positions_on_sheet = parseInt(e.target.value, 10) || 1;
                          setForm((f) => {
                            const next = [...f.shapes];
                            next[idx] = { ...next[idx], positions_on_sheet };
                            return { ...f, shapes: next };
                          });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={row.is_primary}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setForm((f) => ({
                            ...f,
                            shapes: f.shapes.map((s, i) => ({
                              ...s,
                              is_primary: i === idx ? checked : checked ? false : s.is_primary,
                            })),
                          }));
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            shapes: f.shapes.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        Odebrat
                      </button>
                    </td>
                  </tr>
                ))}
                {form.shapes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                      Zatím žádné užitky — přidejte tvary ze katalogu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-2">
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

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Filtrovat podle tvaru</span>
          <select
            className="rounded-lg border border-gray-300 px-3 py-2"
            value={shapeFilter}
            onChange={(e) => setShapeFilter(e.target.value)}
          >
            <option value="">Všechny montáže</option>
            {shapes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.shape_code}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Kód</th>
              <th className="px-3 py-2">Nástroj / režim</th>
              <th className="px-3 py-2">Zařízení</th>
              <th className="px-3 py-2">Užitky</th>
              <th className="px-3 py-2">Layout</th>
              <th className="px-3 py-2">Akce</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100">
                <td className="px-3 py-2 font-medium">{row.imposition_code}</td>
                <td className="px-3 py-2">
                  {row.is_cut_only || !row.tool
                    ? "Řezání"
                    : `${row.tool.tool_code_new} (${row.tool.tool_code_orig})`}
                </td>
                <td className="px-3 py-2">{row.die_cut_device?.name ?? "—"}</td>
                <td className="px-3 py-2">
                  {row.shapes?.length
                    ? row.shapes
                        .map(
                          (s) =>
                            `${s.shape.shape_code}×${s.positions_on_sheet}${s.is_primary ? "*" : ""}`
                        )
                        .join(", ")
                    : row.positions_count}
                </td>
                <td className="px-3 py-2">{row.layout_type}</td>
                <td className="px-3 py-2 space-x-2">
                  <button
                    type="button"
                    className="text-violet-700 hover:underline"
                    onClick={() => {
                      setEditingId(row.id);
                      setForm({
                        tool_id: row.tool_id != null ? String(row.tool_id) : "",
                        imposition_code: row.imposition_code,
                        layout_type: row.layout_type as ImlImpositionLayoutType,
                        description: row.description ?? "",
                        sheet_size_id: row.sheet_size_id != null ? String(row.sheet_size_id) : "",
                        print_machine_id:
                          row.print_machine_id != null ? String(row.print_machine_id) : "",
                        die_cut_device_id:
                          row.die_cut_device_id != null ? String(row.die_cut_device_id) : "",
                        is_cut_only: row.is_cut_only,
                        shapes: (row.shapes ?? []).map((s) => ({
                          shape_id: s.shape_id,
                          positions_on_sheet: s.positions_on_sheet,
                          is_primary: s.is_primary,
                        })),
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
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
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
