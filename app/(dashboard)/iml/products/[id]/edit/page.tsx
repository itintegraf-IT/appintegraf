"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { BackLink } from "@/components/navigation/BackLink";
import { useReturnTo } from "@/lib/navigation/use-return-to";
import { ProductFilesUpload } from "../../_components/ProductFilesUpload";
import { CustomFieldsFormSection } from "../../../_components/CustomFieldsFormSection";
import ProductFormSections, {
  emptyProductForm,
  type ProductFormState,
  type CustomerOption,
} from "../../_components/ProductFormSections";
import type { ProductColorRow } from "../../_components/ProductPantoneEditor";
import {
  cmykFlagsFromProduct,
  cmykFlagsToDb,
  defaultProductCmykFlags,
  type ProductCmykFlags,
} from "@/lib/iml-print-colors-summary";
import { parseProductFormatToMm } from "@/lib/iml/product-format";

type ProductColorResp = {
  id: number;
  pantone_id: number;
  coverage_pct: string | number;
  sort_order: number;
  iml_pantone_colors?: {
    id: number;
    code: string;
    name: string | null;
    hex: string | null;
  } | null;
};

type Product = Record<string, unknown>;

export default function ImlProductEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { withPreservedReturnTo } = useReturnTo(`/iml/products/${id}`);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ProductFormState>(emptyProductForm);
  const [customData, setCustomData] = useState<Record<string, string | number | boolean>>({});
  const [colors, setColors] = useState<ProductColorRow[]>([]);
  const [cmykFlags, setCmykFlags] = useState<ProductCmykFlags>(defaultProductCmykFlags);
  const [hasImage, setHasImage] = useState(false);
  const [hasPdf, setHasPdf] = useState(false);

  const setField = <K extends keyof ProductFormState>(k: K, v: ProductFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    Promise.all([
      fetch("/api/iml/customers").then((r) => r.json()),
      fetch(`/api/iml/products/${id}`).then((r) => r.json()),
    ])
      .then(([custData, prodData]: [{ customers?: CustomerOption[] }, Product]) => {
        setCustomers(custData.customers ?? []);
        const p = prodData as Record<string, unknown>;
        if (p?.id) {
          const s = (k: string) => (p[k] != null ? String(p[k]) : "");
          const si = (k: string) => (p[k] != null ? String(p[k] as number) : "");
          const sd = (k: string) => {
            const v = p[k];
            if (v == null || v === "") return "";
            const d = new Date(String(v));
            return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
          };
          let formatWidth = si("format_width_mm");
          let formatHeight = si("format_height_mm");
          if (!formatWidth && !formatHeight && p.product_format) {
            const parsed = parseProductFormatToMm(String(p.product_format));
            if (parsed) {
              formatWidth = String(parsed.width);
              formatHeight = String(parsed.height);
            }
          }
          setForm({
            customer_id: si("customer_id"),
            ig_code: s("ig_code"),
            ig_short_name: s("ig_short_name"),
            client_code: s("client_code"),
            client_name: s("client_name"),
            requester: s("requester"),
            sku: s("sku"),
            label_shape_code: s("label_shape_code"),
            die_cut_tool_code: s("die_cut_tool_code"),
            assembly_code: s("assembly_code"),
            positions_on_sheet: si("positions_on_sheet"),
            labels_per_sheet: si("labels_per_sheet"),
            pieces_per_box: si("pieces_per_box"),
            pieces_per_pallet: si("pieces_per_pallet"),
            foil_material_id: si("foil_material_id"),
            color_material_id: si("color_material_id"),
            paper_material_id: si("paper_material_id"),
            lacquer_material_id: si("lacquer_material_id"),
            foil_type: s("foil_type"),
            color_coverage: s("color_coverage"),
            print_note: s("print_note"),
            production_notes: s("production_notes"),
            approval_status: s("approval_status"),
            approval_date: sd("approval_date"),
            item_status: s("item_status") || "aktivní",
            format_width_mm: formatWidth,
            format_height_mm: formatHeight,
            color_count: si("color_count"),
            print_colors_text: s("print_colors_text"),
            label_type: s("label_type"),
            ean_code: s("ean_code"),
            has_print_sample: !!p.has_print_sample,
            has_print_proof: !!p.has_print_proof,
            print_data_version: s("print_data_version"),
            stock_quantity: si("stock_quantity"),
            realization_log: s("realization_log"),
            internal_note: s("internal_note"),
          });
          setHasImage(!!p.has_image);
          setHasPdf(!!p.has_pdf);
          if (Array.isArray(p.iml_product_colors)) {
            const rows: ProductColorRow[] = (p.iml_product_colors as ProductColorResp[]).map((r, i) => ({
              pantone_id: r.pantone_id,
              code: r.iml_pantone_colors?.code ?? "",
              name: r.iml_pantone_colors?.name ?? null,
              hex: r.iml_pantone_colors?.hex ?? null,
              coverage_pct: String(r.coverage_pct),
              sort_order: r.sort_order ?? i,
            }));
            setColors(rows);
          }
          setCmykFlags(
            cmykFlagsFromProduct({
              cmyk_c_enabled: p.cmyk_c_enabled as boolean | undefined,
              cmyk_m_enabled: p.cmyk_m_enabled as boolean | undefined,
              cmyk_y_enabled: p.cmyk_y_enabled as boolean | undefined,
              cmyk_k_enabled: p.cmyk_k_enabled as boolean | undefined,
            })
          );
          if (p.custom_data && typeof p.custom_data === "object") {
            const cd = p.custom_data as Record<string, unknown>;
            const init: Record<string, string | number | boolean> = {};
            for (const [k, v] of Object.entries(cd)) {
              if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") init[k] = v;
            }
            setCustomData(init);
          }
        }
      })
      .catch(() => setError("Chyba při načítání"))
      .finally(() => setLoadingData(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const invalidIdx = colors.findIndex((c) => {
      const hasCode = c.code.trim() !== "";
      const hasCoverage = c.coverage_pct !== "" && Number.isFinite(parseFloat(c.coverage_pct));
      const isNonEmpty = hasCode || hasCoverage;
      return isNonEmpty && !(hasCode && hasCoverage);
    });
    if (invalidIdx >= 0) {
      const row = colors[invalidIdx];
      const missing: string[] = [];
      if (!row.code.trim()) missing.push("kód");
      if (row.coverage_pct === "" || !Number.isFinite(parseFloat(row.coverage_pct)))
        missing.push("pokrytí");
      setError(
        `Záložka Barvy: řádek ${invalidIdx + 1} – doplňte ${missing.join(" a ")}, ` +
          "nebo řádek odeberte."
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/iml/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          customer_id: form.customer_id ? parseInt(form.customer_id, 10) : null,
          foil_material_id: form.foil_material_id ? parseInt(form.foil_material_id, 10) : null,
          color_material_id: form.color_material_id ? parseInt(form.color_material_id, 10) : null,
          paper_material_id: form.paper_material_id ? parseInt(form.paper_material_id, 10) : null,
          lacquer_material_id: form.lacquer_material_id ? parseInt(form.lacquer_material_id, 10) : null,
          positions_on_sheet: form.positions_on_sheet ? parseInt(form.positions_on_sheet, 10) : null,
          labels_per_sheet: form.labels_per_sheet ? parseInt(form.labels_per_sheet, 10) : null,
          pieces_per_box: form.pieces_per_box ? parseInt(form.pieces_per_box, 10) : null,
          pieces_per_pallet: form.pieces_per_pallet ? parseInt(form.pieces_per_pallet, 10) : null,
          stock_quantity: form.stock_quantity ? parseInt(form.stock_quantity, 10) : null,
          custom_data: Object.keys(customData).length > 0 ? customData : null,
          ...cmykFlagsToDb(cmykFlags),
          colors: colors
            .filter(
              (c) =>
                c.code.trim() !== "" &&
                c.coverage_pct !== "" &&
                Number.isFinite(parseFloat(c.coverage_pct))
            )
            .map((c, i) => ({
              pantone_id: c.pantone_id,
              code: c.code,
              coverage_pct: parseFloat(c.coverage_pct),
              sort_order: c.sort_order ?? i,
            })),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Chyba při ukládání");
        setLoading(false);
        return;
      }

      router.push(`/iml/products/${id}`);
      router.refresh();
    } catch {
      setError("Chyba při ukládání");
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Načítání…</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upravit produkt</h1>
          <p className="mt-1 text-gray-600">{form.ig_code || form.ig_short_name || "Produkt"}</p>
        </div>
        <BackLink fallbackHref={`/iml/products/${id}`} />
      </div>

      <div className="space-y-6">
        <ProductFilesUpload
          productId={parseInt(id, 10)}
          hasImage={hasImage}
          hasPdf={hasPdf}
        />

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <ProductFormSections
            form={form}
            setField={setField}
            customers={customers}
            colors={colors}
            onColorsChange={setColors}
            cmykFlags={cmykFlags}
            onCmykChange={setCmykFlags}
          />

          <CustomFieldsFormSection
            entity="products"
            values={customData}
            onChange={setCustomData}
          />

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Ukládám…" : "Uložit"}
            </button>
            <Link
              href={withPreservedReturnTo(`/iml/products/${id}`)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Zrušit
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
