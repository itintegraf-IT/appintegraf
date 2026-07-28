"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { FileText, Upload, AlertTriangle } from "lucide-react";
import { ORDER_PDF_TEMPLATES } from "@/lib/iml/order-pdf/registry";

type Customer = { id: number; name: string };
type ProductOption = {
  id: number;
  ig_code: string | null;
  ig_short_name: string | null;
  client_code: string | null;
  client_name: string | null;
};

type PreviewItem = {
  itemNo: string;
  description: string;
  customerMaterialNo: string | null;
  yourMaterialNo: string | null;
  quantity: number | null;
  price: number | null;
  priceBasis: number;
  netAmount: number | null;
  deliveryDate: string | null;
  productId: number | null;
  productLabel: string | null;
  matchedBy: "client_code" | "ig_code" | null;
};

type PreviewResponse = {
  template: string;
  order: {
    orderNumber: string;
    orderDate: string | null;
    expectedShipDate: string | null;
    currency: string | null;
    notes: string;
    totalAmount: number | null;
  };
  duplicate: boolean;
  suggestedCustomer: { id: number; name: string } | null;
  items: PreviewItem[];
  warnings: string[];
};

type EditableRow = {
  itemNo: string;
  description: string;
  customerMaterialNo: string | null;
  yourMaterialNo: string | null;
  deliveryDate: string | null;
  quantity: string;
  subtotal: string;
  productId: string;
  productLabel: string | null;
  matchedBy: "client_code" | "ig_code" | null;
};

