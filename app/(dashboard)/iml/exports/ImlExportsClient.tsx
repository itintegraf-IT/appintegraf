"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, Plus, Trash2, Save, Play } from "lucide-react";
import {
  DEFAULT_PRODUCT_EXPORT_COLUMNS,
  PRODUCT_EXPORT_COLUMNS,
  PRODUCT_EXPORT_FIELD_GROUPS,
  type ProductExportColumnKey,
} from "@/lib/iml-export-product-columns";
import {
  DEFAULT_ORDER_LINE_EXPORT_COLUMNS,
  ORDER_EXPORT_COLUMN_GROUPS,
  ORDER_LINE_EXPORT_COLUMNS,
  type OrderLineExportColumnKey,
} from "@/lib/iml-export-order-columns";
import {
  IML_ITEM_STATUSES,
  IML_ORDER_STATUSES,
  imlItemStatusLabel,
  imlOrderStatusLabel,
} from "@/lib/iml-constants";

type ExportEntity = "products" | "orders";

type Template = {
  id: number;
  name: string;
  format: string;
  columns: unknown;
  filters: unknown;
  updated_at: string;
  entity?: string;
};

type Customer = { id: number; name: string };

type Props = { canWrite: boolean };

function parseProductColumnKeys(columns: unknown): ProductExportColumnKey[] {
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

function parseOrderColumnKeys(columns: unknown): OrderLineExportColumnKey[] {
  if (!Array.isArray(columns)) return [...DEFAULT_ORDER_LINE_EXPORT_COLUMNS];
  const keys: OrderLineExportColumnKey[] = [];
  for (const item of columns) {
    if (typeof item === "string") {
      const found = ORDER_LINE_EXPORT_COLUMNS.find((c) => c.key === item);
      if (found) keys.push(found.key);
    } else if (item && typeof item === "object" && "key" in item) {
      const key = String((item as { key: unknown }).key);
      const found = ORDER_LINE_EXPORT_COLUMNS.find((c) => c.key === key);
      if (found) keys.push(found.key);
    }
  }
  return keys.length ? keys : [...DEFAULT_ORDER_LINE_EXPORT_COLUMNS];
}

export function ImlExportsClient({ canWrite }: Props) {
  const [entity, setEntity] = useState<ExportEntity>("products");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("Moje šablona");
  const [format, setFormat] = useState<"csv" | "xml">("csv");

  const [productSelected, setProductSelected] = useState<Set<ProductExportColumnKey>>(
    () => new Set(DEFAULT_PRODUCT_EXPORT_COLUMNS)
  );
  const [orderSelected, setOrderSelected] = useState<Set<OrderLineExportColumnKey>>(
    () => new Set(DEFAULT_ORDER_LINE_EXPORT_COLUMNS)
  );

  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [itemStatus, setItemStatus] = useState("");
  const [productKind, setProductKind] = useState("");
  const [archive, setArchive] = useState("active");
  const [orderStatus, setOrderStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [includePrint, setIncludePrint] = useState(false);
  const [includeSoftproof, setIncludeSoftproof] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/iml/export-templates?entity=${entity}`);
    if (res.ok) {
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } else {
      setTemplates([]);
    }
    setLoading(false);
  }, [entity]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    fetch("/api/iml/customers")
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers ?? []))
      .catch(() => {});
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName(entity === "orders" ? "Šablona objednávek" : "Moje šablona");
    setFormat("csv");
    setProductSelected(new Set(DEFAULT_PRODUCT_EXPORT_COLUMNS));
    setOrderSelected(new Set(DEFAULT_ORDER_LINE_EXPORT_COLUMNS));
    setSearch("");
    setCustomerId("");
    setItemStatus("");
    setProductKind("");
    setArchive("active");
    setOrderStatus("");
    setDateFrom("");
    setDateTo("");
    setIncludePrint(false);
    setIncludeSoftproof(false);
    setError(null);
  };

  useEffect(() => {
    resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when switching entity
  }, [entity]);

  const loadTemplate = (t: Template) => {
    setEditingId(t.id);
    setName(t.name);
    setFormat(t.format === "xml" ? "xml" : "csv");
    setError(null);
    const f =
      t.filters && typeof t.filters === "object" ? (t.filters as Record<string, unknown>) : {};
    setSearch(typeof f.search === "string" ? f.search : "");
    setCustomerId(f.customer_id != null ? String(f.customer_id) : "");

    if (entity === "orders") {
      setOrderSelected(new Set(parseOrderColumnKeys(t.columns)));
      setOrderStatus(typeof f.status === "string" ? f.status : "");
      setDateFrom(typeof f.date_from === "string" ? f.date_from : "");
      setDateTo(typeof f.date_to === "string" ? f.date_to : "");
    } else {
      setProductSelected(new Set(parseProductColumnKeys(t.columns)));
      setItemStatus(
        typeof f.item_status === "string"
          ? f.item_status
          : typeof f.status === "string"
            ? f.status
            : ""
      );
      setProductKind(f.product_kind === "iml" || f.product_kind === "etikety" ? f.product_kind : "");
      setArchive(
        f.archive === "archived" || f.archive === "all" || f.archive === "active"
          ? f.archive
          : "active"
      );
    }
    setIncludePrint(f.include_print === true || f.include_print === 1 || f.include_print === "1");
    setIncludeSoftproof(
      f.include_softproof === true || f.include_softproof === 1 || f.include_softproof === "1"
    );
  };

  const columnsPayload = () =>
    entity === "orders"
      ? ORDER_LINE_EXPORT_COLUMNS.filter((c) => orderSelected.has(c.key)).map((c) => ({
          key: c.key,
        }))
      : PRODUCT_EXPORT_COLUMNS.filter((c) => productSelected.has(c.key)).map((c) => ({
          key: c.key,
        }));

  const filtersPayload = () =>
    entity === "orders"
      ? {
          search: search || undefined,
          customer_id: customerId ? parseInt(customerId, 10) : undefined,
          status: orderStatus || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          include_print: includePrint || undefined,
          include_softproof: includeSoftproof || undefined,
        }
      : {
          search: search || undefined,
          customer_id: customerId ? parseInt(customerId, 10) : undefined,
          item_status: itemStatus || undefined,
          product_kind: productKind || undefined,
          archive: archive || "active",
          include_print: includePrint || undefined,
          include_softproof: includeSoftproof || undefined,
        };

  const selectedCount = entity === "orders" ? orderSelected.size : productSelected.size;

  const saveTemplate = async () => {
    if (!canWrite) return;
    if (selectedCount === 0) {
      setError("Vyberte alespoň jeden sloupec");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name,
        entity,
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
      if (data.template) loadTemplate(data.template);
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
        ? {
            templateId: opts.templateId,
            ...(includePrint ? { include_print: true } : {}),
            ...(includeSoftproof ? { include_softproof: true } : {}),
          }
        : {
            format,
            columns: columnsPayload(),
            filters: filtersPayload(),
            ...(includePrint ? { include_print: true } : {}),
            ...(includeSoftproof ? { include_softproof: true } : {}),
          };
      if (!opts?.templateId && selectedCount === 0) {
        setError("Vyberte alespoň jeden sloupec");
        return;
      }
      const url =
        entity === "orders" ? "/api/iml/orders/export/run" : "/api/iml/products/export/run";
      const res = await fetch(url, {
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
      const fallback =
        entity === "orders"
          ? includePrint || includeSoftproof
            ? "iml-objednavky.zip"
            : `iml-objednavky.${format === "xml" ? "xml" : "csv"}`
          : includePrint || includeSoftproof
            ? "iml-produkty.zip"
            : `iml-produkty.${format === "xml" ? "xml" : "csv"}`;
      const filename = match?.[1] ?? fallback;
      const urlObj = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = urlObj;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(urlObj);
    } finally {
      setBusy(false);
    }
  };

  const tabClass = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-sm font-medium ${
      active
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={tabClass(entity === "products")} onClick={() => setEntity("products")}>
          Produkty
        </button>
        <button type="button" className={tabClass(entity === "orders")} onClick={() => setEntity("orders")}>
          Objednávky
        </button>
      </div>

      {entity === "orders" && (
        <p className="text-sm text-gray-600">
          Export objednávek je po řádcích položek (CSV) nebo vnořené XML Order → Items — vhodné pro
          import do jiných systémů.
        </p>
      )}

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
            {entity === "orders" ? (
              <>
                Rychlý ad-hoc export zůstává na{" "}
                <Link href="/iml/orders" className="text-red-700 underline">
                  seznamu objednávek
                </Link>
                .
              </>
            ) : (
              <>
                Rychlý export všech sloupců zůstává na{" "}
                <Link href="/iml/products" className="text-red-700 underline">
                  seznamu produktů
                </Link>
                .
              </>
            )}
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
                placeholder={
                  entity === "orders" ? "Číslo objednávky / zakázky…" : "Kód, název, SKU…"
                }
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

            {entity === "orders" ? (
              <>
                <label className="text-sm">
                  <span className="mb-1 block text-gray-600">Stav objednávky</span>
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="">Vše</option>
                    {IML_ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {imlOrderStatusLabel(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-gray-600">Přijato od</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-gray-600">Přijato do</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </label>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>

          {(entity === "products" || entity === "orders") && (
            <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-sm font-medium text-gray-800">Soubory v exportu</p>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={includePrint}
                  onChange={(e) => setIncludePrint(e.target.checked)}
                />
                Tisková data (PDF)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={includeSoftproof}
                  onChange={(e) => setIncludeSoftproof(e.target.checked)}
                />
                Softproof (obrázek)
              </label>
              {(includePrint || includeSoftproof) && (
                <p className="text-xs text-gray-500">
                  Export bude ZIP s tabulkou a soubory ve složce soubory/
                </p>
              )}
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium text-gray-800">Sloupce</p>
            {entity === "orders" ? (
              <div className="space-y-4">
                {ORDER_EXPORT_COLUMN_GROUPS.map((group) => {
                  const cols = ORDER_LINE_EXPORT_COLUMNS.filter((c) => c.group === group.id);
                  return (
                    <div key={group.id}>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                        {group.label}
                      </p>
                      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                        {cols.map((col) => (
                          <label
                            key={col.key}
                            className="flex items-center gap-2 text-sm text-gray-700"
                          >
                            <input
                              type="checkbox"
                              checked={orderSelected.has(col.key)}
                              onChange={() => {
                                setOrderSelected((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(col.key)) next.delete(col.key);
                                  else next.add(col.key);
                                  return next;
                                });
                              }}
                            />
                            {col.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                {PRODUCT_EXPORT_FIELD_GROUPS.map((group) => {
                  const cols = PRODUCT_EXPORT_COLUMNS.filter((c) => c.group === group.id);
                  return (
                    <div key={group.id}>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                        {group.label}
                      </p>
                      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                        {cols.map((col) => (
                          <label
                            key={col.key}
                            className="flex items-center gap-2 text-sm text-gray-700"
                          >
                            <input
                              type="checkbox"
                              checked={productSelected.has(col.key)}
                              onChange={() => {
                                setProductSelected((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(col.key)) next.delete(col.key);
                                  else next.add(col.key);
                                  return next;
                                });
                              }}
                            />
                            {col.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
    </div>
  );
}
