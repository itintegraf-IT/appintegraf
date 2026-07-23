"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/projekty/ui/table";
import { Button } from "@/components/projekty/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/projekty/utils";
import { loadColumnSizing, saveColumnSizing } from "@/lib/projekty/table-state";

export type SortDir = "asc" | "desc";

export type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  total: number;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: SortDir;
  emptyState?: React.ReactNode;
  /**
   * Pokud je nastaven, povolí přetahování šířek sloupců a uloží je do localStorage
   * pod klíčem `crm.colsizes.<tableKey>.v1`. Bez tohoto propu se tabulka chová
   * jako dřív (auto-layout, žádné resize handles).
   */
  tableKey?: string;
};

export function DataTable<TData>({
  columns,
  data,
  total,
  page,
  pageSize,
  sortBy,
  sortDir,
  emptyState,
  tableKey,
}: DataTableProps<TData>) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const resizable = Boolean(tableKey);
  const sorting: SortingState = sortBy ? [{ id: sortBy, desc: sortDir === "desc" }] : [];

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  // Načteme uložené šířky až po mountu (SSR safe — localStorage neexistuje na serveru)
  useEffect(() => {
    if (!tableKey) return;
    const stored = loadColumnSizing(tableKey);
    if (Object.keys(stored).length > 0) setColumnSizing(stored);
  }, [tableKey]);

  useEffect(() => {
    if (!tableKey) return;
    saveColumnSizing(tableKey, columnSizing);
  }, [tableKey, columnSizing]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: { sorting, columnSizing },
    onColumnSizingChange: setColumnSizing,
    enableColumnResizing: resizable,
    columnResizeMode: "onChange",
    manualSorting: true,
    manualPagination: true,
  });

  function pushParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
     
    router.push(`${pathname}?${next.toString()}`);
  }

  function toggleSort(columnId: string) {
    if (sortBy !== columnId) {
      pushParams({ sortBy: columnId, sortDir: "asc", page: "1" });
      return;
    }
    if (sortDir === "asc") {
      pushParams({ sortDir: "desc", page: "1" });
      return;
    }
    pushParams({ sortBy: null, sortDir: null, page: "1" });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const isResizing = Boolean(table.getState().columnSizingInfo.isResizingColumn);

  return (
    <div className={cn("space-y-3", isResizing && "[&_*]:!cursor-col-resize select-none")}>
      <Table className={cn(resizable && "table-fixed")}>
        {resizable ? (
          <colgroup>
            {table.getVisibleLeafColumns().map((col) => (
              <col key={col.id} style={{ width: col.getSize() }} />
            ))}
          </colgroup>
        ) : null}
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => {
                const canSort = (h.column.columnDef.enableSorting ?? true) && Boolean(h.column.id);
                const isActive = sortBy === h.column.id;
                const Icon = isActive ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                const canResize = resizable && h.column.getCanResize();
                return (
                  <TableHead
                    key={h.id}
                    className={cn(resizable && "relative overflow-hidden")}
                  >
                    {h.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(h.column.id)}
                        className="inline-flex max-w-full items-center gap-1 truncate font-medium text-foreground hover:text-foreground/80"
                      >
                        <span className="truncate">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                        </span>
                        <Icon
                          className={`size-3.5 shrink-0 ${isActive ? "text-foreground" : "text-muted-foreground/60"}`}
                          strokeWidth={1.75}
                        />
                      </button>
                    ) : (
                      <span className="block truncate">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </span>
                    )}
                    {canResize ? (
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        aria-label="Změnit šířku sloupce"
                        onMouseDown={(e) => {
                          // preventDefault zabrání startu text-selection ještě než
                          // se React re-renderuje s isResizing=true.
                          e.preventDefault();
                          e.stopPropagation();
                          h.getResizeHandler()(e);
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          h.getResizeHandler()(e);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "absolute top-0 right-0 z-10 hidden h-full w-1.5 cursor-col-resize touch-none select-none",
                          "hover:bg-border data-[resizing=true]:bg-primary sm:block",
                        )}
                        data-resizing={h.column.getIsResizing() || undefined}
                      />
                    ) : null}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((r) => (
            <TableRow key={r.id}>
              {r.getVisibleCells().map((c) => (
                <TableCell
                  key={c.id}
                  className={cn(resizable && "overflow-hidden text-ellipsis")}
                >
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {data.length === 0 && emptyState ? emptyState : null}
      {total > 0 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Strana <b className="text-foreground">{page}</b> z <b className="text-foreground">{totalPages}</b> ·{" "}
            {total} záznam{total === 1 ? "" : total < 5 ? "y" : "ů"}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!canPrev}
              onClick={() => pushParams({ page: String(page - 1) })}
            >
              <ChevronLeft className="mr-1 size-4" strokeWidth={1.75} />
              Předchozí
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canNext}
              onClick={() => pushParams({ page: String(page + 1) })}
            >
              Další
              <ChevronRight className="ml-1 size-4" strokeWidth={1.75} />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
