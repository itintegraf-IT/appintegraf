"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Pencil, Plus, X } from "lucide-react";

type ColorRow = {
  id: number;
  material_id: number;
  name: string;
  code: string | null;
  pantone_code: string | null;
  hex_color: string | null;
  cmyk_c: number | null;
  cmyk_m: number | null;
  cmyk_y: number | null;
  cmyk_k: number | null;
  subcategory_id: number | null;
  subcategory_name: string | null;
  color_kind: "pantone" | "cmyk";
  is_active: boolean;
};

type SubRow = { id: number; name: string; category_code: string };

type InnerMode = "pantone" | "cmyk";

const pantoneEmpty = {
  code: "",
  name: "",
  hex: "",
  subcategory_id: "" as string | number,
  is_active: true,
};

const cmykEmpty = {
  code: "",
  name: "",
  c: "",
  m: "",
  y: "",
  k: "",
  subcategory_id: "" as string | number,
  is_active: true,
};

function hexPreviewStyle(hex: string | null) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return { backgroundColor: "#e5e7eb" };
  return { backgroundColor: hex };
}

export function ImlColorSettingsTab({ canWrite }: { canWrite: boolean }) {
  const [inner, setInner] = useState<InnerMode>("pantone");
  const [rows, setRows] = useState<ColorRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [subsError, setSubsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modal, setModal] = useState<null | { mode: InnerMode; editingId: number | null }>(null);
  const [pForm, setPForm] = useState(pantoneEmpty);
  const [cForm, setCForm] = useState(cmykEmpty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadSubs = useCallback(async () => {
    setSubsError(false);
    const res = await fetch("/api/materialy/subcategories?category=COLOR");
    if (!res.ok) {
      setSubsError(true);
      setSubs([]);
      return;
    }
    const data = await res.json();
    setSubs((data.subcategories ?? []) as SubRow[]);
  }, []);

  const loadColors = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("kind", inner);
    if (q.trim()) params.set("q", q.trim());
    if (includeInactive) params.set("include_inactive", "1");
    const res = await fetch(`/api/iml/pantone-colors?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setRows((data.colors ?? data.pantone_colors ?? []) as ColorRow[]);
    }
    setLoading(false);
  }, [inner, q, includeInactive]);

  useEffect(() => {
    void loadSubs();
  }, [loadSubs]);

  useEffect(() => {
    void loadColors();
  }, [loadColors]);

  const openNew = (mode: InnerMode) => {
    setModal({ mode, editingId: null });
    setPForm(pantoneEmpty);
    setCForm(cmykEmpty);
    setError("");
  };

  const openEdit = (row: ColorRow) => {
    const mode: InnerMode = row.color_kind === "cmyk" ? "cmyk" : "pantone";
    setModal({ mode, editingId: row.id });
    if (mode === "pantone") {
      setPForm({
        code: row.code ?? "",
        name: row.name,
        hex: row.hex_color ?? "",
        subcategory_id: row.subcategory_id ?? "",
        is_active: row.is_active,
      });
    } else {
      setCForm({
        code: row.code ?? "",
        name: row.name,
        c: row.cmyk_c != null ? String(row.cmyk_c) : "",
        m: row.cmyk_m != null ? String(row.cmyk_m) : "",
        y: row.cmyk_y != null ? String(row.cmyk_y) : "",
        k: row.cmyk_k != null ? String(row.cmyk_k) : "",
        subcategory_id: row.subcategory_id ?? "",
        is_active: row.is_active,
      });
    }
    setError("");
  };

  const closeModal = () => {
    setModal(null);
    setError("");
  };

  const submitPantone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !modal) return;
    setSaving(true);
    setError("");
    const payload: Record<string, unknown> = {
      name: pForm.name.trim(),
      code: pForm.code.trim(),
      hex_color: pForm.hex.trim() || null,
      is_active: pForm.is_active,
    };
    if (modal.editingId == null) {
      payload.color_kind = "pantone";
    }
    if (pForm.subcategory_id !== "" && pForm.subcategory_id != null) {
      payload.subcategory_id = parseInt(String(pForm.subcategory_id), 10);
    }
    const url = modal?.editingId != null ? `/api/iml/pantone-colors/${modal.editingId}` : "/api/iml/pantone-colors";
    const method = modal?.editingId != null ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Uložení se nezdařilo");
      return;
    }
    closeModal();
    void loadColors();
  };

  const submitCmyk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !modal) return;
    setSaving(true);
    setError("");
    const payload: Record<string, unknown> = {
      name: cForm.name.trim(),
      code: cForm.code.trim(),
      cmyk_c: parseInt(cForm.c, 10),
      cmyk_m: parseInt(cForm.m, 10),
      cmyk_y: parseInt(cForm.y, 10),
      cmyk_k: parseInt(cForm.k, 10),
      is_active: cForm.is_active,
    };
    if (modal.editingId == null) {
      payload.color_kind = "cmyk";
    }
    if (cForm.subcategory_id !== "" && cForm.subcategory_id != null) {
      payload.subcategory_id = parseInt(String(cForm.subcategory_id), 10);
    }
    const url = modal?.editingId != null ? `/api/iml/pantone-colors/${modal.editingId}` : "/api/iml/pantone-colors";
    const method = modal?.editingId != null ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Uložení se nezdařilo");
      return;
    }
    closeModal();
    void loadColors();
  };

  const deactivate = async (row: ColorRow) => {
    if (!canWrite) return;
    if (!confirm(`Deaktivovat barvu „${row.name}“?`)) return;
    const res = await fetch(`/api/iml/pantone-colors/${row.id}`, { method: "DELETE" });
    if (res.ok) void loadColors();
  };

  const cmykSubMissing = inner === "cmyk" && subs.every((s) => s.name !== "CMYK");

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Pantone a CMYK jsou v katalogu jako materiály kategorie COLOR. Dokumenty (BL, SDS) přidáte v detailu záznamu v katalogu.
      </p>

      {cmykSubMissing && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          V databázi chybí podtyp „CMYK“ pro barvy. Obvykle ho doplní migrace; případně ho přidejte v{" "}
          <Link href="/materialy/settings" className="font-medium text-red-700 underline">
            nastavení podtypů
          </Link>
          .
        </div>
      )}
      {subs.length === 0 && !subsError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Pro barvy nejsou definované podtypy.{" "}
          <Link href="/materialy/settings" className="font-medium text-red-700 underline">
            Správa podtypů materiálů
          </Link>
        </div>
      )}
      {subsError && (
        <p className="text-sm text-amber-800">
          Podtypy se nepodařilo načíst (oprávnění ke katalogu materiálů). Bez aktivních podtypů COLOR lze záznamy vytvářet
          dle pravidel serveru.
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {(
          [
            { id: "pantone" as const, label: "Pantone" },
            { id: "cmyk" as const, label: "CMYK" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setInner(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              inner === t.id ? "bg-red-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Hledat</label>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Kód nebo název…"
            className="w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded border-gray-300"
          />
          Zobrazit neaktivní
        </label>
        {canWrite && (
          <button
            type="button"
            onClick={() => openNew(inner)}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            {inner === "pantone" ? "Nová Pantone" : "Nová CMYK"}
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-gray-500">Načítání…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">Žádné záznamy.</p>
        ) : inner === "pantone" ? (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Kód</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Název</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">HEX</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Podtyp</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Aktivní</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Akce</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.material_id} className={!row.is_active ? "bg-gray-50 text-gray-500" : ""}>
                  <td className="px-4 py-2 font-mono text-xs">{row.code ?? "—"}</td>
                  <td className="px-4 py-2">{row.name}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-6 w-6 shrink-0 rounded border border-gray-200"
                        style={hexPreviewStyle(row.hex_color)}
                        title={row.hex_color ?? ""}
                      />
                      <span className="font-mono text-xs">{row.hex_color ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">{row.subcategory_name ?? "—"}</td>
                  <td className="px-4 py-2">{row.is_active ? "Ano" : "Ne"}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/materialy/${row.material_id}`}
                        className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Katalog
                      </Link>
                      {canWrite && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Upravit
                          </button>
                          {row.is_active && (
                            <button
                              type="button"
                              onClick={() => void deactivate(row)}
                              className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                            >
                              Deaktivovat
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Kód</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Název</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">C</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">M</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Y</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">K</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Aktivní</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Akce</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.material_id} className={!row.is_active ? "bg-gray-50 text-gray-500" : ""}>
                  <td className="px-4 py-2 font-mono text-xs">{row.code ?? "—"}</td>
                  <td className="px-4 py-2">{row.name}</td>
                  <td className="px-4 py-2">{row.cmyk_c ?? "—"}</td>
                  <td className="px-4 py-2">{row.cmyk_m ?? "—"}</td>
                  <td className="px-4 py-2">{row.cmyk_y ?? "—"}</td>
                  <td className="px-4 py-2">{row.cmyk_k ?? "—"}</td>
                  <td className="px-4 py-2">{row.is_active ? "Ano" : "Ne"}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/materialy/${row.material_id}`}
                        className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Katalog
                      </Link>
                      {canWrite && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Upravit
                          </button>
                          {row.is_active && (
                            <button
                              type="button"
                              onClick={() => void deactivate(row)}
                              className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                            >
                              Deaktivovat
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && modal.mode === "pantone" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {modal.editingId != null ? "Upravit Pantone" : "Nová Pantone"}
              </h3>
              <button type="button" onClick={closeModal} className="rounded p-2 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void submitPantone(e)} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Kód *</label>
                <input
                  required
                  value={pForm.code}
                  onChange={(e) => setPForm({ ...pForm, code: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Název *</label>
                <input
                  required
                  value={pForm.name}
                  onChange={(e) => setPForm({ ...pForm, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">HEX (volitelně)</label>
                <div className="flex items-center gap-3">
                  <input
                    value={pForm.hex}
                    onChange={(e) => setPForm({ ...pForm, hex: e.target.value })}
                    placeholder="#FF0000"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
                  />
                  <div
                    className="h-10 w-10 shrink-0 rounded border border-gray-200"
                    style={hexPreviewStyle(pForm.hex.trim() ? (pForm.hex.trim().startsWith("#") ? pForm.hex.trim() : `#${pForm.hex.trim()}`) : null)}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Podtyp</label>
                <select
                  value={pForm.subcategory_id === "" ? "" : String(pForm.subcategory_id)}
                  onChange={(e) =>
                    setPForm({
                      ...pForm,
                      subcategory_id: e.target.value === "" ? "" : parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">— (výchozí Pantone)</option>
                  {subs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={pForm.is_active}
                  onChange={(e) => setPForm({ ...pForm, is_active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Aktivní (dostupná pro výběr u produktů)
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={saving || !canWrite}
                  className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? "Ukládám…" : "Uložit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal && modal.mode === "cmyk" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{modal.editingId != null ? "Upravit CMYK" : "Nová CMYK"}</h3>
              <button type="button" onClick={closeModal} className="rounded p-2 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void submitCmyk(e)} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Kód *</label>
                <input
                  required
                  value={cForm.code}
                  onChange={(e) => setCForm({ ...cForm, code: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Název *</label>
                <input
                  required
                  value={cForm.name}
                  onChange={(e) => setCForm({ ...cForm, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(["c", "m", "y", "k"] as const).map((k) => (
                  <div key={k}>
                    <label className="mb-1 block text-sm font-medium uppercase text-gray-700">{k} *</label>
                    <input
                      required
                      type="number"
                      min={0}
                      max={100}
                      value={cForm[k]}
                      onChange={(e) => setCForm({ ...cForm, [k]: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Podtyp</label>
                <select
                  value={cForm.subcategory_id === "" ? "" : String(cForm.subcategory_id)}
                  onChange={(e) =>
                    setCForm({
                      ...cForm,
                      subcategory_id: e.target.value === "" ? "" : parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">— (výchozí CMYK)</option>
                  {subs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={cForm.is_active}
                  onChange={(e) => setCForm({ ...cForm, is_active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Aktivní (dostupná pro výběr u produktů)
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={saving || !canWrite}
                  className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? "Ukládám…" : "Uložit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
