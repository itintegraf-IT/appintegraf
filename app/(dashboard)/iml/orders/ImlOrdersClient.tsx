"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Eye, Pencil, Trash2 } from "lucide-react";

type Order = {
  id: number;
  order_number: string;
  order_date: string;
  status: string;
  total: number | null;
  iml_customers?: { id: number; name: string } | null;
};

type Customer = { id: number; name: string };

type Props = { canWrite: boolean };

export function ImlOrdersClient({ canWrite }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

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

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); fetchOrders(); }}
          className="flex flex-wrap gap-3"
        >
          <select
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Všichni zákazníci</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
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
        </form>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Číslo</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Zákazník</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Datum</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stav</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Celkem</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Akce</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Načítání…
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Žádné objednávky
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{o.order_number}</td>
                  <td className="px-4 py-3">{o.iml_customers?.name ?? "-"}</td>
                  <td className="px-4 py-3">{new Date(o.order_date).toLocaleDateString("cs-CZ")}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-sm">{o.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{o.total != null ? `${Number(o.total)} Kč` : "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/iml/orders/${o.id}`}
                        className="rounded p-2 text-gray-600 hover:bg-gray-100"
                        title="Detail"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
