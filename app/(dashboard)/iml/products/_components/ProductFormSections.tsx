"use client";

import { useEffect, useRef } from "react";
import {
  Boxes,
  CircleCheckBig,
  Droplets,
  Layers,
  Printer,
} from "lucide-react";
import { Tabs, type TabDef } from "../../_components/Tabs";
import {
  IML_APPROVAL_STATUSES,
  IML_COLOR_COUNT_OPTIONS,
  IML_ITEM_STATUSES,
  IML_LABEL_TYPES,
  imlItemStatusLabel,
} from "@/lib/iml-constants";
import { formatProductFormatFromMm } from "@/lib/iml/product-format";
import { MaterialSelect } from "../../_components/MaterialSelect";
import ProductPantoneEditor, {
  type ProductColorRow,
} from "./ProductPantoneEditor";
import ProductCmykToggles from "./ProductCmykToggles";
import {
  defaultProductCmykFlags,
  hasValidPantoneRows,
  type ProductCmykFlags,
} from "@/lib/iml-print-colors-summary";

export type ProductFormState = {
  customer_id: string;
  ig_code: string;
  ig_short_name: string;
  client_code: string;
  client_name: string;
  requester: string;
  sku: string;
  label_shape_code: string;
  die_cut_tool_code: string;
  assembly_code: string;
  positions_on_sheet: string;
  labels_per_sheet: string;
  pieces_per_box: string;
  pieces_per_pallet: string;
  foil_material_id: string;
  color_material_id: string;
  paper_material_id: string;
  lacquer_material_id: string;
  foil_type: string;
  color_coverage: string;
  print_note: string;
  production_notes: string;
  approval_status: string;
  approval_date: string;
  item_status: string;
  format_width_mm: string;
  format_height_mm: string;
  color_count: string;
  print_colors_text: string;
  label_type: string;
  ean_code: string;
  has_print_sample: boolean;
  has_print_proof: boolean;
  print_data_version: string;
  stock_quantity: string;
  realization_log: string;
  internal_note: string;
};

export type ProductFormErrors = Partial<Record<keyof ProductFormState, string>>;

export type CustomerOption = { id: number; name: string };
export type FoilOption = { id: number; code: string; name: string; is_active?: boolean };

