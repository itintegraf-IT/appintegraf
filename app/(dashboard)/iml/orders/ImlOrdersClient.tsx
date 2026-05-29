"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Eye, Pencil, Trash2, Download, Printer } from "lucide-react";
import { ImlVariableExportModal } from "./ImlVariableExportModal";

type ListMeta = {
  total_qty: number;
  pantone_codes: string[];
  pantone_summary: string;
  product_summary: string;
  primary_product_id: number | null;
  has_image: boolean;
};

type Order = {
  id: number;
  order_number: string;
  order_date: string;
  expected_ship_date: string | null;
  status: string;
  total: number | null;
  iml_customers?: { id: number; name: string } | null;
  list_meta?: ListMeta;
};

type Customer = { id: number; name: string };

type Props = { canWrite: boolean; canRead?: boolean };

const MAX_NAME = 28;

function shortCustomerName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (n.length <= MAX_NAME) return n || "—";
  return `${n.slice(0, MAX_NAME - 1)}…`;
}

export function ImlOrdersClient({ canWrite, canRead = true }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [bulkExportOpen, setBulkExportOpen] = useState(false);
  const [singleExport, setSingleExport] = useState<{ id: number; order_number: string } | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCustomer) params.set("customer_id", filterCustomer);
    if (filterStatus) params.set("status", filterStatus);
    const res = await fetch(`/api/iml/orders?${params}`);
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetch("/api/iml/customers")
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchOrders(), 300);
    return () => clearTimeout(t);
  }, [filterCustomer, filterStatus]);

  const handleDelete = async (id: number, orderNumber: string) => {
    if (!confirm(`Opravdu smazat objednávku "${orderNumber}"?`)) return;
    const res = await fetch(`/api/iml/orders/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchOrders();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Chyba při mazání");
    }
  };

  const colCount = 11;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchOrders();
          }}
          className="flex flex-wrap gap-3"
        >
          <select
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Všichni zákazníci</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Všechny stavy</option>
            <option value="nová">Nová</option>
            <option value="potvrzená">Potvrzená</option>
            <option value="odeslaná">Odeslaná</option>
            <option value="dokončená">Dokončená</option>
            <option value="zrušená">Zrušená</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Filtrovat
          </button>
          {canRead && (
            <button
              type="button"
              onClick={() => setBulkExportOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          )}
        </form>
      </div>
      {canRead && (
        <>
          <ImlVariableExportModal
            open={bulkExportOpen}
            onClose={() => setBulkExportOpen(false)}
            mode="bulk"
            initialCustomerId={filterCustomer}
            initialStatus={filterStatus}
          />
          <ImlVariableExportModal
            open={!!singleExport}
            onClose={() => setSingleExport(null)}
            mode="single"
            singleOrder={singleExport}
            initialCustomerId=""
            initialStatus=""
          />
        </>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px]">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="w-14 px-2 py-3 text-left text-xs font-semibold text-gray-700">Náhled</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">Číslo</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">Zákazník</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">Přijato</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">Expedice</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">Stav</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700">Ks</th>
              <th className="max-w-[140px] px-3 py-3 text-left text-xs font-semibold text-gray-700">
                Produkt / formát
              </th>
              <th className="max-w-[180px] px-3 py-3 text-left text-xs font-semibold text-gray-700">Pantone</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700">Celkem</th>
              <th className="min-w-[200px] px-3 py-3 text-right text-xs font-semibold text-gray-700">Akce</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-gray-500">
                  Načítání…
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-gray-500">
                  Žádné objednávky
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const meta = o.list_meta;
                const cust = o.iml_customers?.name ?? "";
                const pid = meta?.primary_product_id;
                return (
                  <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-2 align-middle">
                      {pid && meta?.has_image ? (
                        <img
                          src={`/api/iml/products/${pid}/image`}
                          alt=""
                          className="h-10 w-10 rounded border border-gray-200 object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50 text-[10px] text-gray-400"
                          title="Bez obrázku produktu"
                        >
                          —
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle font-mono text-sm">{o.order_number}</td>
                    <td
                      className="max-w-[200px] truncate px-3 py-2 align-middle text-sm"
                      title={cust || undefined}
                    >
                      {shortCustomerName(cust)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-middle text-sm">
                      {new Date(o.order_date).toLocaleDateString("cs-CZ")}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-middle text-sm">
                      {o.expected_ship_date
                        ? new Date(o.expected_ship_date).toLocaleDateString("cs-CZ")
                        : "—"}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{o.status}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right align-middle text-sm tabular-nums">
                      {meta?.total_qty ?? "—"}
                    </td>
                    <td
                      className="max-w-[140px] truncate px-3 py-2 align-middle text-xs text-gray-800"
                      title={meta?.product_summary}
                    >
                      {meta?.product_summary ?? "—"}
                    </td>
                    <td
                      className="max-w-[180px] truncate px-3 py-2 align-middle text-xs text-gray-800"
                      title={meta?.pantone_codes?.length ? meta.pantone_codes.join(", ") : undefined}
                    >
                      {meta?.pantone_summary ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right align-middle text-sm">
                      {o.total != null ? `${Number(o.total)} Kč` : "-"}
                    </td>
                    <td className="px-2 py-2 text-right align-middle">
                      <div className="flex flex-wrap justify-end gap-0.5">
                        <Link
                          href={`/iml/orders/${o.id}`}
                          className="rounded p-2 text-gray-600 hover:bg-gray-100"
                          title="Detail"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        {canRead && (
                          <>
                            <Link
                              href={`/iml/orders/${o.id}/print`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded p-2 text-gray-600 hover:bg-gray-100"
                              title="Tisk"
                            >
                              <Printer className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() =>
                                setSingleExport({ id: o.id, order_number: o.order_number })
                              }
                              className="rounded p-2 text-gray-600 hover:bg-gray-100"
                              title="Export…"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {canWrite && (
                          <>
                            <Link
                              href={`/iml/orders/${o.id}/edit`}
                              className="rounded p-2 text-gray-600 hover:bg-gray-100"
                              title="Upravit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDelete(o.id, o.order_number)}
                              className="rounded p-2 text-red-600 hover:bg-red-50"
                              title="Smazat"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
