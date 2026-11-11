"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Loader2, Search, Download } from "lucide-react";
import { IML_ITEM_STATUSES, imlItemStatusLabel } from "@/lib/iml-constants";
import { useListFilters } from "@/lib/navigation/use-list-filters";
import {
  isProductListColumnSortable,
  type ProductListColumnId,
  type ProductListRow,
} from "@/lib/iml/product-list-columns";
import { useProductListColumns } from "@/lib/iml/use-product-list-columns";
import { useProductListColumnWidths } from "@/lib/iml/use-product-list-column-widths";
import type { ProductListSortDir } from "@/lib/iml/product-list-sort";
import {
  downloadBlobAsFile,
  filenameFromContentDisposition,
} from "@/lib/download-blob-as-file";
import { ProductListColumnPicker } from "./_components/ProductListColumnPicker";
import { ResizableProductListTable } from "./_components/ResizableProductListTable";

const PER_PAGE_STORAGE_KEY = "iml-products-per-page";
const INFINITE_CHUNK_SIZE = 50;
const INFINITE_MAX_ROWS = 500;

const PRODUCT_LIST_FILTER_DEFAULTS = {
  search: "",
  customer_id: "",
  status: "",
  product_kind: "",
  archive: "",
  format_width_mm: "",
  format_height_mm: "",
  sort: "",
  dir: "",
  missing_shape: "",
  page: "1",
  per_page: "",
};

type PerPageOption = "25" | "50" | "100" | "all";

type Customer = { id: number; name: string };

type Props = { canWrite: boolean; canRead?: boolean };

type ProductsApiResponse = {
  products?: ProductListRow[];
  total?: number;
  totalPages?: number;
  hasMore?: boolean;
};

function parseStoredPerPage(value: string | null): PerPageOption {
  if (value === "50" || value === "100" || value === "all") return value;
  return "25";
}

function mergeProductRows(prev: ProductListRow[], next: ProductListRow[]): ProductListRow[] {
  const seen = new Set(prev.map((p) => p.id));
  const merged = [...prev];
  for (const row of next) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      merged.push(row);
    }
  }
  return merged;
}

