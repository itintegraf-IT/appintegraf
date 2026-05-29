"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";

type ProductMini = {
  ig_code: string | null;
  client_name: string | null;
  ig_short_name: string | null;
};

type ItemRow = {
  id: number;
  quantity: number;
  unit_price: unknown;
  subtotal: unknown;
  iml_products: ProductMini | null;
};

type AddressOpt = { id: number; label: string | null; city: string | null; street: string | null };

export type InquiryDetailPayload = {
  id: number;
  inquiry_number: string;
  inquiry_date: string;
  status: string;
  notes: string | null;
  converted_order_id: number | null;
  custom_data: unknown;
  customer_id: number;
  iml_customers: { id: number; name: string } | null;
  iml_inquiry_items: ItemRow[];
  iml_orders: { id: number; order_number: string } | null;
};

type Props = {
  initial: InquiryDetailPayload;
  canWrite: boolean;
};

export function InquiryDetailClient({ initial, canWrite }: Props) {
  const [showConvert, setShowConvert] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [shippingId, setShippingId] = useState("");
  const [addresses, setAddresses] = useState<AddressOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const openConvert = async () => {
    setError("");
    setShowConvert(true);
    const res = await fetch(`/api/iml/customers/${initial.customer_id}/shipping-addresses`);
    if (res.ok) {
      const d = await res.json();
      setAddresses(d.addresses ?? []);
      const def = (d.addresses ?? []).find((a: { is_default?: boolean }) => a.is_default);
      if (def) setShippingId(String(def.id));
      else if ((d.addresses ?? []).length === 1) setShippingId(String(d.addresses[0].id));
    }
  };

  const submitConvert = async () => {
    setError("");
    if (!orderNumber.trim()) {
      setError("Vyplňte číslo objednávky");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/iml/inquiries/${initial.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_number: orderNumber.trim(),
          order_date: orderDate,
          shipping_address_id: shippingId ? parseInt(shippingId, 10) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Chyba při překlopení");
        setLoading(false);
        return;
      }
      window.location.href = `/iml/orders/${data.order_id}`;
    } catch {
      setError("Chyba při překlopení");
      setLoading(false);
    }
  };

  const customEntries =
    initial.custom_data &&
    typeof initial.custom_data === "object" &&
    !Array.isArray(initial.custom_data)
      ? Object.entries(initial.custom_data as Record<string, unknown>)
      : [];

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Poptávka {initial.inquiry_number}</h1>
          <p className="mt-1 text-gray-600">
            {initial.iml_customers?.name ?? "Zákazník"} ·{" "}
            {new Date(initial.inquiry_date).toLocaleDateString("cs-CZ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/iml/inquiries"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Seznam
          </Link>
          {canWrite && !initial.converted_order_id && (
            <Link
              href={`/iml/inquiries/${initial.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4" />
              Upravit
            </Link>
          )}
          {canWrite && !initial.converted_order_id && (
            <button
              type="button"
              onClick={openConvert}
              className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
            >
              Překlopit do objednávky
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-gray-500">Stav:</span>{" "}
            <span className="font-medium">{initial.status}</span>
          </div>
          {initial.iml_orders && (
            <div>
              <span className="text-gray-500">Objednávka:</span>{" "}
              <Link
                href={`/iml/orders/${initial.iml_orders.id}`}
                className="font-medium text-red-600 hover:text-red-700"
              >
                {initial.iml_orders.order_number}
              </Link>
            </div>
          )}
        </div>
        {initial.notes && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-500">Poznámky</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{initial.notes}</p>
          </div>
        )}
        {customEntries.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="mb-2 text-sm font-semibold text-gray-700">Vlastní pole</p>
            <dl className="grid gap-2 sm:grid-cols-2 text-sm">
              {customEntries.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="font-medium">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Položky</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Produkt</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Množství</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Cena/ks</th>
              </tr>
            </thead>
            <tbody>
              {initial.iml_inquiry_items.map((row) => (
                <tr key={row.id} className="border-b border-gray-100">
                  <td className="px-3 py-2">
                    {row.iml_products?.ig_code ?? "—"} –{" "}
                    {row.iml_products?.client_name ?? row.iml_products?.ig_short_name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">{row.quantity}</td>
                  <td className="px-3 py-2 text-right">
                    {row.unit_price != null ? Number(row.unit_price).toLocaleString("cs-CZ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Překlopit do objednávky</h3>
            <p className="mt-1 text-sm text-gray-600">
              Zadejte číslo nové objednávky. Akci nelze vrátit zpět.
            </p>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Číslo objednávky *
                </label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Datum objednávky</label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Doručovací adresa (volitelné)
                </label>
                <select
                  value={shippingId}
                  onChange={(e) => setShippingId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">— Bez snapshotu adresy —</option>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {(a.label ?? "Adresa") +
                        (a.city ? `, ${a.city}` : "") +
                        (a.street ? ` – ${a.street}` : "")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConvert(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Zrušit
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={submitConvert}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Překlápím…" : "Potvrdit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
