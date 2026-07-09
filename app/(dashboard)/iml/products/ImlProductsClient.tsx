"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Eye, Pencil, Trash2, FileText, ImageOff, ImageIcon } from "lucide-react";
import { IML_ITEM_STATUSES, imlItemStatusLabel } from "@/lib/iml-constants";
import { useListFilters } from "@/lib/navigation/use-list-filters";
import { withReturnTo } from "@/lib/navigation/return-to";

const SHOW_THUMBNAILS_STORAGE_KEY = "iml-products-show-thumbnails";
const PER_PAGE_STORAGE_KEY = "iml-products-per-page";

const PRODUCT_LIST_FILTER_DEFAULTS = {
  search: "",
  customer_id: "",
  status: "",
  page: "1",
  per_page: "",
};

type PerPageOption = "25" | "50" | "100" | "all";

type Product = {
  id: number;
  ig_code: string | null;
  ig_short_name: string | null;
  client_code: string | null;
  client_name: string | null;
  item_status: string | null;
  iml_customers?: { id: number; name: string } | null;
  has_image?: boolean;
  has_pdf?: boolean;
};

type Customer = { id: number; name: string };

type Props = { canWrite: boolean; canRead?: boolean };

function parseStoredPerPage(value: string | null): PerPageOption {
  if (value === "50" || value === "100" || value === "all") return value;
  return "25";
}

function ProductListThumbnail({ product }: { product: Product }) {
  if (product.has_image) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={`/api/iml/products/${product.id}/image`}
        alt=""
        className="h-10 w-10 rounded border border-gray-200 bg-white object-contain"
        loading="lazy"
      />
    );
  }

  if (product.has_pdf) {
    return (
      <div
        className="flex h-10 w-10 items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50 text-gray-400"
        title="Bez miniatury – otevřete detail nebo spusťte doplnění miniatur"
      >
        <FileText className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50 text-gray-300"
      title="Bez obrázku"
    >
      <ImageOff className="h-4 w-4" />
    </div>
  );
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

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [perPageBootstrapped, setPerPageBootstrapped] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SHOW_THUMBNAILS_STORAGE_KEY);
      setShowThumbnails(stored === "1");
    } catch {
      setShowThumbnails(false);
    }
  }, []);

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

  const toggleShowThumbnails = () => {
    setShowThumbnails((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SHOW_THUMBNAILS_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

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

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Opravdu smazat produkt "${name || id}"?`)) return;
    const res = await fetch(`/api/iml/products/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchProducts();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Chyba při mazání");
    }
  };

  const colCount = showThumbnails ? 7 : 6;
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
          <button
            type="button"
            onClick={toggleShowThumbnails}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm ${
              showThumbnails
                ? "border-red-300 bg-red-50 text-red-800"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
            title="Zobrazit sloupec s miniatury (JPEG/PNG z databáze, ne PDF)"
          >
            <ImageIcon className="h-4 w-4" />
            {showThumbnails ? "Skrýt náhledy" : "Zobrazit náhledy"}
          </button>
        </div>
      )}
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); setFilter("page", "1"); }}
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
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilter("status", e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Všechny stavy</option>
            {IML_ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>{imlItemStatusLabel(s)}</option>
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
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              {showThumbnails && (
                <th className="w-14 px-3 py-3 text-left text-sm font-semibold text-gray-700">
                  Náhled
                </th>
              )}
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kód IG</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Název / Klient</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Zákazník</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stav</th>
              <th className="w-20 px-3 py-3 text-center text-sm font-semibold text-gray-700">PDF</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Akce</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-gray-500">
                  Načítání…
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-gray-500">
                  Žádné produkty
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  {showThumbnails && (
                    <td className="px-3 py-2">
                      <ProductListThumbnail product={p} />
                    </td>
                  )}
                  <td className="px-4 py-3 font-mono text-sm">{p.ig_code ?? "-"}</td>
                  <td className="px-4 py-3">{p.client_name ?? p.ig_short_name ?? "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{p.iml_customers?.name ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-sm">{p.item_status ?? "-"}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {p.has_pdf ? (
                      <a
                        href={`/api/iml/products/${p.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-8 w-8 items-center justify-center rounded text-red-600 hover:bg-red-50"
                        title="Otevřít PDF tisková data"
                      >
                        <FileText className="h-5 w-5" />
                      </a>
                    ) : (
                      <span className="text-gray-300" title="Bez tiskových dat">
                        <FileText className="mx-auto h-5 w-5 opacity-30" />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={withReturnTo(`/iml/products/${p.id}`, listHref)}
                        className="rounded p-2 text-gray-600 hover:bg-gray-100"
                        title="Detail"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      {canWrite && (
                        <>
                          <Link
                            href={withReturnTo(`/iml/products/${p.id}/edit`, listHref)}
                            className="rounded p-2 text-gray-600 hover:bg-gray-100"
                            title="Upravit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id, p.client_name ?? p.ig_short_name ?? "")}
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
              <span className="text-sm text-gray-600">
                Zobrazeno všech {total} produktů
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setFilter("page", String(Math.max(1, page - 1)))}
                  disabled={page <= 1}
                  className="rounded border px-3 py-1 text-sm disabled:pointer-events-none disabled:opacity-50 hover:bg-gray-50"
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
                  className="rounded border px-3 py-1 text-sm disabled:pointer-events-none disabled:opacity-50 hover:bg-gray-50"
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