export function ImlProductsClient({ canWrite, canRead = true }: Props) {
  const { filters, setFilter, setFilters, listHref } = useListFilters({
    defaults: PRODUCT_LIST_FILTER_DEFAULTS,
    resetPageOnChange: [
      "search",
      "customer_id",
      "status",
      "product_kind",
      "archive",
      "format_width_mm",
      "format_height_mm",
      "sort",
      "dir",
      "missing_shape",
      "per_page",
    ],
  });

  const search = filters.search;
  /** Lokální hodnota inputu — URL/API se aktualizuje až po debounce. */
  const [searchInput, setSearchInput] = useState(search);
  /** Během focusu nesynchronizovat z URL — jinak race s debounce přepíše právě psaný text. */
  const searchFocusedRef = useRef(false);
  const filterCustomer = filters.customer_id;
  const filterStatus = filters.status;
  const filterProductKind = filters.product_kind;
  const filterArchive = filters.archive || "active";
  const filterWidth = filters.format_width_mm;
  const filterHeight = filters.format_height_mm;
  const filterSort = filters.sort;
  const filterDir = (filters.dir === "asc" || filters.dir === "desc" ? filters.dir : "") as
    | ProductListSortDir
    | "";
  const filterMissingShape = filters.missing_shape;
  const page = parseInt(filters.page || "1", 10) || 1;
  const perPage = (filters.per_page || "25") as PerPageOption;
  const isInfiniteMode = perPage === "all";

  const {
    visibleColumns,
    visibleColumnIds,
    toggleColumn,
    reorderColumns,
    resetToDefaults,
    ready: columnsReady,
  } = useProductListColumns();
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [reachedCap, setReachedCap] = useState(false);
  const [perPageBootstrapped, setPerPageBootstrapped] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [includePrint, setIncludePrint] = useState(false);
  const [includeSoftproof, setIncludeSoftproof] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [shapes, setShapes] = useState<
    Array<{ id: number; shape_code: string; width_mm: number | string; height_mm: number | string }>
  >([]);
  const [bulkShapeId, setBulkShapeId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const infinitePageRef = useRef(1);
  const prefetchRef = useRef<{ page: number; products: ProductListRow[]; hasMore: boolean } | null>(
    null
  );
  const loadMoreLockRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const tableReady = columnsReady && widthsReady;

  // Sync z URL jen mimo focus (zpět/dopředu, sdílený odkaz) — ne při psaní
  useEffect(() => {
    if (searchFocusedRef.current) return;
    setSearchInput(search);
  }, [search]);

  // Debounce zápisu hledání do URL → méně requestů při psaní
  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => {
      setFilter("search", searchInput);
    }, 450);
    return () => clearTimeout(t);
  }, [searchInput, search, setFilter]);

  const filterKey = useMemo(
    () =>
      [
        search,
        filterCustomer,
        filterStatus,
        filterProductKind,
        filterArchive,
        filterWidth,
        filterHeight,
        filterSort,
        filterMissingShape,
        perPage,
      ].join("|"),
    [
      search,
      filterCustomer,
      filterStatus,
      filterProductKind,
      filterArchive,
      filterWidth,
      filterHeight,
      filterSort,
      filterMissingShape,
      perPage,
    ]
  );

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

  const buildListParams = useCallback(
    (pageNum: number, opts?: { skipTotal?: boolean }) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterCustomer) params.set("customer_id", filterCustomer);
      if (filterStatus) params.set("status", filterStatus);
      if (filterProductKind) params.set("product_kind", filterProductKind);
      if (filterArchive && filterArchive !== "active") params.set("archive", filterArchive);
      if (filterWidth) params.set("format_width_mm", filterWidth);
      if (filterHeight) params.set("format_height_mm", filterHeight);
      if (filterSort) {
        params.set("sort", filterSort);
        if (filterDir) params.set("dir", filterDir);
      }
      if (filterMissingShape === "1") params.set("missing_shape", "1");
      params.set("page", String(pageNum));
      params.set("per_page", isInfiniteMode ? String(INFINITE_CHUNK_SIZE) : perPage);
      if (opts?.skipTotal) params.set("skip_total", "1");
      return params;
    },
    [
      search,
      filterCustomer,
      filterStatus,
      filterProductKind,
      filterArchive,
      filterWidth,
      filterHeight,
      filterSort,
      filterDir,
      filterMissingShape,
      perPage,
      isInfiniteMode,
    ]
  );

  const cycleSort = useCallback(
    (columnId: ProductListColumnId) => {
      if (!isProductListColumnSortable(columnId)) return;
      if (filterSort !== columnId) {
        setFilters({ sort: columnId, dir: "asc", page: "1" });
        return;
      }
      if (filterDir === "asc") {
        setFilters({ sort: columnId, dir: "desc", page: "1" });
        return;
      }
      if (filterDir === "desc") {
        setFilters({ sort: "", dir: "", page: "1" });
        return;
      }
      setFilters({ sort: columnId, dir: "asc", page: "1" });
    },
    [filterSort, filterDir, setFilters]
  );

  const fetchProductsPage = useCallback(
    async (
      pageNum: number,
      opts?: { skipTotal?: boolean; signal?: AbortSignal }
    ) => {
      try {
        const res = await fetch(`/api/iml/products?${buildListParams(pageNum, opts)}`, {
          signal: opts?.signal,
        });
        if (!res.ok) return null;
        return (await res.json()) as ProductsApiResponse;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return null;
        throw e;
      }
    },
    [buildListParams]
  );

  const prefetchInfinitePage = useCallback(
    async (pageNum: number) => {
      if (prefetchRef.current?.page === pageNum) return;
      const data = await fetchProductsPage(pageNum, { skipTotal: true });
      if (!data?.products) return;
      prefetchRef.current = {
        page: pageNum,
        products: data.products,
        hasMore: data.hasMore === true,
      };
    },
    [fetchProductsPage]
  );

  const fetchPagedProducts = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      const data = await fetchProductsPage(page, { signal });
      if (signal?.aborted) return;
      if (data) {
        setProducts(data.products ?? []);
        setTotal(typeof data.total === "number" ? data.total : (data.products?.length ?? 0));
        setTotalPages(typeof data.totalPages === "number" ? data.totalPages : 1);
        setHasMore(false);
        setReachedCap(false);
      }
      setLoading(false);
    },
    [fetchProductsPage, page]
  );

  const fetchInfiniteInitial = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setLoadingMore(false);
      setReachedCap(false);
      setHasMore(false);
      prefetchRef.current = null;
      infinitePageRef.current = 1;
      loadMoreLockRef.current = false;

      const data = await fetchProductsPage(1, { signal });
      if (signal?.aborted) return;
      if (data) {
        const rows = data.products ?? [];
        setProducts(rows);
        const totalCount = typeof data.total === "number" ? data.total : rows.length;
        setTotal(totalCount);
        const more =
          data.hasMore === true ||
          (rows.length === INFINITE_CHUNK_SIZE && rows.length < totalCount);
        setHasMore(more && rows.length < INFINITE_MAX_ROWS);
        setReachedCap(rows.length >= INFINITE_MAX_ROWS);
        if (more && rows.length < INFINITE_MAX_ROWS) {
          void prefetchInfinitePage(2);
        }
      } else {
        setProducts([]);
        setTotal(0);
      }
      setLoading(false);
    },
    [fetchProductsPage, prefetchInfinitePage]
  );

  const loadMoreInfinite = useCallback(async () => {
    if (loadMoreLockRef.current || loading || loadingMore || !hasMore || reachedCap) return;
    loadMoreLockRef.current = true;
    setLoadingMore(true);

    const nextPage = infinitePageRef.current + 1;
    let chunk: ProductListRow[] | null = null;
    let chunkHasMore = false;

    if (prefetchRef.current?.page === nextPage) {
      chunk = prefetchRef.current.products;
      chunkHasMore = prefetchRef.current.hasMore;
      prefetchRef.current = null;
    } else {
      const data = await fetchProductsPage(nextPage, { skipTotal: true });
      chunk = data?.products ?? null;
      chunkHasMore = data?.hasMore === true;
    }

    if (chunk && chunk.length > 0) {
      infinitePageRef.current = nextPage;
      const isShortChunk = chunk.length < INFINITE_CHUNK_SIZE;
      setProducts((prev) => {
        const merged = mergeProductRows(prev, chunk!);
        const capped = merged.length >= INFINITE_MAX_ROWS;
        if (capped) {
          setReachedCap(true);
          setHasMore(false);
          return merged.slice(0, INFINITE_MAX_ROWS);
        }
        const more =
          !isShortChunk &&
          (chunkHasMore || (chunk!.length === INFINITE_CHUNK_SIZE && merged.length < total));
        setHasMore(more);
        if (more) {
          void prefetchInfinitePage(nextPage + 1);
        }
        return merged;
      });
    } else {
      setHasMore(false);
    }

    setLoadingMore(false);
    loadMoreLockRef.current = false;
  }, [fetchProductsPage, prefetchInfinitePage, hasMore, reachedCap, loading, loadingMore, total]);

  useEffect(() => {
    fetch("/api/iml/customers")
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers ?? []))
      .catch(() => {});
    if (canWrite) {
      fetch("/api/iml/shapes")
        .then((r) => r.json())
        .then((d) => setShapes(d.shapes ?? []))
        .catch(() => {});
    }
  }, [canWrite]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterKey]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    setSelectedIds((prev) => {
      const allSelected = products.length > 0 && products.every((p) => prev.has(p.id));
      const next = new Set(prev);
      if (allSelected) {
        for (const p of products) next.delete(p.id);
      } else {
        for (const p of products) next.add(p.id);
      }
      return next;
    });
  };

  const runBulkAssignShape = async () => {
    const shapeId = parseInt(bulkShapeId, 10);
    if (!Number.isFinite(shapeId) || selectedIds.size === 0) return;
    if (
      !confirm(
        `Přiřadit tvar #${shapeId} celkem ${selectedIds.size} produktům (včetně výchozího nástroje a montáže)?`
      )
    ) {
      return;
    }
    setBulkBusy(true);
    setBulkMsg(null);
    try {
      const res = await fetch("/api/iml/products/bulk-assign-shape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shape_id: shapeId,
          product_ids: [...selectedIds],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBulkMsg(data.error ?? "Hromadné přiřazení selhalo");
        return;
      }
      setBulkMsg(`Aktualizováno ${data.updatedProducts ?? selectedIds.size} produktů.`);
      setSelectedIds(new Set());
      if (isInfiniteMode) void fetchInfiniteInitial();
      else void fetchPagedProducts();
    } finally {
      setBulkBusy(false);
    }
  };

  const runSharePreview = async () => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    setBulkMsg(null);
    setShareUrl(null);
    try {
      const res = await fetch("/api/iml/products/share-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_ids: [...selectedIds],
          email: shareEmail.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBulkMsg(typeof data.error === "string" ? data.error : "Sdílení náhledů selhalo");
        return;
      }
      const url = typeof data.url === "string" ? data.url : "";
      setShareUrl(url || null);
      const expires =
        typeof data.expires_at === "string"
          ? new Date(data.expires_at).toLocaleString("cs-CZ")
          : "";
      let msg = `Odkaz na ${data.product_count ?? selectedIds.size} náhledů vytvořen`;
      if (expires) msg += ` (platí do ${expires})`;
      if (shareEmail.trim()) {
        msg += data.email_sent
          ? ", e-mail odeslán"
          : data.email_error
            ? `, e-mail se nepodařilo odeslat: ${data.email_error}`
            : "";
      }
      setBulkMsg(msg);
      if (url && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(url);
          setBulkMsg(`${msg}. URL zkopírována do schránky.`);
        } catch {
          // ignore clipboard failures
        }
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const runExportSoftproofZip = async () => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    setBulkMsg(null);
    try {
      const res = await fetch("/api/iml/products/export-softproof-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: [...selectedIds] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBulkMsg(
          typeof data.error === "string" ? data.error : "Stažení softproofů selhalo"
        );
        return;
      }
      const blob = await res.blob();
      const name =
        filenameFromContentDisposition(res.headers.get("Content-Disposition")) ||
        `iml-softproofy-${new Date().toISOString().slice(0, 10)}.zip`;
      downloadBlobAsFile(blob, name);
      const skipped = res.headers.get("X-Skipped-Count");
      setBulkMsg(
        skipped && skipped !== "0"
          ? `ZIP stažen (u ${skipped} položek chyběl softproof).`
          : "ZIP softproofů stažen."
      );
    } finally {
      setBulkBusy(false);
    }
  };

  useEffect(() => {
    const ac = new AbortController();
    const t = setTimeout(() => {
      if (isInfiniteMode) {
        void fetchInfiniteInitial(ac.signal);
      } else {
        void fetchPagedProducts(ac.signal);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [filterKey, page, fetchInfiniteInitial, fetchPagedProducts, isInfiniteMode]);

  useEffect(() => {
    if (!isInfiniteMode || !hasMore || reachedCap || loading || loadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreInfinite();
        }
      },
      { rootMargin: "240px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isInfiniteMode, hasMore, reachedCap, loading, loadingMore, loadMoreInfinite, products.length]);

  const buildExportUrl = (format: string) => {
    const params = new URLSearchParams();
    params.set("format", format);
    if (search) params.set("search", search);
    if (filterCustomer) params.set("customer_id", filterCustomer);
    if (filterStatus) params.set("status", filterStatus);
    if (filterProductKind) params.set("product_kind", filterProductKind);
    if (filterArchive && filterArchive !== "active") params.set("archive", filterArchive);
    if (includePrint) params.set("include_print", "1");
    if (includeSoftproof) params.set("include_softproof", "1");
    return `/api/iml/products/export?${params}`;
  };

  const downloadExport = async (format: "csv" | "xlsx") => {
    setExportBusy(true);
    try {
      const res = await fetch(buildExportUrl(format));
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Export selhal");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      const fallback =
        includePrint || includeSoftproof
          ? `iml-produkty.zip`
          : format === "xlsx"
            ? "iml-produkty.xlsx"
            : "iml-produkty.csv";
      const filename = match?.[1] ?? fallback;
      const urlObj = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = urlObj;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(urlObj);
    } finally {
      setExportBusy(false);
    }
  };

  const refreshList = useCallback(() => {
    if (isInfiniteMode) {
      void fetchInfiniteInitial();
    } else {
      void fetchPagedProducts();
    }
  }, [isInfiniteMode, fetchInfiniteInitial, fetchPagedProducts]);

  const handleDelete = useCallback(
    async (id: number, name: string) => {
      if (!confirm(`Opravdu smazat produkt "${name || id}"?`)) return;
      const res = await fetch(`/api/iml/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        refreshList();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Chyba při mazání");
      }
    },
    [refreshList]
  );

  const cellContext = useMemo(
    () => ({
      canWrite,
      listHref,
      onDelete: handleDelete,
    }),
    [canWrite, listHref, handleDelete]
  );

  const showPageNav = !isInfiniteMode && totalPages > 1;

  const kindButtons: Array<{ value: string; label: string }> = [
    { value: "", label: "Vše" },
    { value: "iml", label: "IML" },
    { value: "etikety", label: "Etikety" },
  ];

  return (
    <div className="space-y-4">
      {canRead && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={includePrint}
                onChange={(e) => setIncludePrint(e.target.checked)}
              />
              Tisková data (PDF)
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={includeSoftproof}
                onChange={(e) => setIncludeSoftproof(e.target.checked)}
              />
              Softproof (obrázek)
            </label>
            {(includePrint || includeSoftproof) && (
              <span className="text-xs text-gray-500">Soubory budou v ZIP ve složce soubory/</span>
            )}
            {includePrint || includeSoftproof ? (
              <>
                <button
                  type="button"
                  disabled={exportBusy}
                  onClick={() => void downloadExport("csv")}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
                <button
                  type="button"
                  disabled={exportBusy}
                  onClick={() => void downloadExport("xlsx")}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  Export Excel
                </button>
              </>
            ) : (
              <>
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
              </>
            )}
            {tableReady && (
              <ProductListColumnPicker
                visibleColumnIds={visibleColumnIds}
                onToggle={toggleColumn}
                onReset={resetToDefaults}
                onResetWidths={resetWidths}
              />
            )}
          </div>
          <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 shadow-sm">
            {kindButtons.map((btn) => {
              const active = filterProductKind === btn.value;
              return (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => setFilter("product_kind", btn.value)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              // Enter: hned hledat, nečekat na debounce
              if (searchInput !== search) setFilter("search", searchInput);
              else setFilter("page", "1");
            }}
            className="flex flex-wrap gap-3"
          >
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Hledat podle kódu, názvu, SKU, formátu, výseku, barev…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onFocus={() => {
                  searchFocusedRef.current = true;
                }}
                onBlur={() => {
                  searchFocusedRef.current = false;
                  // Commit pending text — nevracet starší hodnotu z URL
                  if (searchInput !== search) setFilter("search", searchInput);
                }}
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
            <select
              value={filterArchive}
              onChange={(e) => setFilter("archive", e.target.value === "active" ? "" : e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              title="Archiv tiskových dat"
            >
              <option value="active">Aktivní (mimo archiv)</option>
              <option value="archived">Jen archiv</option>
              <option value="all">Vše včetně archivu</option>
            </select>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Šířka mm"
              value={filterWidth}
              onChange={(e) => setFilter("format_width_mm", e.target.value)}
              className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-sm"
              title="Filtr formátu – šířka"
            />
            <input
              type="text"
              inputMode="decimal"
              placeholder="Výška mm"
              value={filterHeight}
              onChange={(e) => setFilter("format_height_mm", e.target.value)}
              className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-sm"
              title="Filtr formátu – výška"
            />
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={filterMissingShape === "1"}
                onChange={(e) => setFilter("missing_shape", e.target.checked ? "1" : "")}
              />
              Bez tvaru
            </label>
            <button
              type="submit"
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Hledat
            </button>
          </form>
          {canWrite && (
            <div className="mt-3 space-y-2 rounded-lg border border-violet-100 bg-violet-50/50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-700">
                  Vybráno: <strong>{selectedIds.size}</strong>
                </span>
                <select
                  value={bulkShapeId}
                  onChange={(e) => setBulkShapeId(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                >
                  <option value="">— Vyberte tvar —</option>
                  {shapes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shape_code} ({Number(s.width_mm)}×{Number(s.height_mm)} mm)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={bulkBusy || selectedIds.size === 0 || !bulkShapeId}
                  onClick={() => void runBulkAssignShape()}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  Přiřadit tvar vybraným položkám
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  placeholder="E-mail klienta (volitelné)"
                  className="min-w-[220px] flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                />
                <button
                  type="button"
                  disabled={bulkBusy || selectedIds.size === 0}
                  onClick={() => void runSharePreview()}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  Sdílet náhledy
                </button>
                <button
                  type="button"
                  disabled={bulkBusy || selectedIds.size === 0}
                  onClick={() => void runExportSoftproofZip()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Stáhnout softproofy (ZIP)
                </button>
              </div>
              {bulkMsg && <p className="text-sm text-gray-600">{bulkMsg}</p>}
              {shareUrl && (
                <p className="break-all text-xs text-sky-800">
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    {shareUrl}
                  </a>
                </p>
              )}
            </div>
          )}
        </div>
        <ResizableProductListTable
          visibleColumns={visibleColumns}
          columnWidths={columnWidths}
          loading={loading}
          loadingMore={loadingMore}
          ready={tableReady}
          products={products}
          cellContext={cellContext}
          onResizeColumn={setWidth}
          onResetColumnWidth={resetWidth}
          selectionEnabled={canWrite}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAllPage={toggleSelectAllPage}
          sortColumn={filterSort}
          sortDir={filterDir}
          onCycleSort={cycleSort}
          onReorderColumns={reorderColumns}
          footer={
            isInfiniteMode && !loading && products.length > 0 ? (
              <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
            ) : undefined
          }
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
                <option value="all">Vše (načítání při rolování)</option>
              </select>
            </label>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {isInfiniteMode ? (
                <div className="flex flex-col items-end gap-1 text-sm text-gray-600">
                  <span className="flex items-center gap-2">
                    {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                    Načteno <strong>{products.length}</strong> z <strong>{total}</strong> produktů
                  </span>
                  {reachedCap && total > INFINITE_MAX_ROWS && (
                    <span className="text-xs text-amber-800">
                      Zobrazeno prvních {INFINITE_MAX_ROWS} — zpřesněte filtr nebo použijte export.
                    </span>
                  )}
                  {!reachedCap && hasMore && !loadingMore && (
                    <span className="text-xs text-gray-500">Rolujte dolů pro další produkty</span>
                  )}
                </div>
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
