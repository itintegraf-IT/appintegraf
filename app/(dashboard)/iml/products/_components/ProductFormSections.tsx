"use client";

import {
  Boxes,
  CircleCheckBig,
  Layers,
  Printer,
} from "lucide-react";
import { Tabs, type TabDef } from "../../_components/Tabs";
import { IML_ITEM_STATUSES, imlItemStatusLabel } from "@/lib/iml-constants";

export type ProductFormState = {
  customer_id: string;
  ig_code: string;
  ig_short_name: string;
  client_code: string;
  client_name: string;
  requester: string;
  sku: string;
  label_shape_code: string;
  product_format: string;
  die_cut_tool_code: string;
  assembly_code: string;
  positions_on_sheet: string;
  pieces_per_box: string;
  pieces_per_pallet: string;
  foil_type: string;
  color_coverage: string;
  ean_code: string;
  has_print_sample: boolean;
  print_note: string;
  production_notes: string;
  approval_status: string;
  item_status: string;
  print_data_version: string;
  stock_quantity: string;
  realization_log: string;
  internal_note: string;
};

export type ProductFormErrors = Partial<Record<keyof ProductFormState, string>>;

export type CustomerOption = { id: number; name: string };

type Props = {
  form: ProductFormState;
  setField: <K extends keyof ProductFormState>(k: K, v: ProductFormState[K]) => void;
  customers: CustomerOption[];
  errors?: ProductFormErrors;
};

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2";

/**
 * Formulář produktu rozdělený na 4 záložky:
 *   id       – Identifikace (zákazník, kódy, názvy, SKU, zadavatel)
 *   cut      – Výseky a rozměry (kód tvaru, formát, výsek, montáž, pozic, balení)
 *   material – Materiály a tisk (fólie, barevnost, EAN, vzor, poznámky k tisku/výrobě)
 *   print    – Tisková data (stav schválení/položky, verze PDF, skladem, log, interní pozn.)
 *
 * Aktivní záložka se synchronizuje s URL parametrem ?tab=id|cut|material|print
 * (sdílitelný odkaz na konkrétní sekci).
 */
