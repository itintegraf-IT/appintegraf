"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus, Search, Upload } from "lucide-react";
import { DIE_CUT_MATERIALS } from "@/lib/iml/die-cut-constants";

type CustomerOpt = { id: number; name: string };
type BoxTypeOpt = { id: number; code: string; name: string };

type DieCutRow = {
  id: number;
  label_shape_code: string;
  die_cut_tool_code: string | null;
  assembly_code: string | null;
  positions_on_sheet: number | null;
  labels_per_sheet: number | null;
  pieces_per_box: number | null;
  pieces_per_pallet: number | null;
  note: string | null;
  is_active: boolean;
  internal_name: string | null;
  die_cut_format: string | null;
  customer_id: number | null;
  primary_machine: string | null;
  box_type_id: number | null;
  note_prepress: string | null;
  mat_eup_60: boolean;
  mat_eup_60_weight: string | null;
  mat_eup_50: boolean;
  mat_eup_50_weight: string | null;
  mat_eth_55: boolean;
  mat_eth_55_weight: string | null;
  mat_elr_70: boolean;
  mat_elr_70_weight: string | null;
  products_count?: number;
  customer?: CustomerOpt | null;
  box_type?: BoxTypeOpt | null;
};

const emptyForm = {
  label_shape_code: "",
  die_cut_tool_code: "",
  assembly_code: "",
  positions_on_sheet: "",
  pieces_per_box: "",
  pieces_per_pallet: "",
  note: "",
  note_prepress: "",
  internal_name: "",
  die_cut_format: "",
  customer_id: "",
  primary_machine: "",
  box_type_id: "",
  mat_eup_60: false,
  mat_eup_60_weight: "",
  mat_eup_50: false,
  mat_eup_50_weight: "",
  mat_eth_55: false,
  mat_eth_55_weight: "",
  mat_elr_70: false,
  mat_elr_70_weight: "",
  is_active: true,
};

function materialsSummary(row: DieCutRow): string {
  const parts: string[] = [];
  for (const mat of DIE_CUT_MATERIALS) {
    const enabled = row[mat.enabledField as keyof DieCutRow];
    const weight = row[mat.weightField as keyof DieCutRow];
    if (enabled) {
      parts.push(`${mat.label}${weight ? ` (${weight})` : ""}`);
    }
  }
  return parts.length ? parts.join(", ") : "—";
}

