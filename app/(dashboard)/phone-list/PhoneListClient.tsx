"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  qr_code: string | null;
};

type DepartmentMember = { first_name: string; last_name: string };

type Department = {
  id: number;
  name: string;
  phone: string | null;
  landline: string | null;
  landline2: string | null;
  email: string | null;
  notes: string | null;
  members?: DepartmentMember[];
};

type Props = {
  initialTab: string;
  initialSearch: string;
};

export function PhoneListClient({ initialTab, initialSearch }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState(initialSearch);

  useEffect(() => {
    setTab(initialTab);
    setSearch(initialSearch);
  }, [initialTab, initialSearch]);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsByDepartment, setContactsByDepartment] = useState<
    [string, Contact[]][]
  >([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (search) params.set("search", search);
    fetch(`/api/phone-list?${params}`)
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

  const handleTabChange = (t: string) => {
    setTab(t);
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", t);
    p.delete("search");
    router.push(`/phone-list?${p}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", tab);
    if (search) p.set("search", search);
    else p.delete("search");
    router.push(`/phone-list?${p}`);
  };

  const handlePrint = () => window.print();

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Phone className="h-7 w-7 text-red-600" />
            Telefonní seznam
          </h1>
          <p className="mt-1 text-gray-600">Kontakty a oddělení</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 font-medium text-gray-700 shadow-card transition-all hover:bg-gray-50 hover:shadow-md print:hidden"
          >
            <Printer className="h-4 w-4" />
            Tisk
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4 print:hidden">
        <div className="flex rounded-xl border border-gray-200 bg-white/90 p-1 shadow-card backdrop-blur-sm">
          <button
            type="button"
            onClick={() => handleTabChange("contacts")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === "contacts"
                ? "bg-red-600 text-white shadow-md"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Users className="h-4 w-4" />
            Kontakty
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("departments")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === "departments"
                ? "bg-red-600 text-white shadow-md"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Oddělení
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 shadow-sm transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white shadow-md transition-all hover:bg-red-700 hover:shadow-lg"
          >
            Hledat
          </button>
        </form>

        <div className="flex rounded-xl border border-gray-200 bg-white/90 p-1 shadow-card backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              viewMode === "cards"
                ? "bg-red-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <LayoutGrid className="inline h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              viewMode === "table"
                ? "bg-red-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <List className="inline h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-elevated print:border-0 print:shadow-none">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Načítání…</div>
        ) : tab === "departments" ? (
          viewMode === "cards" ? (
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
              {departments.length === 0 ? (
                <div className="col-span-full py-12 text-center text-gray-500">
                  Žádná oddělení
                </div>
              ) : (
                departments.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-card transition-all hover:shadow-card-hover hover:border-gray-300 print:break-inside-avoid"
                  >
                    <h3 className="font-semibold text-red-600">{d.name}</h3>
                    <div className="mt-3 space-y-1 text-sm">
                      {d.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                          <a
                            href={`tel:${d.phone}`}
                            className="text-red-600 hover:underline"
                          >
                            {d.phone}
                          </a>
                        </div>
                      )}
                      {d.landline && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                          <a
                            href={`tel:${d.landline}`}
                            className="text-red-600 hover:underline"
                          >
                            {d.landline}
                          </a>
                        </div>
                      )}
                      {d.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                          <a
                            href={`mailto:${d.email}`}
                            className="text-red-600 hover:underline"
                          >
                            {d.email}
                          </a>
                        </div>
                      )}
                    </div>
                    {d.members && d.members.length > 0 && (
                      <p className="mt-3 border-t border-gray-100 pt-2 text-xs leading-relaxed text-gray-500">
                        <span className="text-gray-400">Členové: </span>
                        {d.members
                          .map((m) => `${m.first_name} ${m.last_name}`)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                      Pevná linka
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      E-mail
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Členové
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr
                      key={d.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 font-medium">{d.name}</td>
                      <td className="px-4 py-3">
                        {d.phone ? (
                          <a
                            href={`tel:${d.phone}`}
                            className="text-red-600 hover:underline"
                          >
                            {d.phone}
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3">{d.landline ?? "-"}</td>
                      <td className="px-4 py-3">
                        {d.email ? (
                          <a
                            href={`mailto:${d.email}`}
                            className="text-red-600 hover:underline"
                          >
                            {d.email}
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="max-w-md px-4 py-3 text-xs leading-relaxed text-gray-500">
                        {d.members && d.members.length > 0
                          ? d.members
                              .map((m) => `${m.first_name} ${m.last_name}`)
                              .join(" · ")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : viewMode === "cards" ? (
          <div className="p-4">
            {contactsByDepartment.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                Žádné kontakty
              </div>
            ) : (
              contactsByDepartment.map(([deptName, deptContacts]) => (
                <div key={deptName} className="mb-8 print:break-inside-avoid">
                  <h2 className="mb-4 border-b border-red-200 border-l-4 border-l-red-500 pl-3 pb-2 text-lg font-semibold text-red-600">
                    {deptName}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {deptContacts.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-card transition-all hover:shadow-card-hover hover:border-gray-300 print:break-inside-avoid"
                      >
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
                              <a
                                href={`tel:${c.phone}`}
                                className="text-red-600 hover:underline"
                              >
                                {c.phone}
                              </a>
                            </div>
                          )}
                          {c.landline && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                              <span>{c.landline}</span>
                            </div>
                          )}
                          {c.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                              <a
                                href={`mailto:${c.email}`}
                                className="text-red-600 hover:underline"
                              >
                                {c.email}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Jméno
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Mobil
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Pevná linka
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    E-mail
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Oddělení
                  </th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-medium">
                      {c.first_name} {c.last_name}
                      {c.position && (
                        <span className="ml-2 text-sm text-gray-500">
                          ({c.position})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.phone ? (
                        <a
                          href={`tel:${c.phone}`}
                          className="text-red-600 hover:underline"
                        >
                          {c.phone}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3">{c.landline ?? "-"}</td>
                    <td className="px-4 py-3">
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="text-red-600 hover:underline"
                        >
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
          </div>
        )}
      </div>
    </>
  );
}
