"use client";

import { useState, useEffect } from "react";
import {
  Phone,
  Mail,
  Building2,
  Users,
  Search,
  Printer,
  LayoutGrid,
  List,
} from "lucide-react";

type Contact = {
  id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  landline: string | null;
  landline2: string | null;
  email: string | null;
  position: string | null;
  department_name: string | null;
};

type Department = {
  id: number;
  name: string;
  phone: string | null;
  landline: string | null;
  landline2: string | null;
  email: string | null;
};

export default function PublicPhoneListPage() {
  const [tab, setTab] = useState<"contacts" | "departments">("contacts");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsByDepartment, setContactsByDepartment] = useState<[string, Contact[]][]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (search) params.set("search", search);
    fetch(`/api/public/phone-list?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.tab === "departments") {
          setDepartments(data.departments ?? []);
          setContacts([]);
          setContactsByDepartment([]);
        } else {
          setContacts(data.contacts ?? []);
          setContactsByDepartment(data.contactsByDepartment ?? []);
          setDepartments([]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab, search]);

  return (
    <>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Phone className="h-7 w-7 text-red-600" />
          Telefonní seznam
        </h1>
        <p className="mt-1 text-gray-600">Kontakty a oddělení</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex rounded-lg border border-gray-200 p-1">
          <button
            type="button"
            onClick={() => setTab("contacts")}
            className={`flex items-center gap-2 rounded px-4 py-2 text-sm ${
              tab === "contacts" ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Users className="h-4 w-4" />
            Kontakty
          </button>
          <button
            type="button"
            onClick={() => setTab("departments")}
            className={`flex items-center gap-2 rounded px-4 py-2 text-sm ${
              tab === "departments" ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Oddělení
          </button>
        </div>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-1 gap-2"
        >
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3"
            />
          </div>
        </form>

        <div className="flex rounded-lg border border-gray-200 p-1">
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`rounded px-3 py-1 text-sm ${
              viewMode === "cards" ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <LayoutGrid className="inline h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`rounded px-3 py-1 text-sm ${
              viewMode === "table" ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <List className="inline h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <Printer className="inline h-4 w-4" /> Tisk
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Načítání…</div>
        ) : tab === "departments" ? (
          viewMode === "cards" ? (
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {departments.map((d) => (
                <div key={d.id} className="rounded-lg border border-gray-200 p-4">
                  <h3 className="font-semibold text-red-600">{d.name}</h3>
                  <div className="mt-3 space-y-1 text-sm">
                    {d.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                        <a href={`tel:${d.phone}`} className="text-red-600 hover:underline">
                          {d.phone}
                        </a>
                      </div>
                    )}
                    {d.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                        <a href={`mailto:${d.email}`} className="text-red-600 hover:underline">
                          {d.email}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Oddělení
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Telefon
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    E-mail
                  </th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium">{d.name}</td>
                    <td className="px-4 py-3">
                      {d.phone ? (
                        <a href={`tel:${d.phone}`} className="text-red-600 hover:underline">
                          {d.phone}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {d.email ? (
                        <a href={`mailto:${d.email}`} className="text-red-600 hover:underline">
                          {d.email}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : viewMode === "cards" ? (
          <div className="p-4">
            {contactsByDepartment.map(([deptName, deptContacts]) => (
              <div key={deptName} className="mb-8">
                <h2 className="mb-4 border-b border-red-200 pb-2 text-lg font-semibold text-red-600">
                  {deptName}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {deptContacts.map((c) => (
                    <div key={c.id} className="rounded-lg border border-gray-200 p-4">
                      <h3 className="font-semibold text-gray-900">
                        {c.first_name} {c.last_name}
                      </h3>
                      {c.position && (
                        <p className="text-sm text-gray-500">{c.position}</p>
                      )}
                      <div className="mt-3 space-y-1 text-sm">
                        {c.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                            <a href={`tel:${c.phone}`} className="text-red-600 hover:underline">
                              {c.phone}
                            </a>
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                            <a href={`mailto:${c.email}`} className="text-red-600 hover:underline">
                              {c.email}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Jméno</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Mobil</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">E-mail</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Oddělení</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium">
                    {c.first_name} {c.last_name}
                    {c.position && (
                      <span className="ml-2 text-sm text-gray-500">({c.position})</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} className="text-red-600 hover:underline">
                        {c.phone}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="text-red-600 hover:underline">
                        {c.email}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3">{c.department_name ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
