"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Search } from "lucide-react";
import { IML_ITEM_STATUSES, imlItemStatusLabel } from "@/lib/iml-constants";
import { useListFilters } from "@/lib/navigation/use-list-filters";
import { type ProductListRow } from "@/lib/iml/product-list-columns";
import { useProductListColumns } from "@/lib/iml/use-product-list-columns";
import { useProductListColumnWidths } from "@/lib/iml/use-product-list-column-widths";
import { ProductListColumnPicker } from "./_components/ProductListColumnPicker";
import { ResizableProductListTable } from "./_components/ResizableProductListTable";

const PER_PAGE_STORAGE_KEY = "iml-products-per-page";

const PRODUCT_LIST_FILTER_DEFAULTS = {
  search: "",
  customer_id: "",
  status: "",
  page: "1",
  per_page: "",
};

type PerPageOption = "25" | "50" | "100" | "all";

type Customer = { id: number; name: string };

type Props = { canWrite: boolean; canRead?: boolean };

function parseStoredPerPage(value: string | null): PerPageOption {
  if (value === "50" || value === "100" || value === "all") return value;
  return "25";
}

export function ImlProductsClient({ canWrite, canRead = true }: Props) {
  const { filters, setFilter, setFilters, listHref } = useListFilters({
    defaults: PRODUCT_LIST_FILTER_DEFAULTS,
    resetPageOnChange: ["search", "customer_id", "status", "per_page"],
  });

  const search = filters.search;
  const filterCustomer = filters.customer_id;
  const filterStatus = filters.status;
  const page = parseInt(filters.page || "1", 10) || 1;
  const perPage = (filters.per_page || "25") as PerPageOption;

  const { visibleColumns, visibleColumnIds, toggleColumn, resetToDefaults, ready: columnsReady } =
    useProductListColumns();
  const {
    columnWidths,
    setWidth,
    resetWidth,
    resetWidths,
    ready: widthsReady,
  } = useProductListColumnWidths(visibleColumnIds);

  const [products, setProducts] = useState<ProductListRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [perPageBootstrapped, setPerPageBootstrapped] = useState(false);

  const tableReady = columnsReady && widthsReady;

  useEffect(() => {
    if (perPageBootstrapped || filters.per_page) return;
    try {
      const stored = parseStoredPerPage(localStorage.getItem(PER_PAGE_STORAGE_KEY));
      if (stored !== "25") {
        setFilters({ per_page: stored });
      }
    } catch {
      /* ignore */
    }
    setPerPageBootstrapped(true);
  }, [perPageBootstrapped, filters.per_page, setFilters]);

  const handlePerPageChange = (value: PerPageOption) => {
    try {
      localStorage.setItem(PER_PAGE_STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
    setFilters({ per_page: value === "25" ? "" : value, page: "1" });
  };

  const fetchProducts = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterCustomer) params.set("customer_id", filterCustomer);
    if (filterStatus) params.set("status", filterStatus);
    params.set("page", String(page));
    params.set("per_page", perPage);
    const res = await fetch(`/api/iml/products?${params}`);
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products ?? []);
      setTotal(typeof data.total === "number" ? data.total : (data.products?.length ?? 0));
      setTotalPages(typeof data.totalPages === "number" ? data.totalPages : 1);
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
    const t = setTimeout(() => fetchProducts(), 300);
    return () => clearTimeout(t);
  }, [search, filterCustomer, filterStatus, page, perPage]);

  const buildExportUrl = (format: string) => {
    const params = new URLSearchParams();
    params.set("format", format);
    if (search) params.set("search", search);
    if (filterCustomer) params.set("customer_id", filterCustomer);
    if (filterStatus) params.set("status", filterStatus);
    return `/api/iml/products/export?${params}`;
  };

  const handleDelete = useCallback(
    async (id: number, name: string) => {
      if (!confirm(`Opravdu smazat produkt "${name || id}"?`)) return;
      const res = await fetch(`/api/iml/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchProducts();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Chyba při mazání");
      }
    },
    [search, filterCustomer, filterStatus, page, perPage]
  );

  const cellContext = useMemo(
    () => ({
      canWrite,
      listHref,
      onDelete: handleDelete,
    }),
    [canWrite, listHref, handleDelete]
  );

  const showPageNav = perPage !== "all" && totalPages > 1;

  return (
    <div className="space-y-4">
      {canRead && (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={buildExportUrl("csv")}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            download="iml-produkty.csv"
          >
            Export CSV
          </a>
          <a
            href={buildExportUrl("xlsx")}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            download="iml-produkty.xlsx"
          >
            Export Excel
          </a>
          {tableReady && (
            <ProductListColumnPicker
              visibleColumnIds={visibleColumnIds}
              onToggle={toggleColumn}
              onReset={resetToDefaults}
              onResetWidths={resetWidths}
            />
          )}
        </div>
      )}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFilter("page", "1");
            }}
            className="flex flex-wrap gap-3"
          >
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Hledat podle kódu, názvu, SKU…"
                value={search}
                onChange={(e) => setFilter("search", e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3"
              />
            </div>
            <select
              value={filterCustomer}
              onChange={(e) => setFilter("customer_id", e.target.value)}
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
              onChange={(e) => setFilter("status", e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Všechny stavy</option>
              {IML_ITEM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {imlItemStatusLabel(s)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Hledat
            </button>
          </form>
        </div>
        <ResizableProductListTable
          visibleColumns={visibleColumns}
          columnWidths={columnWidths}
          loading={loading}
          ready={tableReady}
          products={products}
          cellContext={cellContext}
          onResizeColumn={setWidth}
          onResetColumnWidth={resetWidth}
        />
        {!loading && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 p-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <span>Počet na stránku:</span>
              <select
                value={perPage}
                onChange={(e) => handlePerPageChange(e.target.value as PerPageOption)}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="all">Vše</option>
              </select>
            </label>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {perPage === "all" ? (
                <span className="text-sm text-gray-600">Zobrazeno všech {total} produktů</span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setFilter("page", String(Math.max(1, page - 1)))}
                    disabled={page <= 1}
                    className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50"
                  >
                    Předchozí
                  </button>
                  <span className="text-sm text-gray-600">
                    Stránka {page} / {totalPages} ({total} produktů)
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilter("page", String(Math.min(totalPages, page + 1)))}
                    disabled={!showPageNav || page >= totalPages}
                    className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50"
                  >
                    Další
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
