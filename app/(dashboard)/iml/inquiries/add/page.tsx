"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { CustomFieldsFormSection } from "../../_components/CustomFieldsFormSection";

type Customer = { id: number; name: string };
type Product = {
  id: number;
  ig_code: string | null;
  ig_short_name: string | null;
  client_name: string | null;
};

export default function ImlInquiryAddPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    customer_id: "",
    inquiry_number: "",
    inquiry_date: new Date().toISOString().slice(0, 10),
    status: "nová",
    notes: "",
  });
  const [items, setItems] = useState<
    { product_id: string; quantity: string; unit_price: string }[]
  >([]);
  const [customData, setCustomData] = useState<Record<string, string | number | boolean>>({});

  useEffect(() => {
    fetch("/api/iml/customers")
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const cid = form.customer_id;
    if (!cid) {
      setProducts([]);
      return;
    }
    fetch(`/api/iml/products?customer_id=${cid}`)
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []))
      .catch(() => setProducts([]));
  }, [form.customer_id]);

  const addItem = () => {
    setItems([...items, { product_id: "", quantity: "1", unit_price: "" }]);
  };

  const removeItem = (i: number) => {
    setItems(items.filter((_, idx) => idx !== i));
  };

  const updateItem = (i: number, field: string, value: string) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: value };
    setItems(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payloadItems = items
        .filter((it) => it.product_id && parseInt(it.quantity, 10) > 0)
        .map((it) => ({
          product_id: parseInt(it.product_id, 10),
          quantity: parseInt(it.quantity, 10),
          unit_price: it.unit_price ? parseFloat(it.unit_price) : null,
        }));

      const res = await fetch("/api/iml/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: parseInt(form.customer_id, 10),
          inquiry_number: form.inquiry_number.trim() || undefined,
          inquiry_date: form.inquiry_date,
          status: form.status,
          notes: form.notes || undefined,
          items: payloadItems,
          custom_data: Object.keys(customData).length > 0 ? customData : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Chyba při ukládání");
        setLoading(false);
        return;
      }

      router.push(`/iml/inquiries/${data.id}`);
      router.refresh();
    } catch {
      setError("Chyba při ukládání");
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nová poptávka</h1>
          <p className="mt-1 text-gray-600">Vytvoření poptávky IML</p>
        </div>
        <Link
          href="/iml/inquiries"
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Zákazník *</label>
            <select
              required
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
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Číslo poptávky</label>
            <input
              type="text"
              value={form.inquiry_number}
              onChange={(e) => setForm({ ...form, inquiry_number: e.target.value })}
              placeholder="Volitelné – vygeneruje se automaticky"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Datum *</label>
            <input
              type="date"
              required
              value={form.inquiry_date}
              onChange={(e) => setForm({ ...form, inquiry_date: e.target.value })}
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

        <div className="mt-6">
          <CustomFieldsFormSection
            entity="inquiries"
            values={customData}
            onChange={setCustomData}
          />
        </div>

        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Položky</h3>
            <button
              type="button"
              onClick={addItem}
              disabled={!form.customer_id}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Přidat položku
            </button>
          </div>
          {!form.customer_id ? (
            <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
              Nejprve vyberte zákazníka – zobrazí se jeho produkty.
            </p>
          ) : items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
              Přidejte alespoň jednu položku
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((it, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <select
                    value={it.product_id}
                    onChange={(e) => updateItem(i, "product_id", e.target.value)}
                    className="min-w-[200px] rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="">— Produkt —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.ig_code ?? p.id} – {p.client_name ?? p.ig_short_name ?? "-"}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={it.quantity}
                    onChange={(e) => updateItem(i, "quantity", e.target.value)}
                    className="w-24 rounded-lg border border-gray-300 px-3 py-2"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={it.unit_price}
                    onChange={(e) => updateItem(i, "unit_price", e.target.value)}
                    placeholder="Cena/ks"
                    className="w-28 rounded-lg border border-gray-300 px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="rounded p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Ukládám…" : "Vytvořit poptávku"}
          </button>
          <Link
            href="/iml/inquiries"
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </Link>
        </div>
      </form>
    </>
  );
}
