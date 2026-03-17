"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Eye, Pencil, Trash2 } from "lucide-react";

type Customer = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
};

type Props = { canWrite: boolean };

export function ImlCustomersClient({ canWrite }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchCustomers = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/iml/customers?${params}`);
    if (res.ok) {
      const data = await res.json();
      setCustomers(data.customers ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(() => fetchCustomers(), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Opravdu smazat zákazníka "${name}"?`)) return;
    const res = await fetch(`/api/iml/customers/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchCustomers();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Chyba při mazání");
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); fetchCustomers(); }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Hledat podle názvu, e-mailu, kontaktu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Hledat
          </button>
        </form>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Název</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">E-mail</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kontakt</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Akce</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Načítání…
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Žádní zákazníci
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.email ?? "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{c.contact_person ?? "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/iml/customers/${c.id}`}
                        className="rounded p-2 text-gray-600 hover:bg-gray-100"
                        title="Detail"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      {canWrite && (
                        <>
                          <Link
                            href={`/iml/customers/${c.id}/edit`}
                            className="rounded p-2 text-gray-600 hover:bg-gray-100"
                            title="Upravit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(c.id, c.name)}
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
