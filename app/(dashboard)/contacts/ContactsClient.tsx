"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Building2,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Mail,
  Phone,
  QrCode,
  Users,
  LayoutGrid,
  List,
  Download,
  Upload,
} from "lucide-react";

type Contact = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  landline: string | null;
  landline2: string | null;
  position: string | null;
  department_name: string | null;
  qr_code: string | null;
  roles: { name: string } | null;
};

type Props = {
  initialSearch: string;
  initialDepartment: string;
  initialSort: string;
  initialDir: string;
  initialPage: number;
  initialPerPage: string;
  initialTab: string;
  canWrite: boolean;
};

export function ContactsClient({
  initialSearch,
  initialDepartment,
  initialSort,
  initialDir,
  initialPage,
  initialPerPage,
  initialTab,
  canWrite,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [search, setSearch] = useState(initialSearch);
  const [department, setDepartment] = useState(initialDepartment);
  const [departments, setDepartments] = useState<string[]>([]);

  const fetchContacts = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (department) params.set("department", department);
    params.set("sort", initialSort);
    params.set("dir", initialDir);
    params.set("page", String(initialPage));
    params.set("per_page", initialPerPage);

    const res = await fetch(`/api/contacts?${params}`);
    if (res.ok) {
      const data = await res.json();
      setContacts(data.contacts);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    }
    setLoading(false);
  };

  const fetchDepartments = async () => {
    const res = await fetch("/api/contacts/departments");
    if (res.ok) {
      const data = await res.json();
      setDepartments(data);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [initialSearch, initialDepartment, initialSort, initialDir, initialPage, initialPerPage]);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.set("search", search);
    params.set("department", department);
    params.set("page", "1");
    router.push(`/contacts?${params}`);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Opravdu smazat kontakt "${name}"? Tato akce je nevratná!`)) return;
    const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchContacts();
    } else {
      alert("Chyba při mazání");
    }
  };

  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    return `/contacts?${params}`;
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Users className="h-7 w-7 text-red-600" />
            Kontakty
          </h1>
          <p className="mt-1 text-gray-600">Správa kontaktů v systému</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/contacts/export"
            download="kontakty.csv"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
          {canWrite && (
            <>
              <Link
                href="/contacts/import"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                <Upload className="h-4 w-4" />
                Import CSV
              </Link>
              <Link
                href="/contacts/add"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Přidat kontakt
              </Link>
            </>
          )}
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              <Search className="mr-1 inline h-4 w-4" /> Vyhledat
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Jméno, email, telefon..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              <Building2 className="mr-1 inline h-4 w-4" /> Oddělení
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">Všechna oddělení</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Hledat
            </button>
            <Link
              href="/contacts"
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Vymazat
            </Link>
          </div>
        </div>
      </form>

      <div className="mb-4 flex justify-end">
        <div className="flex rounded-lg border border-gray-200 p-1">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1 rounded px-3 py-1 text-sm ${viewMode === "table" ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            <List className="h-4 w-4" /> Seznam
          </button>
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`flex items-center gap-1 rounded px-3 py-1 text-sm ${viewMode === "cards" ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            <LayoutGrid className="h-4 w-4" /> Karty
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Načítání…</div>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Jméno</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">E-mail</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Mobil</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Pevná linka</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Oddělení</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">QR kód</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Akce</th>
                </tr>
              </thead>
              <tbody>
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      Žádné kontakty nebyly nalezeny
                    </td>
                  </tr>
                ) : (
                  contacts.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium text-gray-900">{c.first_name} {c.last_name}</span>
                          {c.position && <div className="text-xs text-gray-500">{c.position}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <a href={`mailto:${c.email}`} className="text-red-600 hover:underline">{c.email}</a>
                      </td>
                      <td className="px-4 py-3">
                        {c.phone ? <a href={`tel:${c.phone}`} className="text-red-600 hover:underline">{c.phone}</a> : "-"}
                      </td>
                      <td className="px-4 py-3">{c.landline ?? "-"}</td>
                      <td className="px-4 py-3">{c.department_name ?? "-"}</td>
                      <td className="px-4 py-3 font-mono text-sm">{c.qr_code ?? "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Link href={`/contacts/${c.id}`} className="rounded p-2 text-gray-600 hover:bg-gray-100" title="Zobrazit">
                            <Eye className="h-4 w-4" />
                          </Link>
                          {canWrite && (
                            <>
                              <Link href={`/contacts/${c.id}/edit`} className="rounded p-2 text-gray-600 hover:bg-gray-100" title="Upravit">
                                <Pencil className="h-4 w-4" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleDelete(c.id, `${c.first_name} ${c.last_name}`)}
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
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {contacts.length === 0 ? (
              <div className="col-span-full py-12 text-center text-gray-500">Žádné kontakty</div>
            ) : (
              contacts.map((c) => (
                <div key={c.id} className="rounded-lg border border-gray-200 p-4">
                  <h3 className="font-semibold text-red-600">{c.first_name} {c.last_name}</h3>
                  {c.position && <p className="text-sm text-gray-500">{c.position}</p>}
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <a href={`mailto:${c.email}`} className="text-red-600 hover:underline">{c.email}</a>
                    </div>
                    {c.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <a href={`tel:${c.phone}`} className="text-red-600 hover:underline">{c.phone}</a>
                      </div>
                    )}
                    {c.qr_code && (
                      <div className="flex items-center gap-2">
                        <QrCode className="h-4 w-4 text-gray-400" />
                        <span className="font-mono">{c.qr_code}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Link href={`/contacts/${c.id}`} className="rounded bg-gray-100 px-2 py-1 text-sm hover:bg-gray-200">Zobrazit</Link>
                    {canWrite && (
                      <>
                        <Link href={`/contacts/${c.id}/edit`} className="rounded bg-red-100 px-2 py-1 text-sm text-red-600 hover:bg-red-200">Upravit</Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id, `${c.first_name} ${c.last_name}`)}
                          className="rounded bg-red-50 px-2 py-1 text-sm text-red-600 hover:bg-red-100"
                        >
                          Smazat
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-gray-200 p-4">
            <Link
              href={buildPageUrl(initialPage - 1)}
              className={`rounded border px-3 py-1 ${initialPage <= 1 ? "pointer-events-none opacity-50" : "hover:bg-gray-50"}`}
            >
              Předchozí
            </Link>
            <span className="text-sm text-gray-600">
              Stránka {initialPage} / {totalPages} ({total} kontaktů)
            </span>
            <Link
              href={buildPageUrl(initialPage + 1)}
              className={`rounded border px-3 py-1 ${initialPage >= totalPages ? "pointer-events-none opacity-50" : "hover:bg-gray-50"}`}
            >
              Další
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