export function DieCutsClient({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<DieCutRow[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [boxTypes, setBoxTypes] = useState<BoxTypeOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (includeInactive) params.set("include_inactive", "1");
    const res = await fetch(`/api/iml/die-cuts?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.die_cuts ?? []);
    }
    setLoading(false);
  }, [q, includeInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      const [cRes, bRes] = await Promise.all([
        fetch("/api/iml/customers"),
        fetch("/api/iml/box-types"),
      ]);
      if (cRes.ok) {
        const data = await cRes.json();
        setCustomers(
          (data.customers ?? []).map((c: { id: number; name: string }) => ({
            id: c.id,
            name: c.name,
          }))
        );
      }
      if (bRes.ok) {
        const data = await bRes.json();
        setBoxTypes(data.box_types ?? []);
      }
    })();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (row: DieCutRow) => {
    setEditingId(row.id);
    setForm({
      label_shape_code: row.label_shape_code ?? "",
      die_cut_tool_code: row.die_cut_tool_code ?? "",
      assembly_code: row.assembly_code ?? "",
      positions_on_sheet: row.positions_on_sheet != null ? String(row.positions_on_sheet) : "",
      pieces_per_box: row.pieces_per_box != null ? String(row.pieces_per_box) : "",
      pieces_per_pallet: row.pieces_per_pallet != null ? String(row.pieces_per_pallet) : "",
      note: row.note ?? "",
      note_prepress: row.note_prepress ?? "",
      internal_name: row.internal_name ?? "",
      die_cut_format: row.die_cut_format ?? "",
      customer_id: row.customer_id != null ? String(row.customer_id) : "",
      primary_machine: row.primary_machine ?? "",
      box_type_id: row.box_type_id != null ? String(row.box_type_id) : "",
      mat_eup_60: !!row.mat_eup_60,
      mat_eup_60_weight: row.mat_eup_60_weight ?? "",
      mat_eup_50: !!row.mat_eup_50,
      mat_eup_50_weight: row.mat_eup_50_weight ?? "",
      mat_eth_55: !!row.mat_eth_55,
      mat_eth_55_weight: row.mat_eth_55_weight ?? "",
      mat_elr_70: !!row.mat_elr_70,
      mat_elr_70_weight: row.mat_elr_70_weight ?? "",
      is_active: row.is_active,
    });
    setError("");
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    const payload = {
      label_shape_code: form.label_shape_code.trim(),
      die_cut_tool_code: form.die_cut_tool_code.trim() || null,
      assembly_code: form.assembly_code.trim() || null,
      positions_on_sheet: form.positions_on_sheet.trim() || null,
      pieces_per_box: form.pieces_per_box.trim() || null,
      pieces_per_pallet: form.pieces_per_pallet.trim() || null,
      note: form.note.trim() || null,
      note_prepress: form.note_prepress.trim() || null,
      internal_name: form.internal_name.trim() || null,
      die_cut_format: form.die_cut_format.trim() || null,
      customer_id: form.customer_id.trim() || null,
      primary_machine: form.primary_machine.trim() || null,
      box_type_id: form.box_type_id.trim() || null,
      mat_eup_60: form.mat_eup_60,
      mat_eup_60_weight: form.mat_eup_60 ? form.mat_eup_60_weight.trim() || null : null,
      mat_eup_50: form.mat_eup_50,
      mat_eup_50_weight: form.mat_eup_50 ? form.mat_eup_50_weight.trim() || null : null,
      mat_eth_55: form.mat_eth_55,
      mat_eth_55_weight: form.mat_eth_55 ? form.mat_eth_55_weight.trim() || null : null,
      mat_elr_70: form.mat_elr_70,
      mat_elr_70_weight: form.mat_elr_70 ? form.mat_elr_70_weight.trim() || null : null,
      is_active: form.is_active,
    };
    const res = await fetch(
      editingId ? `/api/iml/die-cuts/${editingId}` : "/api/iml/die-cuts",
      {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Chyba při ukládání");
      return;
    }
    setModalOpen(false);
    void load();
  };

  const deactivate = async (row: DieCutRow) => {
    if (!confirm(`Deaktivovat výsek „${row.label_shape_code}“?`)) return;
    const res = await fetch(`/api/iml/die-cuts/${row.id}`, { method: "DELETE" });
    if (res.ok) void load();
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Výseky</h1>
          <p className="mt-1 text-gray-600">
            Globální katalog – unikátní klíč je kód tvaru etikety. U produktu se výsek vybírá ze
            seznamu.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/iml"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            IML
          </Link>
          {canWrite && (
            <>
              <Link
                href="/iml/die-cuts/import"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                <Upload className="h-4 w-4" />
                Import
              </Link>
              <button
                type="button"
                onClick={openNew}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Nový výsek
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hledat kód tvaru, nástroj, montáž, název…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          Zobrazit neaktivní
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Kód tvaru</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Interní název</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Nástroj</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Montáž</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Zákazník</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Pozic</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Krabice</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Materiály</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Produkty</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Stav</th>
              {canWrite && <th className="px-3 py-2 text-right font-semibold text-gray-700">Akce</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                  Načítání…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                  Žádné výseky. {canWrite ? "Přidejte první přes „Nový výsek“." : ""}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-gray-100 ${row.is_active ? "" : "bg-gray-50 text-gray-500"}`}
                >
                  <td className="px-3 py-2 font-mono font-medium">{row.label_shape_code}</td>
                  <td className="px-3 py-2">{row.internal_name ?? "—"}</td>
                  <td className="px-3 py-2">{row.die_cut_tool_code ?? "—"}</td>
                  <td className="px-3 py-2">{row.assembly_code ?? "—"}</td>
                  <td className="px-3 py-2">{row.customer?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{row.positions_on_sheet ?? "—"}</td>
                  <td className="px-3 py-2">
                    {row.pieces_per_box != null || row.box_type
                      ? `${row.pieces_per_box ?? "—"} ks${row.box_type ? ` / ${row.box_type.code}` : ""}`
                      : "—"}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2" title={materialsSummary(row)}>
                    {materialsSummary(row)}
                  </td>
                  <td className="px-3 py-2 text-right">{row.products_count ?? 0}</td>
                  <td className="px-3 py-2">
                    {row.is_active ? (
                      <span className="text-green-700">aktivní</span>
                    ) : (
                      <span className="text-gray-500">neaktivní</span>
                    )}
                  </td>
                  {canWrite && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="mr-2 inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        <Pencil className="h-3 w-3" />
                        Upravit
                      </button>
                      {row.is_active && (
                        <button
                          type="button"
                          onClick={() => void deactivate(row)}
                          className="inline-flex items-center rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        >
                          Deaktivovat
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingId ? "Upravit výsek" : "Nový výsek"}
            </h2>
            {error && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-gray-700">Kód tvaru etikety *</span>
                <input
                  type="text"
                  value={form.label_shape_code}
                  onChange={(e) => setForm({ ...form, label_shape_code: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Název interní</span>
                <input
                  type="text"
                  value={form.internal_name}
                  onChange={(e) => setForm({ ...form, internal_name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Formát výseku</span>
                <input
                  type="text"
                  value={form.die_cut_format}
                  onChange={(e) => setForm({ ...form, die_cut_format: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">
                  Označení výsekového nástroje
                </span>
                <input
                  type="text"
                  value={form.die_cut_tool_code}
                  onChange={(e) => setForm({ ...form, die_cut_tool_code: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Kód montáže</span>
                <input
                  type="text"
                  value={form.assembly_code}
                  onChange={(e) => setForm({ ...form, assembly_code: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Počet pozic na archu</span>
                <input
                  type="number"
                  value={form.positions_on_sheet}
                  onChange={(e) => setForm({ ...form, positions_on_sheet: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Zákazník (primární)</span>
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">— Vyberte —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">
                  Výsekový stroj (primární)
                </span>
                <input
                  type="text"
                  value={form.primary_machine}
                  onChange={(e) => setForm({ ...form, primary_machine: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Počet ks v krabici</span>
                <input
                  type="number"
                  value={form.pieces_per_box}
                  onChange={(e) => setForm({ ...form, pieces_per_box: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Typ krabice</span>
                <select
                  value={form.box_type_id}
                  onChange={(e) => setForm({ ...form, box_type_id: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">— Vyberte —</option>
                  {boxTypes.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Počet ks na paletě</span>
                <input
                  type="number"
                  value={form.pieces_per_pallet}
                  onChange={(e) => setForm({ ...form, pieces_per_pallet: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>

              <div className="sm:col-span-2">
                <p className="mb-2 text-sm font-medium text-gray-700">Materiály / hmotnosti</p>
                <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  {DIE_CUT_MATERIALS.map((mat) => {
                    const enabledKey = mat.enabledField as keyof typeof form;
                    const weightKey = mat.weightField as keyof typeof form;
                    const enabled = form[enabledKey] as boolean;
                    const weight = form[weightKey] as string;
                    return (
                      <div key={mat.key} className="flex flex-wrap items-center gap-3">
                        <label className="flex min-w-[110px] items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                [enabledKey]: e.target.checked,
                                ...(e.target.checked ? {} : { [weightKey]: "" }),
                              })
                            }
                          />
                          {mat.label}
                        </label>
                        <input
                          type="text"
                          value={weight}
                          disabled={!enabled}
                          placeholder="Hmotnost"
                          onChange={(e) => setForm({ ...form, [weightKey]: e.target.value })}
                          className="min-w-[140px] flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-gray-700">Poznámka</span>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-gray-700">Poznámka (Prepress)</span>
                <textarea
                  value={form.note_prepress}
                  onChange={(e) => setForm({ ...form, note_prepress: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              {editingId != null && (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  Aktivní
                </label>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || !form.label_shape_code.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? "Ukládám…" : "Uložit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
