"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Phone,
  Mail,
  Building2,
  Users,
  Printer,
  LayoutGrid,
  List,
} from "lucide-react";
import { ContactSearchAutocomplete } from "@/components/contacts/ContactSearchAutocomplete";
import type { MergedEmailRow, EmailSourceLabel } from "@/lib/merge-user-emails";

type Contact = {
  id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  landline: string | null;
  landline2: string | null;
  email: string;
  position: string | null;
  department_name: string | null;
  qr_code: string | null;
  merged_emails: MergedEmailRow[];
  personal_phone?: string | null;
  personal_email?: string | null;
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

type SharedMailItem = {
  id: number;
  email: string;
  label: string;
  assignedUsers: { id: number; fullName: string }[];
};

type Props = {
  initialTab: string;
  initialSearch: string;
  /** Např. veřejná varianta: `/api/public/phone-list` */
  apiBase?: string;
  /** Cesta stránky pro query (např. `/public/phone-list`) */
  listPath?: string;
};

function EmailCell({ contact }: { contact: Contact }) {
  const lines: MergedEmailRow[] = contact.merged_emails?.length
    ? contact.merged_emails
    : [
        {
          address: contact.email,
          sources: ["osobní" as EmailSourceLabel],
          sharedLabel: null,
        },
      ];

  return (
    <div className="space-y-1.5">
      {lines.map((row) => (
        <div key={row.address} className="min-w-0">
          {(() => {
            const isSharedOnly =
              row.sources.includes("společná schránka") && !row.sources.includes("osobní");
            const emailClass = isSharedOnly
              ? "block break-all text-gray-700 hover:underline"
              : "block break-all text-red-600 hover:underline";
            const metaClass = isSharedOnly
              ? "text-[10px] leading-tight text-gray-500"
              : "text-[10px] leading-tight text-gray-500";
            return (
              <>
          <a
            href={`mailto:${row.address}`}
            className={emailClass}
          >
            {row.address}
          </a>
          <p className={metaClass}>
            {row.sources.join(" · ")}
            {row.sharedLabel && row.sources.includes("společná schránka") && (
              <> — {row.sharedLabel}</>
            )}
          </p>
              </>
            );
          })()}
        </div>
      ))}
    </div>
  );
}

function PersonalContactLines({ contact }: { contact: Contact }) {
  if (!contact.personal_phone && !contact.personal_email) return null;
  return (
    <>
      {contact.personal_phone && (
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 shrink-0 text-gray-400" />
          <div>
            <a href={`tel:${contact.personal_phone}`} className="text-red-600 hover:underline">
              {contact.personal_phone}
            </a>
            <p className="text-[10px] leading-tight text-gray-500">soukromý</p>
          </div>
        </div>
      )}
      {contact.personal_email && (
        <div className="flex items-start gap-2">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <div>
            <a href={`mailto:${contact.personal_email}`} className="text-red-600 hover:underline">
              {contact.personal_email}
            </a>
            <p className="text-[10px] leading-tight text-gray-500">soukromý</p>
          </div>
        </div>
      )}
    </>
  );
}

function PersonalPhoneTableCell({ contact }: { contact: Contact }) {
  if (!contact.personal_phone) return null;
  return (
    <div className="mt-1">
      <a href={`tel:${contact.personal_phone}`} className="text-red-600 hover:underline">
        {contact.personal_phone}
      </a>
      <p className="text-[10px] leading-tight text-gray-500">soukromý</p>
    </div>
  );
}

function PersonalEmailTableCell({ contact }: { contact: Contact }) {
  if (!contact.personal_email) return null;
  return (
    <div className="mt-1.5">
      <a href={`mailto:${contact.personal_email}`} className="block break-all text-red-600 hover:underline">
        {contact.personal_email}
      </a>
      <p className="text-[10px] leading-tight text-gray-500">soukromý</p>
    </div>
  );
}

export function PhoneListClient({
  initialTab,
  initialSearch,
  apiBase = "/api/phone-list",
  listPath = "/phone-list",
}: Props) {
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
  const [unified, setUnified] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsByDepartment, setContactsByDepartment] = useState<[string, Contact[]][]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sharedMails, setSharedMails] = useState<SharedMailItem[]>([]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (search) params.set("search", search);
    fetch(`${apiBase}?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.unified && search) {
          setUnified(true);
          setContacts(data.contacts ?? []);
          setContactsByDepartment(data.contactsByDepartment ?? []);
          setDepartments(data.departments ?? []);
          setSharedMails(data.sharedMails ?? []);
        } else {
          setUnified(false);
          if (data.tab === "departments") {
            setDepartments(data.departments ?? []);
            setContacts([]);
            setContactsByDepartment([]);
            setSharedMails([]);
          } else if (data.tab === "shared-mails") {
            setSharedMails(data.sharedMails ?? []);
            setContacts([]);
            setContactsByDepartment([]);
            setDepartments([]);
          } else {
            setContacts(data.contacts ?? []);
            setContactsByDepartment(data.contactsByDepartment ?? []);
            setDepartments([]);
            setSharedMails([]);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab, search, apiBase]);

  const handleTabChange = (t: string) => {
    setTab(t);
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", t);
    router.push(`${listPath}?${p}`);
  };

  const applySearchToUrl = (q: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", tab);
    if (q) p.set("search", q);
    else p.delete("search");
    router.push(`${listPath}?${p}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    applySearchToUrl(search);
  };

  const handlePrint = () => window.print();

  const hasDeptBlock = (unified && departments.length > 0) || (!unified && tab === "departments" && departments.length);
  const hasContactBlock =
    (unified && (contactsByDepartment.length > 0 || contacts.length > 0)) ||
    (!unified && tab === "contacts" && (contactsByDepartment.length > 0 || contacts.length > 0));
  const hasSharedBlock = (unified && sharedMails.length > 0) || (!unified && tab === "shared-mails" && sharedMails.length > 0);

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Phone className="h-7 w-7 text-red-600" />
            Telefonní seznam
          </h1>
          <p className="mt-1 text-gray-600">Kontakty, oddělení a společné maily</p>
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

      {unified && search && (
        <p className="mb-3 text-sm text-gray-600 print:hidden">
          Hledaný text „<strong>{search}</strong>“ – výsledky u kontaktů, oddělení i společných mailů.
        </p>
      )}

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
          <button
            type="button"
            onClick={() => handleTabChange("shared-mails")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === "shared-mails"
                ? "bg-red-600 text-white shadow-md"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Mail className="h-4 w-4" />
            Společné maily
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <div className="relative min-w-0 max-w-md flex-1">
            <ContactSearchAutocomplete
              inputId="phone-list-search"
              value={search}
              onChange={setSearch}
              onSuggestionApplied={applySearchToUrl}
              suggestMode="phone-list"
              phoneListSuggestUrl={`${apiBase}/suggest`}
              suggestEnabled
              showIcon
              placeholder="Hledat v jménech, odděleních, e-mailech (společné maily)…"
              className="w-full"
              inputClassName="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 shadow-sm transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
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
              viewMode === "cards" ? "bg-red-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <LayoutGrid className="inline h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              viewMode === "table" ? "bg-red-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <List className="inline h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-elevated print:border-0 print:shadow-none">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Načítání…</div>
        ) : unified && search && !hasContactBlock && !hasDeptBlock && !hasSharedBlock ? (
          <div className="p-12 text-center text-gray-500">Žádné výsledky pro zadaný dotaz</div>
        ) : (
          <>
            {unified && (hasContactBlock || hasDeptBlock) && search ? (
              <>
                {hasContactBlock && (
                  <section className="print:break-inside-avoid">
                    <h2 className="border-b border-red-200 bg-red-50/50 px-4 py-2 text-sm font-semibold text-red-800 print:bg-transparent">
                      Kontakty
                    </h2>
                    {viewMode === "cards" ? (
                      <div className="p-4">
                        {contactsByDepartment.length === 0 && contacts.length === 0 ? (
                          <p className="text-center text-gray-500">Žádné kontakty neshodují dotaz</p>
                        ) : (
                          contactsByDepartment.map(([deptName, deptContacts]) => (
                            <div key={deptName} className="mb-8 print:break-inside-avoid">
                              <h3 className="mb-4 border-b border-l-4 border-b-red-200 border-l-red-500 pl-3 pb-2 text-lg font-semibold text-red-600">
                                {deptName}
                              </h3>
                              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {deptContacts.map((c) => (
                                  <div
                                    key={c.id}
                                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-card print:break-inside-avoid"
                                  >
                                    <h3 className="font-semibold text-gray-900">
                                      {c.first_name} {c.last_name}
                                    </h3>
                                    {c.position && <p className="text-sm text-gray-500">{c.position}</p>}
                                    <div className="mt-3 space-y-1 text-sm">
                                      {c.phone && (
                                        <div className="flex items-center gap-2">
                                          <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                                          <a href={`tel:${c.phone}`} className="text-red-600 hover:underline">
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
                                      <div className="flex items-start gap-2">
                                        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                                        <EmailCell contact={c} />
                                      </div>
                                      <PersonalContactLines contact={c} />
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
                        <table className="w-full text-sm">
                          <thead className="border-b border-gray-200 bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold text-gray-700">Jméno</th>
                              <th className="px-4 py-3 text-left font-semibold text-gray-700">Mobil</th>
                              <th className="px-4 py-3 text-left font-semibold text-gray-700">Pevná</th>
                              <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[200px]">E-mail</th>
                              <th className="px-4 py-3 text-left font-semibold text-gray-700">Oddělení</th>
                            </tr>
                          </thead>
                          <tbody>
                            {contacts.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                                  Žádné kontakty
                                </td>
                              </tr>
                            ) : (
                              contacts.map((c) => (
                                <tr key={c.id} className="border-b border-gray-100">
                                  <td className="px-4 py-2 align-top">
                                    {c.first_name} {c.last_name}
                                    {c.position && (
                                      <span className="ml-1 text-gray-500">({c.position})</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 align-top text-red-600">
                                    {c.phone ? (
                                      <a href={`tel:${c.phone}`} className="hover:underline">
                                        {c.phone}
                                      </a>
                                    ) : (
                                      "—"
                                    )}
                                    <PersonalPhoneTableCell contact={c} />
                                  </td>
                                  <td className="px-4 py-2 align-top">{c.landline ?? "—"}</td>
                                  <td className="px-4 py-2 align-top">
                                    <EmailCell contact={c} />
                                    <PersonalEmailTableCell contact={c} />
                                  </td>
                                  <td className="px-4 py-2 align-top">{c.department_name ?? "—"}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}

                {hasDeptBlock && (
                  <section className="border-t border-gray-200 print:break-inside-avoid">
                    <h2 className="border-b border-red-200 bg-amber-50/60 px-4 py-2 text-sm font-semibold text-amber-900 print:bg-transparent">
                      Oddělení
                    </h2>
                    {viewMode === "cards" ? (
                      <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
                        {departments.length === 0 ? (
                          <p className="col-span-full py-8 text-center text-gray-500">Žádné oddělení</p>
                        ) : (
                          departments.map((d) => (
                            <div
                              key={d.id}
                              className="rounded-xl border border-gray-200 bg-white p-4 shadow-card print:break-inside-avoid"
                            >
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
                                {d.landline && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                                    <a href={`tel:${d.landline}`} className="text-red-600 hover:underline">
                                      {d.landline}
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
                              {d.members && d.members.length > 0 && (
                                <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-500">
                                  <span className="text-gray-400">Členové: </span>
                                  {d.members.map((m) => `${m.first_name} ${m.last_name}`).join(" · ")}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-gray-200 bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold">Oddělení</th>
                              <th className="px-4 py-3 text-left font-semibold">Telefon</th>
                              <th className="px-4 py-3 text-left font-semibold">Pevná</th>
                              <th className="px-4 py-3 text-left font-semibold">E-mail</th>
                              <th className="px-4 py-3 text-left font-semibold">Členové</th>
                            </tr>
                          </thead>
                          <tbody>
                            {departments.map((d) => (
                              <tr key={d.id} className="border-b border-gray-100">
                                <td className="px-4 py-2 font-medium">{d.name}</td>
                                <td className="px-4 py-2">
                                  {d.phone ? (
                                    <a href={`tel:${d.phone}`} className="text-red-600 hover:underline">
                                      {d.phone}
                                    </a>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="px-4 py-2">{d.landline ?? "—"}</td>
                                <td className="px-4 py-2">
                                  {d.email ? (
                                    <a href={`mailto:${d.email}`} className="text-red-600 hover:underline">
                                      {d.email}
                                    </a>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="max-w-md px-4 py-2 text-xs text-gray-500">
                                  {d.members && d.members.length
                                    ? d.members.map((m) => `${m.first_name} ${m.last_name}`).join(" · ")
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}

                {hasSharedBlock && (
                  <section className="border-t border-gray-200 print:break-inside-avoid">
                    <h2 className="border-b border-red-200 bg-slate-50/70 px-4 py-2 text-sm font-semibold text-slate-800 print:bg-transparent">
                      Společné maily
                    </h2>
                    {viewMode === "cards" ? (
                      <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
                        {sharedMails.map((m) => (
                          <div key={m.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-card">
                            <h3 className="font-semibold text-gray-900">{m.label}</h3>
                            <a href={`mailto:${m.email}`} className="mt-1 block text-red-600 hover:underline">
                              {m.email}
                            </a>
                            <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-500">
                              {m.assignedUsers.length > 0
                                ? m.assignedUsers.map((u) => u.fullName).join(" · ")
                                : "Nikomu nepřiřazeno"}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-gray-200 bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold">Společný mail</th>
                              <th className="px-4 py-3 text-left font-semibold">E-mail</th>
                              <th className="px-4 py-3 text-left font-semibold">Přiřazeno uživatelům</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sharedMails.map((m) => (
                              <tr key={m.id} className="border-b border-gray-100">
                                <td className="px-4 py-2 font-medium">{m.label}</td>
                                <td className="px-4 py-2">
                                  <a href={`mailto:${m.email}`} className="text-red-600 hover:underline">
                                    {m.email}
                                  </a>
                                </td>
                                <td className="px-4 py-2 text-xs text-gray-600">
                                  {m.assignedUsers.length > 0
                                    ? m.assignedUsers.map((u) => u.fullName).join(" · ")
                                    : "Nikomu nepřiřazeno"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}

              </>
            ) : !unified && tab === "departments" ? (
              viewMode === "cards" ? (
                <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
                  {departments.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-gray-500">Žádná oddělení</div>
                  ) : (
                    departments.map((d) => (
                      <div
                        key={d.id}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-card print:break-inside-avoid"
                      >
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
                          {d.landline && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                              <a href={`tel:${d.landline}`} className="text-red-600 hover:underline">
                                {d.landline}
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
                        {d.members && d.members.length > 0 && (
                          <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-500">
                            <span className="text-gray-400">Členové: </span>
                            {d.members.map((m) => `${m.first_name} ${m.last_name}`).join(" · ")}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Oddělení</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Telefon</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Pevná linka</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">E-mail</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Členové</th>
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
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3">{d.landline ?? "—"}</td>
                          <td className="px-4 py-3">
                            {d.email ? (
                              <a href={`mailto:${d.email}`} className="text-red-600 hover:underline">
                                {d.email}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="max-w-md px-4 py-3 text-xs text-gray-500">
                            {d.members && d.members.length
                              ? d.members.map((m) => `${m.first_name} ${m.last_name}`).join(" · ")
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : !unified && tab === "shared-mails" ? (
              viewMode === "cards" ? (
                <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
                  {sharedMails.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-gray-500">Žádné společné maily</div>
                  ) : (
                    sharedMails.map((m) => (
                      <div key={m.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-card">
                        <h3 className="font-semibold text-gray-900">{m.label}</h3>
                        <a href={`mailto:${m.email}`} className="mt-1 block text-red-600 hover:underline">
                          {m.email}
                        </a>
                        <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-500">
                          {m.assignedUsers.length > 0
                            ? m.assignedUsers.map((u) => u.fullName).join(" · ")
                            : "Nikomu nepřiřazeno"}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Společný mail</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">E-mail</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Přiřazeno uživatelům</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sharedMails.map((m) => (
                        <tr key={m.id} className="border-b border-gray-100">
                          <td className="px-4 py-3 font-medium">{m.label}</td>
                          <td className="px-4 py-3">
                            <a href={`mailto:${m.email}`} className="text-red-600 hover:underline">
                              {m.email}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {m.assignedUsers.length > 0
                              ? m.assignedUsers.map((u) => u.fullName).join(" · ")
                              : "Nikomu nepřiřazeno"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : !unified && tab === "contacts" ? (
              viewMode === "cards" ? (
                <div className="p-4">
                  {contactsByDepartment.length === 0 ? (
                    <div className="py-12 text-center text-gray-500">Žádné kontakty</div>
                  ) : (
                    contactsByDepartment.map(([deptName, deptContacts]) => (
                      <div key={deptName} className="mb-8 print:break-inside-avoid">
                        <h2 className="mb-4 border-b border-l-4 border-b-red-200 border-l-red-500 pl-3 pb-2 text-lg font-semibold text-red-600">
                          {deptName}
                        </h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {deptContacts.map((c) => (
                            <div
                              key={c.id}
                              className="rounded-xl border border-gray-200 bg-white p-4 shadow-card print:break-inside-avoid"
                            >
                              <h3 className="font-semibold text-gray-900">
                                {c.first_name} {c.last_name}
                              </h3>
                              {c.position && <p className="text-sm text-gray-500">{c.position}</p>}
                              <div className="mt-3 space-y-1 text-sm">
                                {c.phone && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                                    <a href={`tel:${c.phone}`} className="text-red-600 hover:underline">
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
                                <div className="flex items-start gap-2">
                                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                                  <EmailCell contact={c} />
                                </div>
                                <PersonalContactLines contact={c} />
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
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Jméno</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Mobil</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Pevná</th>
                        <th className="px-4 py-3 text-left font-semibold min-w-[200px]">E-mail</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Oddělení</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            Žádné kontakty
                          </td>
                        </tr>
                      ) : (
                        contacts.map((c) => (
                          <tr key={c.id} className="border-b border-gray-100">
                            <td className="px-4 py-2 align-top">
                              {c.first_name} {c.last_name}
                              {c.position && <span className="ml-1 text-gray-500">({c.position})</span>}
                            </td>
                            <td className="px-4 py-2">
                              {c.phone ? (
                                <a href={`tel:${c.phone}`} className="text-red-600 hover:underline">
                                  {c.phone}
                                </a>
                              ) : (
                                "—"
                              )}
                              <PersonalPhoneTableCell contact={c} />
                            </td>
                            <td className="px-4 py-2">{c.landline ?? "—"}</td>
                            <td className="px-4 py-2">
                              <EmailCell contact={c} />
                              <PersonalEmailTableCell contact={c} />
                            </td>
                            <td className="px-4 py-2">{c.department_name ?? "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