function formatCzk(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PdfOrderImport() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templateKey, setTemplateKey] = useState("auto");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [duplicate, setDuplicate] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerProducts, setCustomerProducts] = useState<ProductOption[]>([]);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [success, setSuccess] = useState<{ id: number; order_number: string } | null>(null);
  const [form, setForm] = useState({
    order_number: "",
    order_date: "",
    expected_ship_date: "",
    customer_id: "",
    notes: "",
  });

  useEffect(() => {
    fetch("/api/iml/customers?scope=units")
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.customer_id) {
      setCustomerProducts([]);
      return;
    }
    fetch(`/api/iml/products?customer_id=${form.customer_id}`)
      .then((r) => r.json())
      .then((d) => setCustomerProducts(d.products ?? []))
      .catch(() => setCustomerProducts([]));
  }, [form.customer_id]);

  const productOptionLabel = (p: ProductOption) =>
    `${p.ig_code ?? `#${p.id}`} — ${p.client_name ?? p.ig_short_name ?? "Bez názvu"}`;

  const customerProductIds = useMemo(
    () => new Set(customerProducts.map((p) => p.id)),
    [customerProducts]
  );

  const acceptFile = (f: File | null) => {
    setFile(f);
    setPreview(null);
    setRows([]);
    setWarnings([]);
    setDuplicate(false);
    setSuccess(null);
    setError("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.toLowerCase().endsWith(".pdf")) acceptFile(f);
    else setError("Podporovaný formát: PDF");
  };

  const loadPreview = async () => {
    if (!file) return;
    setLoadingPreview(true);
    setError("");
    setSuccess(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("template", templateKey);
      const res = await fetch("/api/iml/orders/import-pdf", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as PreviewResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Chyba při načítání PDF");

      setPreview(data);
      setWarnings(data.warnings ?? []);
      setDuplicate(data.duplicate);
      setForm({
        order_number: data.order.orderNumber,
        order_date: data.order.orderDate ?? "",
        expected_ship_date: data.order.expectedShipDate ?? "",
        customer_id: data.suggestedCustomer ? String(data.suggestedCustomer.id) : "",
        notes: data.order.notes ?? "",
      });
      setRows(
        (data.items ?? []).map((it) => ({
          itemNo: it.itemNo,
          description: it.description,
          customerMaterialNo: it.customerMaterialNo,
          yourMaterialNo: it.yourMaterialNo,
          deliveryDate: it.deliveryDate,
          quantity: it.quantity != null ? String(it.quantity) : "",
          subtotal: it.netAmount != null ? String(it.netAmount) : "",
          productId: it.productId != null ? String(it.productId) : "",
          productLabel: it.productLabel,
          matchedBy: it.matchedBy,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba při načítání PDF");
    } finally {
      setLoadingPreview(false);
    }
  };

  const setRowField = (index: number, key: "quantity" | "subtotal" | "productId", value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const rowUnitPrice = (row: EditableRow): number | null => {
    const qty = parseInt(row.quantity, 10);
    const sub = parseFloat(row.subtotal.replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(sub)) return null;
    return Math.round((sub / qty) * 100) / 100;
  };

  const unmatchedCount = rows.filter((r) => !r.productId).length;
  const canImport =
    !!preview &&
    !duplicate &&
    !!form.order_number.trim() &&
    !!form.order_date &&
    !!form.customer_id &&
    rows.length > 0 &&
    unmatchedCount === 0 &&
    rows.every((r) => {
      const q = parseInt(r.quantity, 10);
      return Number.isFinite(q) && q > 0;
    });

  const handleImport = async () => {
    if (!canImport) return;
    setImporting(true);
    setError("");
    try {
      const items = rows.map((r) => {
        const quantity = parseInt(r.quantity, 10);
        const sub = parseFloat(r.subtotal.replace(",", "."));
        const subtotal = Number.isFinite(sub) ? sub : null;
        return {
          product_id: parseInt(r.productId, 10),
          quantity,
          subtotal,
          unit_price: rowUnitPrice(r),
        };
      });
      const res = await fetch("/api/iml/orders/import-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_number: form.order_number.trim(),
          order_date: form.order_date,
          expected_ship_date: form.expected_ship_date || undefined,
          customer_id: parseInt(form.customer_id, 10),
          notes: form.notes || undefined,
          items,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba při importu");
      setSuccess({ id: data.id, order_number: data.order_number });
      setPreview(null);
      setRows([]);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba při importu");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          Objednávka <strong>{success.order_number}</strong> byla vytvořena.{" "}
          <Link href={`/iml/orders/${success.id}`} className="font-medium text-green-900 underline">
            Otevřít detail
          </Link>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 max-w-md">
          <label className="mb-1 block text-sm font-medium text-gray-700">Šablona PDF</label>
          <select
            value={templateKey}
            onChange={(e) => setTemplateKey(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="auto">Automaticky (rozpoznat z PDF)</option>
            {ORDER_PDF_TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Formát objednávky konkrétního zákazníka. Další šablony lze postupně přidávat.
          </p>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragOver ? "border-red-400 bg-red-50" : "border-gray-300 bg-gray-50 hover:border-gray-400"
          }`}
        >
          <FileText className="mx-auto mb-2 h-10 w-10 text-gray-500" />
          <p className="mb-2 text-sm font-medium text-gray-700">
            Přetáhněte PDF objednávku sem nebo klikněte pro výběr
          </p>
          <p className="mb-4 text-xs text-gray-500">PDF s textovou vrstvou (ne sken)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Vybrat soubor
          </button>
          {file && (
            <p className="mt-2 text-sm text-gray-600">
              <strong>{file.name}</strong>
            </p>
          )}
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={loadPreview}
            disabled={!file || loadingPreview}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loadingPreview ? "Načítám PDF…" : "Načíst náhled"}
          </button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="mb-1 flex items-center gap-1 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Upozornění
          </p>
          <ul className="list-inside list-disc space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {preview && (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">
              Hlavička objednávky
              {preview.template && (
                <span className="ml-2 font-normal text-gray-500">
                  (šablona:{" "}
                  {ORDER_PDF_TEMPLATES.find((t) => t.key === preview.template)?.label ??
                    preview.template}
                  )
                </span>
              )}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Zákazník *</label>
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">— Vyberte —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Číslo objednávky *
                </label>
                <input
                  type="text"
                  value={form.order_number}
                  onChange={(e) => setForm((f) => ({ ...f, order_number: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Datum přijetí *</label>
                <input
                  type="date"
                  value={form.order_date}
                  onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Plánovaná expedice
                </label>
                <input
                  type="date"
                  value={form.expected_ship_date}
                  onChange={(e) => setForm((f) => ({ ...f, expected_ship_date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
                <p className="mt-1 text-xs text-gray-500">Předvyplněno z nejbližšího data dodání v PDF.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Celkem dle PDF</label>
                <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  {formatCzk(preview.order.totalAmount)} {preview.order.currency ?? ""}
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Poznámky</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-700">Položky ({rows.length})</h3>
              {unmatchedCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  Nespárované položky: {unmatchedCount}
                </span>
              )}
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Popis z PDF</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Kód klienta</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Kód IG</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Produkt</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Množství</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Cena/ks</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Mezisoučet</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const matched = !!row.productId;
                    const selectedId = row.productId ? parseInt(row.productId, 10) : null;
                    const showFallbackOption =
                      selectedId != null && !customerProductIds.has(selectedId);
                    return (
                      <tr
                        key={`${row.itemNo}-${index}`}
                        className={`border-b border-gray-100 ${matched ? "" : "bg-amber-50/60"}`}
                      >
                        <td className="px-3 py-2 font-mono text-xs">{row.itemNo}</td>
                        <td className="max-w-[240px] px-3 py-2">
                          <span className="block truncate" title={row.description}>
                            {row.description}
                          </span>
                          {row.deliveryDate && (
                            <span className="text-xs text-gray-500">Dodání: {row.deliveryDate}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {row.customerMaterialNo ?? "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{row.yourMaterialNo ?? "—"}</td>
                        <td className="px-3 py-2">
                          <select
                            value={row.productId}
                            onChange={(e) => setRowField(index, "productId", e.target.value)}
                            className={`w-full min-w-[200px] rounded border px-2 py-1 text-sm ${
                              matched ? "border-gray-300" : "border-amber-400 bg-white"
                            }`}
                          >
                            <option value="">— Vyberte produkt —</option>
                            {showFallbackOption && (
                              <option value={selectedId!}>
                                {row.productLabel ?? `#${selectedId}`}
                              </option>
                            )}
                            {customerProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {productOptionLabel(p)}
                              </option>
                            ))}
                          </select>
                          {row.matchedBy && (
                            <span className="text-xs text-gray-500">
                              Spárováno dle {row.matchedBy === "client_code" ? "kódu klienta" : "kódu IG"}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            value={row.quantity}
                            onChange={(e) => setRowField(index, "quantity", e.target.value)}
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {formatCzk(rowUnitPrice(row))}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="text"
                            value={row.subtotal}
                            onChange={(e) => setRowField(index, "subtotal", e.target.value)}
                            className="w-28 rounded border border-gray-300 px-2 py-1 text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                          >
                            Odebrat
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-4 text-center text-sm text-gray-500">
                        Žádné položky.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {!form.customer_id && unmatchedCount > 0 && (
              <p className="mt-2 text-xs text-amber-700">
                Pro ruční spárování položek nejdřív vyberte zákazníka.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleImport}
              disabled={!canImport || importing}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {importing ? "Importuji…" : "Importovat objednávku"}
            </button>
            <Link
              href="/iml/orders"
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Zrušit
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
