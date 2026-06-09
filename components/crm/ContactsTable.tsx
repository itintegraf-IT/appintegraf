"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";
import { DataTable, type SortDir } from "@/components/crm/DataTable";

type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_decision_maker: boolean;
  company: { id: string; name: string };
};

type Props = {
  items: Contact[];
  params: { q?: string };
  total: number;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: SortDir;
};

export function ContactsTable({ items, params, total, page, pageSize, sortBy, sortDir }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(params.q ?? "");

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(sp.toString());
    if (q) next.set("q", q);
    else next.delete("q");
    next.set("page", "1");
    router.push(`/crm/contacts?${next.toString()}`);
  }

  const columns = useMemo<ColumnDef<Contact>[]>(
    () => [
      {
        id: "last_name",
        header: "Jméno",
        size: 220,
        minSize: 140,
        maxSize: 400,
        cell: ({ row }) => {
          const fullName = `${row.original.first_name} ${row.original.last_name}`;
          return (
            <Link
              href={`/crm/contacts/${row.original.id}`}
              title={fullName}
              className="block truncate font-medium text-foreground hover:underline"
            >
              {fullName}
            </Link>
          );
        },
      },
      {
        id: "company",
        header: "Firma",
        size: 240,
        minSize: 140,
        maxSize: 500,
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            href={`/crm/companies/${row.original.company.id}`}
            title={row.original.company.name}
            className="block truncate font-medium text-foreground hover:underline"
          >
            {row.original.company.name}
          </Link>
        ),
      },
      {
        id: "role",
        header: "Role",
        size: 180,
        minSize: 100,
        maxSize: 300,
        cell: ({ row }) => {
          const text = row.original.role ?? "—";
          return (
            <span className="block truncate text-sm" title={row.original.role ?? undefined}>
              {text}
            </span>
          );
        },
      },
      {
        id: "email",
        header: "E-mail",
        size: 240,
        minSize: 140,
        maxSize: 400,
        cell: ({ row }) => {
          const text = row.original.email ?? "—";
          return (
            <span className="block truncate text-sm" title={row.original.email ?? undefined}>
              {text}
            </span>
          );
        },
      },
      {
        id: "phone",
        header: "Telefon",
        size: 160,
        minSize: 110,
        maxSize: 220,
        cell: ({ row }) => <span className="text-sm">{row.original.phone ?? "—"}</span>,
      },
      {
        id: "dm",
        header: "DM",
        size: 80,
        minSize: 60,
        maxSize: 120,
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => (row.original.is_decision_maker ? <Badge>DM</Badge> : <span />),
      },
    ],
    [],
  );

  return (
    <div className="space-y-3">
      <form onSubmit={submitSearch} className="flex gap-2">
        <Input
          placeholder="Hledat podle jména nebo e-mailu…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
      </form>
      <DataTable
        tableKey="contacts"
        columns={columns}
        data={items}
        total={total}
        page={page}
        pageSize={pageSize}
        sortBy={sortBy}
        sortDir={sortDir}
        emptyState={
          <EmptyState
            icon={Users}
            title="Žádné kontakty"
            description={"Založ první kontakt přes tlačítko „Nový kontakt“."}
          />
        }
      />
    </div>
  );
}
