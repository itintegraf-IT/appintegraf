"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type GrafikaImlInitial = {
  customer_id: number | null;
  product_id: number | null;
  die_cut_id: number | null;
  label_code: string | null;
  job_number: string | null;
};

type CustomerOpt = { id: number; name: string };
type ProductOpt = {
  id: number;
  ig_code: string | null;
  client_code: string | null;
  ig_short_name: string | null;
  client_name: string | null;
  ean_code: string | null;
  die_cut_id: number | null;
};
type DieCutOpt = {
  id: number;
  label_shape_code: string;
  die_cut_tool_code: string | null;
  internal_name: string | null;
};

type Props = {
  initial?: GrafikaImlInitial;
};

const EMPTY_CUSTOMER_LABEL = "— bez klienta —";

function productLabel(p: ProductOpt): string {
  const code = p.ig_code || p.client_code || `#${p.id}`;
  const name = p.ig_short_name || p.client_name;
  return name ? `${code} — ${name}` : code;
}

function dieCutLabel(d: DieCutOpt): string {
  const parts = [d.label_shape_code];
  if (d.die_cut_tool_code) parts.push(d.die_cut_tool_code);
  if (d.internal_name) parts.push(d.internal_name);
  return parts.join(" · ");
}

export function GrafikaImlFields({ initial }: Props) {
  const [allCustomers, setAllCustomers] = useState<CustomerOpt[]>([]);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [dieCuts, setDieCuts] = useState<DieCutOpt[]>([]);
  const [customerId, setCustomerId] = useState<string>(
    initial?.customer_id != null ? String(initial.customer_id) : ""
  );
  const [productId, setProductId] = useState<string>(
    initial?.product_id != null ? String(initial.product_id) : ""
  );
  const [dieCutId, setDieCutId] = useState<string>(
    initial?.die_cut_id != null ? String(initial.die_cut_id) : ""
  );
  const [labelCode, setLabelCode] = useState(initial?.label_code ?? "");
  const [jobNumber, setJobNumber] = useState(initial?.job_number ?? "");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const customerBoxRef = useRef<HTMLDivElement>(null);

  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const params = new URLSearchParams({ type: "customers", scope: "roots" });
      if (initial?.customer_id) params.set("id", String(initial.customer_id));
      const res = await fetch(`/api/makety/iml-lookup?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(typeof data.error === "string" ? data.error : "Nelze načíst klienty");
        return;
      }
      setAllCustomers(Array.isArray(data.customers) ? data.customers : []);
      setLoadError(null);
    } catch {
      setLoadError("Síťová chyba při načítání klientů");
    } finally {
      setCustomersLoading(false);
    }
  }, [initial?.customer_id]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const selectedCustomer = useMemo(
    () => allCustomers.find((c) => String(c.id) === customerId) ?? null,
    [allCustomers, customerId]
  );

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLocaleLowerCase("cs");
    if (!q) return allCustomers;
    return allCustomers.filter((c) => c.name.toLocaleLowerCase("cs").includes(q));
  }, [allCustomers, customerQuery]);

  useEffect(() => {
    if (!customerOpen) {
      setCustomerQuery(selectedCustomer?.name ?? "");
    }
  }, [selectedCustomer, customerOpen]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (customerBoxRef.current && !customerBoxRef.current.contains(e.target as Node)) {
        setCustomerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!customerId) {
      setProducts([]);
      setDieCuts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [prodRes, dieRes] = await Promise.all([
          fetch(`/api/makety/iml-lookup?type=products&customer_id=${customerId}`),
          fetch(`/api/makety/iml-lookup?type=die_cuts&customer_id=${customerId}`),
        ]);
        const prodData = await prodRes.json().catch(() => ({}));
        const dieData = await dieRes.json().catch(() => ({}));
        if (cancelled) return;
        setProducts(Array.isArray(prodData.products) ? prodData.products : []);
        setDieCuts(Array.isArray(dieData.die_cuts) ? dieData.die_cuts : []);
      } catch {
        if (!cancelled) {
          setProducts([]);
          setDieCuts([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const onCustomerChange = (value: string) => {
    setCustomerId(value);
    setProductId("");
    setDieCutId("");
    setLabelCode("");
    setCustomerOpen(false);
  };

  const onProductChange = (value: string) => {
    setProductId(value);
    if (!value) return;
    const p = products.find((x) => String(x.id) === value);
    if (!p) return;
    const code = p.ig_code || p.client_code || p.ean_code || "";
    if (code) setLabelCode(code);
    if (p.die_cut_id != null) setDieCutId(String(p.die_cut_id));
  };

  const displayValue = customerOpen
    ? customerQuery
    : selectedCustomer
      ? selectedCustomer.name
      : EMPTY_CUSTOMER_LABEL;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Propojení s IML katalogem</h3>
      <p className="mt-1 text-xs text-gray-500">
        Klient, etiketa a výsek pro párování dat. Číslo zakázky slouží pro budoucí ERP.
      </p>

      {loadError && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {loadError}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Klient</label>
          <input type="hidden" name="customer_id" value={customerId} />
          <div ref={customerBoxRef} className="relative">
            <div className="relative">
              <input
                type="text"
                role="combobox"
                aria-expanded={customerOpen}
                aria-controls="grafika-customer-listbox"
                aria-autocomplete="list"
                value={displayValue}
                disabled={customersLoading}
                placeholder={EMPTY_CUSTOMER_LABEL}
                onChange={(e) => {
                  setCustomerQuery(e.target.value);
                  setCustomerOpen(true);
                  if (!e.target.value.trim()) onCustomerChange("");
                }}
                onFocus={() => {
                  setCustomerOpen(true);
                  setCustomerQuery(selectedCustomer?.name ?? "");
                }}
                className={`w-full rounded-lg border border-gray-300 py-2 pl-3 pr-9 text-sm disabled:bg-gray-50 ${
                  !selectedCustomer && !customerOpen ? "text-gray-500" : "text-gray-900"
                }`}
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label="Otevřít seznam klientů"
                disabled={customersLoading}
                onClick={() => {
                  setCustomerOpen((o) => !o);
                  if (!customerOpen) setCustomerQuery(selectedCustomer?.name ?? "");
                }}
                className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 hover:text-gray-600"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            {customerOpen && !customersLoading && (
              <ul
                id="grafika-customer-listbox"
                role="listbox"
                className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              >
                <li role="option" aria-selected={!customerId}>
                  <button
                    type="button"
                    onClick={() => onCustomerChange("")}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                      !customerId ? "bg-red-50 text-red-800" : "text-gray-500"
                    }`}
                  >
                    {EMPTY_CUSTOMER_LABEL}
                  </button>
                </li>
                {filteredCustomers.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-gray-500">Žádný klient</li>
                ) : (
                  filteredCustomers.map((c) => (
                    <li key={c.id} role="option" aria-selected={String(c.id) === customerId}>
                      <button
                        type="button"
                        onClick={() => onCustomerChange(String(c.id))}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                          String(c.id) === customerId
                            ? "bg-red-50 text-red-800"
                            : "text-gray-800"
                        }`}
                      >
                        {c.name}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {customersLoading
              ? "Načítání klientů…"
              : "Rozevírací seznam — pište pro vyhledání, výchozí je bez klienta"}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Etiketa (katalog)</label>
          <select
            name="product_id"
            value={productId}
            onChange={(e) => onProductChange(e.target.value)}
            disabled={!customerId}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          >
            <option value="">— volitelné —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {productLabel(p)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Kód výseku</label>
          <select
            name="die_cut_id"
            value={dieCutId}
            onChange={(e) => setDieCutId(e.target.value)}
            disabled={!customerId}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          >
            <option value="">— volitelné —</option>
            {dieCuts.map((d) => (
              <option key={d.id} value={d.id}>
                {dieCutLabel(d)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Kód etikety</label>
          <input
            name="label_code"
            type="text"
            value={labelCode}
            onChange={(e) => setLabelCode(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="IG / klientský kód"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Číslo zakázky (ERP)</label>
          <input
            name="job_number"
            type="text"
            value={jobNumber}
            onChange={(e) => setJobNumber(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Pro párování s ekonomickým systémem"
          />
        </div>
      </div>
    </div>
  );
}
