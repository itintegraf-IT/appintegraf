"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Eye, Pencil, Trash2 } from "lucide-react";

type InquiryRow = {
  id: number;
  inquiry_number: string;
  inquiry_date: string;
  status: string;
  converted_order_id: number | null;
  items_count: number;
  iml_customers?: { id: number; name: string } | null;
};

type Customer = { id: number; name: string };

type Props = { canWrite: boolean };

export function ImlInquiriesClient({ canWrite }: Props) {
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  const fetchRows = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCustomer) params.set("customer_id", filterCustomer);
    if (filterStatus) params.set("status", filterStatus);
    if (search.trim()) params.set("search", search.trim());
    const res = await fetch(`/api/iml/inquiries?${params}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.inquiries ?? []);
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
    const t = setTimeout(() => fetchRows(), 300);
    return () => clearTimeout(t);
  }, [filterCustomer, filterStatus, search]);

  const handleDelete = async (id: number, num: string) => {
    if (!confirm(`Opravdu smazat poptávku „${num}“?`)) return;
    const res = await fetch(`/api/iml/inquiries/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchRows();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Chyba při mazání");
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchRows();
          }}
          className="flex flex-wrap gap-3"
        >
          <input
            type="search"
            placeholder="Hledat číslo / poznámku…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
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
            <option value="překlopená">Překlopená</option>
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
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Položky</th>
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
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Žádné poptávky
                </td>
              </tr>
            ) : (
              rows.map((q) => (
                <tr key={q.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{q.inquiry_number}</td>
                  <td className="px-4 py-3">{q.iml_customers?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {new Date(q.inquiry_date).toLocaleDateString("cs-CZ")}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-sm">{q.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{q.items_count}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/iml/inquiries/${q.id}`}
                        className="rounded p-2 text-gray-600 hover:bg-gray-100"
                        title="Detail"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      {canWrite && !q.converted_order_id && (
                        <Link
                          href={`/iml/inquiries/${q.id}/edit`}
                          className="rounded p-2 text-gray-600 hover:bg-gray-100"
                          title="Upravit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                      )}
                      {canWrite && !q.converted_order_id && (
                        <button
                          type="button"
                          onClick={() => handleDelete(q.id, q.inquiry_number)}
                          className="rounded p-2 text-red-600 hover:bg-red-50"
                          title="Smazat"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
