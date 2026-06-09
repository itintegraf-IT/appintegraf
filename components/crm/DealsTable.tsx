"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { EmptyState } from "@/components/ui/empty-state";
import { TrendingUp } from "lucide-react";
import { DataTable, type SortDir } from "@/components/crm/DataTable";
import { STAGE_LABELS, STAGE_BADGE, STAGE_BADGE_DOT } from "@/lib/crm/deal-stages";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/crm/UserAvatar";
import type { crm_deal_stage } from "@prisma/client";

type Deal = {
  id: string;
  number: string;
  title: string;
  stage: crm_deal_stage;
  value: number;
  probability: number;
  company: { id: string; name: string };
  owner: { id: number; name: string | null; email: string | null; image: string | null };
};

type Props = {
  items: Deal[];
  total: number;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: SortDir;
};

export function DealsTable({ items, total, page, pageSize, sortBy, sortDir }: Props) {
  const columns = useMemo<ColumnDef<Deal>[]>(
    () => [
      {
        id: "number",
        header: "Číslo",
        size: 110,
        minSize: 90,
        maxSize: 140,
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => (
          <span className="text-xs uppercase tracking-wider text-muted-foreground tabular-nums">
            {row.original.number}
          </span>
        ),
      },
      {
        id: "title",
        header: "Název",
        size: 240,
        minSize: 140,
        maxSize: 500,
        cell: ({ row }) => (
          <Link
            href={`/crm/deals/${row.original.id}`}
            title={row.original.title}
            className="block truncate font-medium text-foreground hover:underline"
          >
            {row.original.title}
          </Link>
        ),
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
        id: "stage",
        header: "Stage",
        size: 150,
        minSize: 130,
        maxSize: 200,
        enableResizing: false,
        cell: ({ row }) => {
          const s = row.original.stage;
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
                STAGE_BADGE[s],
              )}
            >
              <span className={cn("size-1.5 rounded-full", STAGE_BADGE_DOT[s])} aria-hidden />
              {STAGE_LABELS[s]}
            </span>
          );
        },
      },
      {
        id: "value",
        header: "Hodnota",
        size: 130,
        minSize: 100,
        maxSize: 200,
        cell: ({ row }) => <span>{Number(row.original.value).toLocaleString("cs-CZ")} Kč</span>,
      },
      {
        id: "probability",
        header: "Pravděpodobnost",
        size: 150,
        minSize: 110,
        maxSize: 220,
        enableResizing: false,
        cell: ({ row }) => <span>{row.original.probability} %</span>,
      },
      {
        id: "owner",
        header: "Owner",
        size: 200,
        minSize: 120,
        maxSize: 320,
        enableSorting: false,
        cell: ({ row }) => {
          const label = row.original.owner.name ?? row.original.owner.email ?? "";
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
    ],
    [],
  );

  return (
    <DataTable
      tableKey="deals"
      columns={columns}
      data={items}
      total={total}
      page={page}
      pageSize={pageSize}
      sortBy={sortBy}
      sortDir={sortDir}
      emptyState={
        <EmptyState
          icon={TrendingUp}
          title="Žádné dealy"
          description={"Založ první deal přes tlačítko „Nový deal“."}
        />
      }
    />
  );
}