export default function ProductFormSections({
  form,
  setField,
  customers,
  errors,
}: Props) {
  const err = errors ?? {};

  const tabs: TabDef[] = [
    {
      id: "id",
      label: "Identifikace",
      icon: <CircleCheckBig className="h-4 w-4" />,
      content: (
        <TabShell title="Identifikace" subtitle="Zákazník, interní kódy IG, kódy u klienta a zadavatel">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Zákazník" error={err.customer_id}>
              <select
                value={form.customer_id}
                onChange={(e) => setField("customer_id", e.target.value)}
                className={inputCls}
              >
                <option value="">— Vyberte —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Kód IG" error={err.ig_code}>
              <input
                type="text"
                value={form.ig_code}
                onChange={(e) => setField("ig_code", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Zkrácený název (IG)" error={err.ig_short_name}>
              <input
                type="text"
                value={form.ig_short_name}
                onChange={(e) => setField("ig_short_name", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Kód u klienta" error={err.client_code}>
              <input
                type="text"
                value={form.client_code}
                onChange={(e) => setField("client_code", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Název u klienta" error={err.client_name}>
              <input
                type="text"
                value={form.client_name}
                onChange={(e) => setField("client_name", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Zadavatel" error={err.requester}>
              <input
                type="text"
                value={form.requester}
                onChange={(e) => setField("requester", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="SKU" span={2} error={err.sku}>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setField("sku", e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </TabShell>
      ),
    },
    {
      id: "cut",
      label: "Výseky",
      icon: <Layers className="h-4 w-4" />,
      content: (
        <TabShell title="Výseky a rozměry" subtitle="Kód tvaru etikety, formát, nástroje a balení">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kód tvaru etikety" error={err.label_shape_code}>
              <input
                type="text"
                value={form.label_shape_code}
                onChange={(e) => setField("label_shape_code", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Rozměr / formát" error={err.product_format}>
              <input
                type="text"
                value={form.product_format}
                onChange={(e) => setField("product_format", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Kód výsekového nástroje" error={err.die_cut_tool_code}>
              <input
                type="text"
                value={form.die_cut_tool_code}
                onChange={(e) => setField("die_cut_tool_code", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Kód montáže" error={err.assembly_code}>
              <input
                type="text"
                value={form.assembly_code}
                onChange={(e) => setField("assembly_code", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Pozic na archu" error={err.positions_on_sheet}>
              <input
                type="number"
                value={form.positions_on_sheet}
                onChange={(e) => setField("positions_on_sheet", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Kusů v krabici" error={err.pieces_per_box}>
              <input
                type="number"
                value={form.pieces_per_box}
                onChange={(e) => setField("pieces_per_box", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Kusů na paletě" span={2} error={err.pieces_per_pallet}>
              <input
                type="number"
                value={form.pieces_per_pallet}
                onChange={(e) => setField("pieces_per_pallet", e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </TabShell>
      ),
    },
    {
      id: "material",
      label: "Materiály",
      icon: <Boxes className="h-4 w-4" />,
      content: (
        <TabShell title="Materiály a tisk" subtitle="Fólie, barevnost, EAN, vzory a poznámky">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Druh fólie" error={err.foil_type}>
              <input
                type="text"
                value={form.foil_type}
                onChange={(e) => setField("foil_type", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Barevnost / pokrytí" error={err.color_coverage}>
              <input
                type="text"
                value={form.color_coverage}
                onChange={(e) => setField("color_coverage", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="EAN kód" error={err.ean_code}>
              <input
                type="text"
                value={form.ean_code}
                onChange={(e) => setField("ean_code", e.target.value)}
                className={inputCls}
              />
            </Field>
            <div className="flex items-center gap-2 sm:pt-7">
              <input
                type="checkbox"
                id="has_print_sample"
                checked={form.has_print_sample}
                onChange={(e) => setField("has_print_sample", e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="has_print_sample" className="text-sm font-medium text-gray-700">
                Máme vzor min. tisku
              </label>
            </div>
            <Field label="Poznámka k tisku" span={2} error={err.print_note}>
              <textarea
                value={form.print_note}
                onChange={(e) => setField("print_note", e.target.value)}
                rows={2}
                className={inputCls}
              />
            </Field>
            <Field label="Výrobní poznámky" span={2} error={err.production_notes}>
              <textarea
                value={form.production_notes}
                onChange={(e) => setField("production_notes", e.target.value)}
                rows={2}
                className={inputCls}
              />
            </Field>
          </div>
        </TabShell>
      ),
    },
    {
      id: "print",
      label: "Tisková data",
      icon: <Printer className="h-4 w-4" />,
      content: (
        <TabShell title="Tisková data a stavy" subtitle="Schvalování, stav položky, verze PDF, skladové množství a poznámky">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Stav schválení" error={err.approval_status}>
              <input
                type="text"
                value={form.approval_status}
                onChange={(e) => setField("approval_status", e.target.value)}
                placeholder="máme / nemáme / řeší grafik…"
                className={inputCls}
              />
            </Field>
            <Field label="Stav položky" error={err.item_status}>
              <select
                value={form.item_status}
                onChange={(e) => setField("item_status", e.target.value)}
                className={inputCls}
              >
                {IML_ITEM_STATUSES.map((s) => (
                  <option key={s} value={s}>{imlItemStatusLabel(s)}</option>
                ))}
              </select>
            </Field>
            <Field label="Verze tiskových dat" error={err.print_data_version}>
              <input
                type="text"
                value={form.print_data_version}
                onChange={(e) => setField("print_data_version", e.target.value)}
                placeholder="v1, v2…"
                className={inputCls}
              />
            </Field>
            <Field label="Skladem" error={err.stock_quantity}>
              <input
                type="number"
                value={form.stock_quantity}
                onChange={(e) => setField("stock_quantity", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="LOG realizací" span={2} error={err.realization_log}>
              <textarea
                value={form.realization_log}
                onChange={(e) => setField("realization_log", e.target.value)}
                rows={2}
                className={inputCls}
              />
            </Field>
            <Field label="Interní poznámka" span={2} error={err.internal_note}>
              <textarea
                value={form.internal_note}
                onChange={(e) => setField("internal_note", e.target.value)}
                rows={2}
                className={inputCls}
              />
            </Field>
          </div>
        </TabShell>
      ),
    },
  ];

  return <Tabs tabs={tabs} urlParam="tab" storageKey="productForm" />;
}

function TabShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 border-b border-gray-100 pb-3">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  span = 1,
  children,
  error,
  hint,
}: {
  label: string;
  span?: 1 | 2;
  children: React.ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <div className={span === 2 ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-gray-400">{hint}</p>
      ) : null}
    </div>
  );
}

export const emptyProductForm: ProductFormState = {
  customer_id: "",
  ig_code: "",
  ig_short_name: "",
  client_code: "",
  client_name: "",
  requester: "",
  sku: "",
  label_shape_code: "",
  product_format: "",
  die_cut_tool_code: "",
  assembly_code: "",
  positions_on_sheet: "",
  pieces_per_box: "",
  pieces_per_pallet: "",
  foil_type: "",
  color_coverage: "",
  ean_code: "",
  has_print_sample: false,
  print_note: "",
  production_notes: "",
  approval_status: "",
  item_status: "aktivní",
  print_data_version: "",
  stock_quantity: "",
  realization_log: "",
  internal_note: "",
};
