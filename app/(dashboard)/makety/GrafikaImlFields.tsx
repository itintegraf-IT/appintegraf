"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

export type GrafikaImlInitial = {
  customer_id: number | null;
  product_id: number | null;
  die_cut_id: number | null;
  shape_id: number | null;
  label_code: string | null;
  product_name: string | null;
  job_number: string | null;
};

type CustomerOpt = { id: number; name: string };
type ProductOpt = {
  id: number;
  customer_id: number | null;
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
type ShapeOpt = {
  id: number;
  shape_code: string;
  width_mm: number | string;
  height_mm: number | string;
};

type Props = {
  initial?: GrafikaImlInitial;
  /** Při úpravě dat je výběr etikety z IML povinný. */
  requireProduct?: boolean;
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

export function GrafikaImlFields({ initial, requireProduct = false }: Props) {
  const [allCustomers, setAllCustomers] = useState<CustomerOpt[]>([]);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [dieCuts, setDieCuts] = useState<DieCutOpt[]>([]);
  const [shapes, setShapes] = useState<ShapeOpt[]>([]);
  const [customerId, setCustomerId] = useState<string>(
    initial?.customer_id != null ? String(initial.customer_id) : ""
  );
  const [productId, setProductId] = useState<string>(
    initial?.product_id != null ? String(initial.product_id) : ""
  );
  const [dieCutId, setDieCutId] = useState<string>(
    initial?.die_cut_id != null ? String(initial.die_cut_id) : ""
  );
  const [shapeId, setShapeId] = useState<string>(
    initial?.shape_id != null ? String(initial.shape_id) : ""
  );
  const [labelCode, setLabelCode] = useState(initial?.label_code ?? "");
  const [productName, setProductName] = useState(initial?.product_name ?? "");
  const [productNameTouched, setProductNameTouched] = useState(
    Boolean(initial?.product_name?.trim())
  );
  const [jobNumber, setJobNumber] = useState(initial?.job_number ?? "");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const customerBoxRef = useRef<HTMLDivElement>(null);

  const [productQuery, setProductQuery] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProductLabel, setSelectedProductLabel] = useState("");
  const productBoxRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/iml/shapes");
        const data = await res.json().catch(() => ({}));
        if (res.ok) setShapes(Array.isArray(data.shapes) ? data.shapes : []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  // Načíst vybranou etiketu při editaci (úprava dat / initial)
  useEffect(() => {
    if (!requireProduct || !initial?.product_id) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          type: "products",
          id: String(initial.product_id),
        });
        const res = await fetch(`/api/makety/iml-lookup?${params}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        const list = Array.isArray(data.products) ? (data.products as ProductOpt[]) : [];
        const found = list.find((p) => p.id === initial.product_id);
        if (found) {
          setProducts((prev) =>
            prev.some((p) => p.id === found.id) ? prev : [found, ...prev]
          );
          setSelectedProductLabel(productLabel(found));
        } else if (initial.label_code || initial.product_name) {
          setSelectedProductLabel(
            [initial.label_code, initial.product_name].filter(Boolean).join(" — ")
          );
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requireProduct, initial?.product_id, initial?.label_code, initial?.product_name]);

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
      if (productBoxRef.current && !productBoxRef.current.contains(e.target as Node)) {
        setProductOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Nová data: produkty jen podle klienta (původní chování)
  useEffect(() => {
    if (requireProduct) return;
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
  }, [customerId, requireProduct]);

  // Úprava dat: globální / filtrované hledání etiket
  useEffect(() => {
    if (!requireProduct) return;
    const q = productQuery.trim();
    // Bez query: nic nenačítej (kromě už vybrané v products)
    if (q.length < 2 && !customerId) {
      setProducts((prev) =>
        productId ? prev.filter((p) => String(p.id) === productId) : []
      );
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        setProductsLoading(true);
        try {
          const params = new URLSearchParams({ type: "products" });
          if (q.length >= 2) params.set("q", q);
          if (customerId) params.set("customer_id", customerId);
          if (productId) params.set("id", productId);
          // S klientem a bez q: seznam klienta (API to umí)
          if (customerId && q.length < 2) {
            // ok – API bez q a s customer_id vrátí produkty klienta
          } else if (!customerId && q.length < 2) {
            setProductsLoading(false);
            return;
          }
          const res = await fetch(`/api/makety/iml-lookup?${params}`);
          const data = await res.json().catch(() => ({}));
          if (cancelled) return;
          setProducts(Array.isArray(data.products) ? data.products : []);
        } catch {
          if (!cancelled) setProducts([]);
        } finally {
          if (!cancelled) setProductsLoading(false);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [requireProduct, productQuery, customerId, productId]);

  // Výseky při klientovi (i u úpravy dat)
  useEffect(() => {
    if (!requireProduct) return;
    if (!customerId) {
      setDieCuts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const dieRes = await fetch(
          `/api/makety/iml-lookup?type=die_cuts&customer_id=${customerId}`
        );
        const dieData = await dieRes.json().catch(() => ({}));
        if (cancelled) return;
        setDieCuts(Array.isArray(dieData.die_cuts) ? dieData.die_cuts : []);
      } catch {
        if (!cancelled) setDieCuts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requireProduct, customerId]);

  const applyProductFields = (p: ProductOpt) => {
    const code = p.ig_code || p.client_code || p.ean_code || "";
    if (code) setLabelCode(code);
    if (p.die_cut_id != null) setDieCutId(String(p.die_cut_id));
    if (!productNameTouched) {
      const name = p.client_name?.trim() || p.ig_short_name?.trim() || "";
      if (name) setProductName(name);
    }
  };

  const onCustomerChange = (value: string) => {
    setCustomerId(value);
    setCustomerOpen(false);
    if (!requireProduct) {
      setProductId("");
      setDieCutId("");
      setLabelCode("");
      setProductName("");
      setProductNameTouched(false);
      setSelectedProductLabel("");
      return;
    }
    // Úprava dat: produkt zruš jen když nesedí k novému klientovi
    if (value && productId) {
      const p = products.find((x) => String(x.id) === productId);
      if (p?.customer_id != null && String(p.customer_id) !== value) {
        setProductId("");
        setSelectedProductLabel("");
        setDieCutId("");
        setLabelCode("");
        setProductName("");
        setProductNameTouched(false);
      }
    }
  };

  const onProductChange = (value: string) => {
    setProductId(value);
    if (!value) {
      setSelectedProductLabel("");
      return;
    }
    const p = products.find((x) => String(x.id) === value);
    if (!p) return;
    applyProductFields(p);
    setSelectedProductLabel(productLabel(p));
  };

  const onProductPick = (p: ProductOpt) => {
    setProductId(String(p.id));
    applyProductFields(p);
    setSelectedProductLabel(productLabel(p));
    setProductOpen(false);
    setProductQuery("");
    if (p.customer_id != null) {
      const cid = String(p.customer_id);
      setCustomerId(cid);
      // Zajistit, že klient je v seznamu (pro zobrazení jména)
      if (!allCustomers.some((c) => c.id === p.customer_id)) {
        void (async () => {
          try {
            const params = new URLSearchParams({
              type: "customers",
              scope: "roots",
              id: cid,
            });
            const res = await fetch(`/api/makety/iml-lookup?${params}`);
            const data = await res.json().catch(() => ({}));
            if (res.ok && Array.isArray(data.customers)) {
              setAllCustomers((prev) => {
                const next = [...prev];
                for (const c of data.customers as CustomerOpt[]) {
                  if (!next.some((x) => x.id === c.id)) next.push(c);
                }
                return next;
              });
            }
          } catch {
            /* ignore */
          }
        })();
      }
    }
  };

  const displayValue = customerOpen
    ? customerQuery
    : selectedCustomer
      ? selectedCustomer.name
      : EMPTY_CUSTOMER_LABEL;

  const productDisplayValue = productOpen
    ? productQuery
    : productId
      ? selectedProductLabel || "Vybraná etiketa"
      : "";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Propojení s IML katalogem</h3>
      <p className="mt-1 text-xs text-gray-500">
        Klient, tvar etikety a etiketa pro párování dat. Tvar lze doplnit později v IML.
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
              : requireProduct
                ? "Volitelné — nebo nejdřív vyberte etiketu z katalogu (klient se doplní)"
                : "Rozevírací seznam — pište pro vyhledání, výchozí je bez klienta"}
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Název</label>
          <input
            name="product_name"
            type="text"
            value={productName}
            onChange={(e) => {
              setProductNameTouched(true);
              setProductName(e.target.value);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Název etikety pro IML katalog (Název / Klient)"
          />
          <p className="mt-1 text-xs text-gray-500">
            Při zápisu do IML se přenese jako název u klienta. Výběr etikety z katalogu pole
            předvyplní.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Etiketa (katalog)
            {requireProduct && <span className="text-red-600"> *</span>}
          </label>
          {requireProduct ? (
            <div ref={productBoxRef} className="relative">
              <input type="hidden" name="product_id" value={productId} />
              {/* Native required: combobox samotný nestačí (text ≠ vybrané id) */}
              <input
                tabIndex={-1}
                aria-hidden
                className="pointer-events-none absolute h-0 w-0 opacity-0"
                value={productId}
                required
                onChange={() => {}}
              />
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  role="combobox"
                  aria-expanded={productOpen}
                  aria-controls="grafika-product-listbox"
                  aria-autocomplete="list"
                  value={productDisplayValue}
                  placeholder="Pište kód / název / EAN…"
                  onChange={(e) => {
                    setProductQuery(e.target.value);
                    setProductOpen(true);
                    if (!e.target.value.trim()) {
                      setProductId("");
                      setSelectedProductLabel("");
                    }
                  }}
                  onFocus={() => {
                    setProductOpen(true);
                    setProductQuery("");
                  }}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-9 text-sm"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Otevřít seznam etiket"
                  onClick={() => setProductOpen((o) => !o)}
                  className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 hover:text-gray-600"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              {productOpen && (
                <ul
                  id="grafika-product-listbox"
                  role="listbox"
                  className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                >
                  {productsLoading ? (
                    <li className="px-3 py-2 text-sm text-gray-500">Hledám…</li>
                  ) : productQuery.trim().length < 2 && !customerId ? (
                    <li className="px-3 py-2 text-sm text-gray-500">
                      Zadejte alespoň 2 znaky pro hledání v celém katalogu
                    </li>
                  ) : products.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-gray-500">Žádná etiketa</li>
                  ) : (
                    products.map((p) => (
                      <li
                        key={p.id}
                        role="option"
                        aria-selected={String(p.id) === productId}
                      >
                        <button
                          type="button"
                          onClick={() => onProductPick(p)}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                            String(p.id) === productId
                              ? "bg-red-50 text-red-800"
                              : "text-gray-800"
                          }`}
                        >
                          {productLabel(p)}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
              <p className="mt-1 text-xs text-amber-700">
                U úpravy dat je vazba na existující položku IML povinná (produkt se zamkne).
                Hledejte v celém katalogu i bez klienta.
              </p>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Tvar etikety
          </label>
          <select
            name="shape_id"
            value={shapeId}
            onChange={(e) => setShapeId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">— volitelné —</option>
            {shapes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.shape_code} ({Number(s.width_mm)}×{Number(s.height_mm)} mm)
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Číselník IML → Výseky → Tvary. Lze doplnit později u produktu.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Legacy výsek (volitelné)
          </label>
          <select
            name="die_cut_id"
            value={dieCutId}
            onChange={(e) => setDieCutId(e.target.value)}
            disabled={!customerId}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          >
            <option value="">— bez legacy výseku —</option>
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
