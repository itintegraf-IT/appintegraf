"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";
import { DataTable, type SortDir } from "@/components/crm/DataTable";
import { UserAvatar } from "@/components/crm/UserAvatar";
import { crmUserDisplayName } from "@/lib/crm/users";

const ALL_OWNERS = "__all__";

type Company = {
  id: string;
  name: string;
  ico: string | null;
  segment: string | null;
  owner: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  _count: { contacts: number; deals: number };
  updated_at: Date;
};
type Owner = { id: number; first_name: string; last_name: string; email: string };

type Props = {
  items: Company[];
  owners: Owner[];
  params: { q?: string; owner_id?: number; segment?: string };
  total: number;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: SortDir;
};

export function CompaniesTable({
  items,
  owners,
  params,
  total,
  page,
  pageSize,
  sortBy,
  sortDir,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(params.q ?? "");

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(sp.toString());
    if (q) next.set("q", q);
    else next.delete("q");
    next.set("page", "1");
    router.push(`/crm/companies?${next.toString()}`);
  }

  const columns = useMemo<ColumnDef<Company>[]>(
    () => [
      {
        id: "name",
        header: "Název",
        size: 280,
        minSize: 140,
        maxSize: 500,
        cell: ({ row }) => (
          <Link
            href={`/crm/companies/${row.original.id}`}
            title={row.original.name}
            className="block truncate font-medium text-foreground hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        id: "ico",
        header: "IČO",
        size: 110,
        minSize: 90,
        maxSize: 140,
        enableResizing: false,
        cell: ({ row }) => <span className="text-sm text-foreground/70">{row.original.ico ?? "—"}</span>,
      },
      {
        id: "segment",
        header: "Segment",
        size: 160,
        minSize: 110,
        maxSize: 240,
        cell: ({ row }) =>
          row.original.segment ? <Badge variant="secondary">{row.original.segment}</Badge> : <span>—</span>,
      },
      {
        id: "owner",
        header: "Owner",
        size: 200,
        minSize: 120,
        maxSize: 320,
        enableSorting: false,
        cell: ({ row }) => {
          if (!row.original.owner) {
            return <span className="text-sm text-muted-foreground">(bez vlastníka)</span>;
          }
          const label = crmUserDisplayName(row.original.owner);
          return (
            <div className="flex min-w-0 items-center gap-2">
              <UserAvatar user={row.original.owner} size="sm" />
              <span className="truncate text-sm" title={label}>
                {label}
              </span>
            </div>
          );
        },
      },
      {
        id: "contacts",
        header: "Kontakty",
        size: 110,
        minSize: 90,
        maxSize: 160,
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => <span>{row.original._count.contacts}</span>,
      },
      {
        id: "deals",
        header: "Dealy",
        size: 110,
        minSize: 90,
        maxSize: 160,
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => <span>{row.original._count.deals}</span>,
      },
    ],
    [],
  );

  return (
    <div className="space-y-3">
      <form onSubmit={submitSearch} className="flex gap-2">
        <Input
          placeholder="Hledat podle názvu nebo IČO…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={params.owner_id != null ? String(params.owner_id) : ALL_OWNERS}
          onValueChange={(v) => {
            const next = new URLSearchParams(sp.toString());
            if (v && v !== ALL_OWNERS) next.set("owner_id", v);
            else next.delete("owner_id");
            next.set("page", "1");
            router.push(`/crm/companies?${next.toString()}`);
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Všichni owneři" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_OWNERS}>Všichni owneři</SelectItem>
            {owners.map((o) => (
              <SelectItem key={o.id} value={String(o.id)}>
                {crmUserDisplayName(o)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </form>
      <DataTable
        tableKey="companies"
        columns={columns}
        data={items}
        total={total}
        page={page}
        pageSize={pageSize}
        sortBy={sortBy}
        sortDir={sortDir}
        emptyState={
          <EmptyState
            icon={Building2}
            title="Žádné firmy"
            description="Založ první firmu přes tlačítko „Nová firma“."
          />
        }
      />
    </div>
  );
}
