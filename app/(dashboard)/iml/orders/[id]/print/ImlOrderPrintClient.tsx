"use client";

import Link from "next/link";

export type PrintOrderPayload = {
  id: number;
  order_number: string;
  order_date: string;
  expected_ship_date: string | null;
  status: string;
  customer_name: string;
  notes: string | null;
  shipping: {
    label: string | null;
    recipient: string | null;
    street: string | null;
    city: string | null;
    postal_code: string | null;
    country: string | null;
  };
  items: Array<{
    quantity: number;
    ig_code: string | null;
    ig_short_name: string | null;
    client_name: string | null;
    product_format: string | null;
    pantone_codes: string[];
  }>;
};

function addrLine(s: PrintOrderPayload["shipping"]): string {
  const parts = [s.street, [s.postal_code, s.city].filter(Boolean).join(" "), s.country].filter(
    (x) => x && String(x).trim()
  );
  return parts.join(", ");
}

export function ImlOrderPrintClient({ order }: { order: PrintOrderPayload }) {
  const printedAt = new Date().toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; background: #fff; }
      `}</style>

      <div className="no-print fixed right-4 top-4 z-[100] flex gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-700"
        >
          Tisknout / Uložit PDF
        </button>
        <Link
          href={`/iml/orders/${order.id}`}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow hover:bg-gray-50"
        >
          Zpět na detail
        </Link>
      </div>

      <div
        className="mx-auto max-w-[210mm] bg-white px-4 py-6 text-gray-900"
        style={{ fontFamily: "system-ui, sans-serif", fontSize: 12 }}
      >
        <div className="mb-4 flex items-start justify-between border-b-2 border-gray-900 pb-3">
          <div>
            <div className="text-lg font-bold">Objednávka {order.order_number}</div>
            <div className="mt-1 text-gray-600">{order.customer_name}</div>
          </div>
          <div className="text-right text-xs text-gray-500">
            <div>Tisk: {printedAt}</div>
            <div className="mt-1">
              Stav: <strong>{order.status}</strong>
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Datum přijetí:</span>{" "}
            {new Date(order.order_date).toLocaleDateString("cs-CZ")}
          </div>
          <div>
            <span className="text-gray-500">Plánovaná expedice:</span>{" "}
            {order.expected_ship_date
              ? new Date(order.expected_ship_date).toLocaleDateString("cs-CZ")
              : "—"}
          </div>
        </div>

        <div className="mb-4 rounded border border-gray-200 p-3 text-sm">
          <div className="font-semibold text-gray-800">Doručení (snapshot)</div>
          {order.shipping.recipient && <div>{order.shipping.recipient}</div>}
          {order.shipping.label && (
            <div className="text-gray-600">
              {order.shipping.label}
            </div>
          )}
          <div>{addrLine(order.shipping) || "—"}</div>
        </div>

        {order.notes && (
          <div className="mb-4 rounded border border-amber-100 bg-amber-50/50 p-3 text-sm">
            <div className="font-semibold text-amber-900">Poznámky</div>
            <div className="whitespace-pre-wrap">{order.notes}</div>
          </div>
        )}

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-900 bg-gray-100">
              <th className="px-2 py-2 text-left font-semibold">Produkt</th>
              <th className="px-2 py-2 text-right font-semibold">Ks</th>
              <th className="px-2 py-2 text-left font-semibold">Pantone</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="px-2 py-2 align-top">
                  <div className="font-mono text-xs">{it.ig_code ?? "—"}</div>
                  <div>{it.client_name ?? it.ig_short_name ?? ""}</div>
                  {it.product_format && (
                    <div className="text-xs text-gray-500">{it.product_format}</div>
                  )}
                </td>
                <td className="px-2 py-2 text-right align-top tabular-nums">{it.quantity}</td>
                <td className="px-2 py-2 align-top text-xs">
                  {it.pantone_codes.length ? it.pantone_codes.join(", ") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
