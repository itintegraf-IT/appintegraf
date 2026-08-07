"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, Plus, Trash2, Save, Play } from "lucide-react";
import {
  DEFAULT_PRODUCT_EXPORT_COLUMNS,
  PRODUCT_EXPORT_COLUMNS,
  type ProductExportColumnKey,
} from "@/lib/iml-export-product-columns";
import { IML_ITEM_STATUSES, imlItemStatusLabel } from "@/lib/iml-constants";

type Template = {
  id: number;
  name: string;
  format: string;
  columns: unknown;
  filters: unknown;
  updated_at: string;
};

type Customer = { id: number; name: string };

type Props = { canWrite: boolean };

function parseColumnKeys(columns: unknown): ProductExportColumnKey[] {
  if (!Array.isArray(columns)) return [...DEFAULT_PRODUCT_EXPORT_COLUMNS];
  const keys: ProductExportColumnKey[] = [];
  for (const item of columns) {
    if (typeof item === "string") {
      const found = PRODUCT_EXPORT_COLUMNS.find((c) => c.key === item);
      if (found) keys.push(found.key);
    } else if (item && typeof item === "object" && "key" in item) {
      const key = String((item as { key: unknown }).key);
      const found = PRODUCT_EXPORT_COLUMNS.find((c) => c.key === key);
      if (found) keys.push(found.key);
    }
  }
  return keys.length ? keys : [...DEFAULT_PRODUCT_EXPORT_COLUMNS];
}

function parseFilters(filters: unknown): {
  search: string;
  customer_id: string;
  item_status: string;
  product_kind: string;
  archive: string;
} {
  const f = filters && typeof filters === "object" ? (filters as Record<string, unknown>) : {};
  return {
    search: typeof f.search === "string" ? f.search : "",
    customer_id: f.customer_id != null ? String(f.customer_id) : "",
    item_status:
      typeof f.item_status === "string"
        ? f.item_status
        : typeof f.status === "string"
          ? f.status
          : "",
    product_kind: f.product_kind === "iml" || f.product_kind === "etikety" ? f.product_kind : "",
    archive:
      f.archive === "archived" || f.archive === "all" || f.archive === "active"
        ? f.archive
        : "active",
  };
}