type Props = {
  form: ProductFormState;
  setField: <K extends keyof ProductFormState>(k: K, v: ProductFormState[K]) => void;
  customers: CustomerOption[];
  /** @deprecated číselník fólií je v katalogu materiálů; ponecháno kvůli kompatibilitě volajících */
  foils?: FoilOption[];
  errors?: ProductFormErrors;
  /**
   * Pole Pantone barev produktu (pro novou záložku "Barvy").
   * Pokud je `undefined`, záložka se skryje (např. import formulář).
   */
  colors?: ProductColorRow[];
  onColorsChange?: (colors: ProductColorRow[]) => void;
  cmykFlags?: ProductCmykFlags;
  onCmykChange?: (flags: ProductCmykFlags) => void;
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
  colors,
  onColorsChange,
  cmykFlags,
  onCmykChange,
}: Props) {
  const err = errors ?? {};
  const formatPreview = formatProductFormatFromMm(
    form.format_width_mm ? parseFloat(form.format_width_mm) : null,
    form.format_height_mm ? parseFloat(form.format_height_mm) : null
  );
  const legacyApprovalStatus =
    form.approval_status &&
    !(IML_APPROVAL_STATUSES as readonly string[]).includes(form.approval_status)
      ? form.approval_status
      : null;

  const hasPantone = colors ? hasValidPantoneRows(colors) : false;
  const prevHasPantoneRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!onCmykChange || colors === undefined) return;

    if (prevHasPantoneRef.current === null) {
      prevHasPantoneRef.current = hasPantone;
      if (hasPantone) {
        onCmykChange({ c: false, m: false, y: false, k: false });
      }
      return;
    }

    if (hasPantone === prevHasPantoneRef.current) return;

    if (hasPantone) {
      onCmykChange({ c: false, m: false, y: false, k: false });
    } else {
      onCmykChange(defaultProductCmykFlags());
    }
    prevHasPantoneRef.current = hasPantone;
  }, [hasPantone, onCmykChange, colors]);

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
            <Field
              label="Počet etiket na tiskový arch (TA)"
              error={err.labels_per_sheet}
              hint="Potřebné pro výpočet spotřeby barvy v reportu (viz tab Barvy)."
            >
              <input
                type="number"
                min={1}
                step={1}
                value={form.labels_per_sheet}
                onChange={(e) => setField("labels_per_sheet", e.target.value)}
                className={inputCls}
                placeholder="např. 100"
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
        <TabShell title="Materiály" subtitle="Výběr z katalogu materiálů (papír, fólie, barevnost, lak) a poznámky">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <MaterialSelect
                category="PAPER"
                label="Papír"
                value={form.paper_material_id}
                onChange={(mid) => setField("paper_material_id", mid)}
              />
              {err.paper_material_id && (
                <p className="mt-1 text-xs text-red-600">{err.paper_material_id}</p>
              )}
            </div>
            <div>
              <MaterialSelect
                category="FOIL"
                label="Druh fólie"
                value={form.foil_material_id}
                onChange={(mid, label) => {
                  setField("foil_material_id", mid);
                  if (label) setField("foil_type", label);
                }}
              />
              {err.foil_material_id && (
                <p className="mt-1 text-xs text-red-600">{err.foil_material_id}</p>
              )}
              <p className="mt-1 text-xs text-gray-400">Číselník v Nastavení IML › Fólie.</p>
            </div>
            <div>
              <MaterialSelect
                category="COLOR"
                label="Barevnost (katalog)"
                value={form.color_material_id}
                onChange={(mid, label) => {
                  setField("color_material_id", mid);
                  if (label) setField("color_coverage", label);
                }}
                coverageValue={form.color_coverage}
                onCoverageChange={(v) => setField("color_coverage", v)}
                coverageLabel="Poznámka / % pokrytí (volitelné)"
              />
              {err.color_material_id && (
                <p className="mt-1 text-xs text-red-600">{err.color_material_id}</p>
              )}
            </div>
            <div>
              <MaterialSelect
                category="LACQUER"
                label="Lak"
                value={form.lacquer_material_id}
                onChange={(mid) => setField("lacquer_material_id", mid)}
              />
              {err.lacquer_material_id && (
                <p className="mt-1 text-xs text-red-600">{err.lacquer_material_id}</p>
              )}
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
    ...(colors !== undefined && onColorsChange
      ? [
          {
            id: "colors",
            label: "Barvy",
            icon: <Droplets className="h-4 w-4" />,
            content: (
              <TabShell
                title="Barvy"
                subtitle="Procesní CMYK a Pantone barvy s pokrytím v %"
              >
                {cmykFlags !== undefined && onCmykChange && (
                  <ProductCmykToggles
                    flags={cmykFlags}
                    onChange={onCmykChange}
                    hasPantone={hasPantone}
                  />
                )}
                <ProductPantoneEditor
                  colors={colors}
                  onChange={onColorsChange}
                  labelsPerSheet={
                    form.labels_per_sheet ? parseInt(form.labels_per_sheet, 10) : null
                  }
                />
              </TabShell>
            ),
          } as TabDef,
        ]
      : []),
    {
      id: "print",
      label: "Tisková data",
      icon: <Printer className="h-4 w-4" />,
      content: (
        <TabShell title="Tisková data a stavy" subtitle="Schvalování, rozměry, parametry tisku, EAN, vzorky a poznámky">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Stav schválení" error={err.approval_status}>
              <select
                value={form.approval_status}
                onChange={(e) => setField("approval_status", e.target.value)}
                className={inputCls}
              >
                <option value="">— Vyberte —</option>
                {IML_APPROVAL_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                {legacyApprovalStatus && (
                  <option value={legacyApprovalStatus}>{legacyApprovalStatus}</option>
                )}
              </select>
            </Field>
            <Field label="Datum schválení" error={err.approval_date}>
              <input
                type="date"
                value={form.approval_date}
                onChange={(e) => setField("approval_date", e.target.value)}
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
            <Field
              label="Formát"
              error={err.format_width_mm || err.format_height_mm}
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.format_width_mm}
                    onChange={(e) => setField("format_width_mm", e.target.value)}
                    className="w-24 rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="š"
                    aria-label="Šířka v mm"
                  />
                  <span className="text-sm text-gray-500">mm</span>
                </div>
                <span className="text-gray-400">×</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.format_height_mm}
                    onChange={(e) => setField("format_height_mm", e.target.value)}
                    className="w-24 rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="v"
                    aria-label="Výška v mm"
                  />
                  <span className="text-sm text-gray-500">mm</span>
                </div>
              </div>
              {formatPreview && (
                <p className="mt-1.5 text-xs text-gray-500">
                  Náhled: <span className="font-medium text-gray-700">{formatPreview}</span>
                </p>
              )}
            </Field>
            <Field label="Počet barev" error={err.color_count} hint="Informativní pro tiskárnu">
              <select
                value={form.color_count}
                onChange={(e) => setField("color_count", e.target.value)}
                className={inputCls}
              >
                <option value="">— Vyberte —</option>
                {IML_COLOR_COUNT_OPTIONS.map((n) => (
                  <option key={n} value={String(n)}>{n}</option>
                ))}
              </select>
            </Field>
            <Field label="Etiketa" error={err.label_type}>
              <select
                value={form.label_type}
                onChange={(e) => setField("label_type", e.target.value)}
                className={inputCls}
              >
                <option value="">— Vyberte —</option>
                {IML_LABEL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Barvy (souhrn pro tiskárnu)" span={2} error={err.print_colors_text} hint="Volný text, např. CMYK PA365 PA 276. Výpočet spotřeby zůstává na záložce Barvy.">
              <input
                type="text"
                value={form.print_colors_text}
                onChange={(e) => setField("print_colors_text", e.target.value)}
                className={inputCls}
                placeholder="CMYK PA365 PA 276"
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
            <div className="flex flex-col gap-3 sm:pt-7">
              <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="has_print_proof"
                  checked={form.has_print_proof}
                  onChange={(e) => setField("has_print_proof", e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="has_print_proof" className="text-sm font-medium text-gray-700">
                  Máme nátisk
                </label>
              </div>
            </div>
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
  die_cut_tool_code: "",
  assembly_code: "",
  positions_on_sheet: "",
  labels_per_sheet: "",
  pieces_per_box: "",
  pieces_per_pallet: "",
  foil_material_id: "",
  color_material_id: "",
  paper_material_id: "",
  lacquer_material_id: "",
  foil_type: "",
  color_coverage: "",
  print_note: "",
  production_notes: "",
  approval_status: "",
  approval_date: "",
  item_status: "aktivní",
  format_width_mm: "",
  format_height_mm: "",
  color_count: "",
  print_colors_text: "",
  label_type: "",
  ean_code: "",
  has_print_sample: false,
  has_print_proof: false,
  print_data_version: "",
  stock_quantity: "",
  realization_log: "",
  internal_note: "",
};
