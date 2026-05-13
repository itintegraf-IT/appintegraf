"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { CustomFieldsFormSection } from "../../../_components/CustomFieldsFormSection";

type Customer = { id: number; name: string };
type Product = {
  id: number;
  ig_code: string | null;
  ig_short_name: string | null;
  client_code: string | null;
  client_name: string | null;
  stock_quantity: number | null;
  item_status: string | null;
};
type SelectedOrderItem = {
  product_id: number;
  quantity: string;
  unit_price: string;
};
type OrderItemResp = {
  product_id: number;
  quantity: number;
  unit_price: number | null;
  iml_products?: {
    id: number;
    ig_code: string | null;
    ig_short_name: string | null;
    client_name: string | null;
  } | null;
};

export default function ImlOrderEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supervisor, setSupervisor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [supervisorAck, setSupervisorAck] = useState(false);
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);

  const [form, setForm] = useState({
    customer_id: "",
    order_number: "",
    order_date: "",
    expected_ship_date: "",
    status: "nová",
    notes: "",
  });
  const [selectedItems, setSelectedItems] = useState<SelectedOrderItem[]>([]);
  const [picker, setPicker] = useState<{ product_id: string; quantity: string; unit_price: string }>({
    product_id: "",
    quantity: "1",
    unit_price: "",
  });
  const [customData, setCustomData] = useState<Record<string, string | number | boolean>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    Promise.all([
      fetch("/api/iml/customers").then((r) => r.json()),
      fetch("/api/iml/capabilities").then((r) => r.json()),
      fetch(`/api/iml/orders/${id}`).then((r) => r.json()),
    ])
      .then(([custData, capData, orderData]) => {
        setCustomers(custData.customers ?? []);
        setSupervisor(!!capData.supervisor_override);
        const o = orderData;
        if (!o?.id) {
          setError("Objednávka nenalezena");
          setLoadingData(false);
          return;
        }
        setForm({
          customer_id: String(o.customer_id ?? ""),
          order_number: o.order_number ?? "",
          order_date: o.order_date ? new Date(o.order_date).toISOString().slice(0, 10) : "",
          expected_ship_date: o.expected_ship_date
            ? new Date(o.expected_ship_date).toISOString().slice(0, 10)
            : "",
          status: o.status ?? "nová",
          notes: o.notes ?? "",
        });
        const orderItems = Array.isArray(o.iml_order_items) ? (o.iml_order_items as OrderItemResp[]) : [];
        setSelectedItems(
          orderItems.map((it) => ({
            product_id: it.product_id,
            quantity: String(it.quantity),
            unit_price: it.unit_price != null ? String(it.unit_price) : "",
          }))
        );

        const fromOrder = orderItems
          .map((it) => {
            if (!it.iml_products) return null;
            return {
              id: it.iml_products.id,
              ig_code: it.iml_products.ig_code,
              ig_short_name: it.iml_products.ig_short_name,
              client_code: null,
              client_name: it.iml_products.client_name,
              stock_quantity: null,
              item_status: null,
            } as Product;
          })
          .filter(Boolean) as Product[];
        setProducts(fromOrder);
        if (o.custom_data && typeof o.custom_data === "object") {
          const cd = o.custom_data as Record<string, unknown>;
          const init: Record<string, string | number | boolean> = {};
          for (const [k, v] of Object.entries(cd)) {
            if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") init[k] = v;
          }
          setCustomData(init);
        }
        const cid = String(o.customer_id ?? "");
        if (cid) {
          fetch(`/api/iml/products?customer_id=${cid}`)
            .then((r) => r.json())
            .then((d) => {
              const fetched = (d.products ?? []) as Product[];
              setProducts((prev) => {
                const merged = new Map<number, Product>();
                for (const p of fetched) merged.set(p.id, p);
                for (const p of prev) if (!merged.has(p.id)) merged.set(p.id, p);
                return Array.from(merged.values());
              });
            })
            .catch(() => setProducts([]));
        }
        setLoadingData(false);
      })
      .catch(() => {
        setError("Chyba při načítání");
        setLoadingData(false);
      });
  }, [id]);

  const filteredProducts = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (q.length < 3) return products;
    return products.filter(
      (p) =>
        (p.ig_code?.toLowerCase().includes(q) ?? false) ||
        (p.ig_short_name?.toLowerCase().includes(q) ?? false) ||
        (p.client_name?.toLowerCase().includes(q) ?? false) ||
        (p.client_code?.toLowerCase().includes(q) ?? false)
    );
  }, [products, debouncedSearch]);

  const productById = useMemo(() => {
    const m = new Map<number, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const selectedProductIds = useMemo(
    () => new Set(selectedItems.map((row) => row.product_id)),
    [selectedItems]
  );

  const pickerProducts = useMemo(
    () => filteredProducts.filter((p) => !selectedProductIds.has(p.id)),
    [filteredProducts, selectedProductIds]
  );

  const addSelectedItem = () => {
    const pid = parseInt(picker.product_id, 10);
    if (!pid) {
      setError("Vyberte produkt.");
      return;
    }
    if (selectedItems.some((row) => row.product_id === pid)) {
      setError("Produkt už je v položkách objednávky.");
      return;
    }
    setSelectedItems((prev) => [
      ...prev,
      {
        product_id: pid,
        quantity: picker.quantity.trim() || "1",
        unit_price: picker.unit_price.trim(),
      },
    ]);
    setPicker({ product_id: "", quantity: "1", unit_price: "" });
  };

  const setItemField = (
    index: number,
    key: "quantity" | "unit_price",
    value: string
  ) => {
    setSelectedItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const removeItem = (index: number) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const buildItems = () =>
    selectedItems
      .map((row) => {
        const q = parseInt(row.quantity, 10);
        if (!q || q <= 0) return null;
        const up = row.unit_price.trim();
        const unitPrice = up !== "" ? parseFloat(up) : null;
        return { product_id: row.product_id, quantity: q, unit_price: unitPrice };
      })
      .filter(Boolean) as { product_id: number; quantity: number; unit_price: number | null }[];

  const submitPut = async (withSupervisorOverride: boolean) => {
    const orderItems = buildItems();
    if (orderItems.length === 0) {
      setError("Zadejte množství u alespoň jednoho produktu.");
      return;
    }

    const res = await fetch(`/api/iml/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_date: form.order_date,
        expected_ship_date: form.expected_ship_date.trim() || null,
        status: form.status,
        notes: form.notes || null,
        items: orderItems,
        custom_data: Object.keys(customData).length > 0 ? customData : null,
        supervisor_override: withSupervisorOverride,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data.field === "items") {
      if (supervisor) {
        setShowSupervisorModal(true);
        setLoading(false);
        return;
      }
      setError(data.error ?? "Nelze uložit kvůli stavu produktu.");
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError(data.error ?? "Chyba při ukládání");
      setLoading(false);
      return;
    }

    router.push(`/iml/orders/${id}`);
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await submitPut(supervisorAck);
    } catch {
      setError("Chyba při ukládání");
      setLoading(false);
    }
  };

  const confirmSupervisorModal = async () => {
    setSupervisorAck(true);
    setShowSupervisorModal(false);
    setLoading(true);
    try {
      await submitPut(true);
    } catch {
      setError("Chyba při ukládání");
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Načítání…</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upravit objednávku</h1>
          <p className="mt-1 text-gray-600">{form.order_number}</p>
        </div>
        <Link
          href={`/iml/orders/${id}`}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="mb-4 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-600">
          Doručovací adresa na objednávce je uložena jako snapshot z okamžiku vytvoření – při úpravě se
          nemění. Zobrazí se v detailu objednávky.
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Zákazník</label>
            <input
              type="text"
              readOnly
              value={customers.find((c) => c.id === parseInt(form.customer_id, 10))?.name ?? ""}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Číslo objednávky</label>
            <input
              type="text"
              readOnly
              value={form.order_number}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Datum přijetí *</label>
            <input
              type="date"
              required
              value={form.order_date}
              onChange={(e) => setForm({ ...form, order_date: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Plánovaná expedice</label>
            <input
              type="date"
              value={form.expected_ship_date}
              onChange={(e) => setForm({ ...form, expected_ship_date: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Stav</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="nová">Nová</option>
              <option value="potvrzená">Potvrzená</option>
              <option value="odeslaná">Odeslaná</option>
              <option value="dokončená">Dokončená</option>
              <option value="zrušená">Zrušená</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Poznámky</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
        </div>

        {supervisor && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-900">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={supervisorAck}
                onChange={(e) => setSupervisorAck(e.target.checked)}
              />
              Povolit řádky s produkty mimo stav „aktivní“ (supervisor)
            </label>
          </div>
        )}

        <div className="mt-6">
          <CustomFieldsFormSection
            entity="orders"
            values={customData}
            onChange={setCustomData}
          />
        </div>

        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Produkty</h3>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              type="search"
              placeholder="Filtrovat od 3 znaků…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-[240px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="mb-3 grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">Produkt</label>
              <select
                value={picker.product_id}
                onChange={(e) => setPicker((prev) => ({ ...prev, product_id: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">— Vyberte produkt —</option>
                {pickerProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.ig_code ?? `#${p.id}`) + " — " + (p.client_name ?? p.ig_short_name ?? "Bez názvu")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Množství</label>
              <input
                type="number"
                min="1"
                value={picker.quantity}
                onChange={(e) => setPicker((prev) => ({ ...prev, quantity: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-right"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Cena/ks</label>
              <input
                type="number"
                step="0.01"
                value={picker.unit_price}
                onChange={(e) => setPicker((prev) => ({ ...prev, unit_price: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-right"
              />
            </div>
            <div className="md:col-span-4">
              <button
                type="button"
                onClick={addSelectedItem}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Přidat položku
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Kód IG</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Název u klienta</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Skladem</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Stav</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Množství</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Cena/ks</th>
                </tr>
              </thead>
              <tbody>
                {selectedItems.map((row, index) => {
                  const p = productById.get(row.product_id);
                  if (!p) return null;
                  const st = p.item_status?.trim() || "";
                  const inactive = st !== "" && st !== "aktivní";
                  return (
                    <tr
                      key={`${row.product_id}-${index}`}
                      className={`border-b border-gray-100 ${inactive ? "bg-amber-50/50" : ""}`}
                    >
                      <td className="px-3 py-2 font-mono">{p.ig_code ?? "—"}</td>
                      <td className="px-3 py-2">{p.client_name ?? p.ig_short_name ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        {p.stock_quantity != null ? p.stock_quantity : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {inactive ? (
                          <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs">
                            {p.item_status}
                          </span>
                        ) : (
                          <span className="text-gray-600">{p.item_status ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="1"
                          value={row.quantity}
                          onChange={(e) => setItemField(index, "quantity", e.target.value)}
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={row.unit_price}
                          onChange={(e) => setItemField(index, "unit_price", e.target.value)}
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-right"
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="ml-2 rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        >
                          Odebrat
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {selectedItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-sm text-gray-500">
                      Zatím nejsou přidané žádné položky.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Ukládám…" : "Uložit"}
          </button>
          <Link
            href={`/iml/orders/${id}`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </Link>
        </div>
      </form>

      {showSupervisorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Neaktivní produkt</h3>
            <p className="mt-2 text-sm text-gray-600">
              Jako supervisor můžete pokračovat v uložení objednávky.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSupervisorModal(false);
                  setLoading(false);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={confirmSupervisorModal}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
              >
                Potvrdit jako supervisor
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