export function ImlExportsClient({ canWrite }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("Moje šablona");
  const [format, setFormat] = useState<"csv" | "xml">("csv");
  const [selected, setSelected] = useState<Set<ProductExportColumnKey>>(
    () => new Set(DEFAULT_PRODUCT_EXPORT_COLUMNS)
  );
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [itemStatus, setItemStatus] = useState("");
  const [productKind, setProductKind] = useState("");
  const [archive, setArchive] = useState("active");

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/iml/export-templates");
    if (res.ok) {
      const data = await res.json();
      setTemplates(data.templates ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTemplates();
    fetch("/api/iml/customers")
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers ?? []))
      .catch(() => {});
  }, [loadTemplates]);

  const toggleColumn = (key: ProductExportColumnKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filtersPayload = () => ({
    search: search || undefined,
    customer_id: customerId ? parseInt(customerId, 10) : undefined,
    item_status: itemStatus || undefined,
    product_kind: productKind || undefined,
    archive: archive || "active",
  });

  const columnsPayload = () =>
    PRODUCT_EXPORT_COLUMNS.filter((c) => selected.has(c.key)).map((c) => ({ key: c.key }));

  const resetForm = () => {
    setEditingId(null);
    setName("Moje šablona");
    setFormat("csv");
    setSelected(new Set(DEFAULT_PRODUCT_EXPORT_COLUMNS));
    setSearch("");
    setCustomerId("");
    setItemStatus("");
    setProductKind("");
    setArchive("active");
    setError(null);
  };

  const loadTemplate = (t: Template) => {
    setEditingId(t.id);
    setName(t.name);
    setFormat(t.format === "xml" ? "xml" : "csv");
    setSelected(new Set(parseColumnKeys(t.columns)));
    const f = parseFilters(t.filters);
    setSearch(f.search);
    setCustomerId(f.customer_id);
    setItemStatus(f.item_status);
    setProductKind(f.product_kind);
    setArchive(f.archive);
    setError(null);
  };

  const saveTemplate = async () => {
    if (!canWrite) return;
    if (selected.size === 0) {
      setError("Vyberte alespoň jeden sloupec");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name,
        format,
        columns: columnsPayload(),
        filters: filtersPayload(),
      };
      const res = await fetch(
        editingId ? `/api/iml/export-templates/${editingId}` : "/api/iml/export-templates",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Uložení selhalo");
        return;
      }
      await loadTemplates();
      if (!editingId && data.template?.id) setEditingId(data.template.id);
    } finally {
      setBusy(false);
    }
  };

  const deleteTemplate = async (id: number) => {
    if (!canWrite || !confirm("Smazat šablonu?")) return;
    const res = await fetch(`/api/iml/export-templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (editingId === id) resetForm();
      await loadTemplates();
    }
  };

  const runExport = async (opts?: { templateId?: number }) => {
    setBusy(true);
    setError(null);
    try {
      const body = opts?.templateId
        ? { templateId: opts.templateId }
        : {
            format,
            columns: columnsPayload(),
            filters: filtersPayload(),
          };
      if (!opts?.templateId && selected.size === 0) {
        setError("Vyberte alespoň jeden sloupec");
        return;
      }
      const res = await fetch("/api/iml/products/export/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Export selhal");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] ?? `iml-produkty.${format === "xml" ? "xml" : "csv"}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Uložené šablony</h2>
          {canWrite && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Nová
            </button>
          )}
        </div>
        {loading ? (
          <p className="text-sm text-gray-500">Načítání…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-gray-500">Zatím žádné šablony.</p>
        ) : (
          <ul className="space-y-1">
            {templates.map((t) => (
              <li key={t.id}>
                <div
                  className={`flex items-center gap-1 rounded-lg px-2 py-1.5 ${
                    editingId === t.id ? "bg-red-50" : "hover:bg-gray-50"
                  }`}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left text-sm"
                    onClick={() => loadTemplate(t)}
                  >
                    <span className="block truncate font-medium text-gray-900">{t.name}</span>
                    <span className="text-xs uppercase text-gray-500">{t.format}</span>
                  </button>
                  <button
                    type="button"
                    title="Spustit"
                    disabled={busy}
                    onClick={() => runExport({ templateId: t.id })}
                    className="rounded p-1.5 text-red-600 hover:bg-red-50"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  {canWrite && (
                    <button
                      type="button"
                      title="Smazat"
                      onClick={() => deleteTemplate(t.id)}
                      className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-gray-500">
          Rychlý export všech sloupců zůstává na{" "}
          <Link href="/iml/products" className="text-red-700 underline">
            seznamu produktů
          </Link>
          .
        </p>
      </aside>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[200px] flex-1 text-sm">
            <span className="mb-1 block text-gray-600">Název šablony</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canWrite}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Formát</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value === "xml" ? "xml" : "csv")}
              className="rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="csv">CSV</option>
              <option value="xml">XML</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-gray-600">Hledat</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Kód, název, SKU…"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Zákazník</span>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">Všichni</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Stav</span>
            <select
              value={itemStatus}
              onChange={(e) => setItemStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">Vše</option>
              {IML_ITEM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {imlItemStatusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Druh</span>
            <select
              value={productKind}
              onChange={(e) => setProductKind(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">Vše</option>
              <option value="iml">IML</option>
              <option value="etikety">Etikety</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Archiv</span>
            <select
              value={archive}
              onChange={(e) => setArchive(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="active">Jen aktivní</option>
              <option value="archived">Jen archiv</option>
              <option value="all">Vše</option>
            </select>
          </label>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-800">Sloupce</p>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCT_EXPORT_COLUMNS.map((col) => (
              <label key={col.key} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selected.has(col.key)}
                  onChange={() => toggleColumn(col.key)}
                />
                {col.label}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => runExport()}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Spustit export
          </button>
          {canWrite && (
            <button
              type="button"
              disabled={busy}
              onClick={saveTemplate}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {editingId ? "Uložit změny" : "Uložit šablonu"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
