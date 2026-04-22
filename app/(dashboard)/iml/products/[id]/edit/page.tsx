"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProductFilesUpload } from "../../_components/ProductFilesUpload";
import { CustomFieldsFormSection } from "../../../_components/CustomFieldsFormSection";
import ProductFormSections, {
  emptyProductForm,
  type ProductFormState,
  type CustomerOption,
  type FoilOption,
} from "../../_components/ProductFormSections";
import type { ProductColorRow } from "../../_components/ProductPantoneEditor";

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
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [foils, setFoils] = useState<FoilOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ProductFormState>(emptyProductForm);
  const [customData, setCustomData] = useState<Record<string, string | number | boolean>>({});
  const [colors, setColors] = useState<ProductColorRow[]>([]);
  const [hasImage, setHasImage] = useState(false);
  const [hasPdf, setHasPdf] = useState(false);

  const setField = <K extends keyof ProductFormState>(
    k: K,
    v: ProductFormState[K]
  ) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    Promise.all([
      fetch("/api/iml/customers").then((r) => r.json()),
      fetch("/api/iml/foils").then((r) => r.json()),
      fetch(`/api/iml/products/${id}`).then((r) => r.json()),
    ])
      .then(([custData, foilData, prodData]: [
        { customers?: CustomerOption[] },
        { foils?: FoilOption[] },
        Product
      ]) => {
        setCustomers(custData.customers ?? []);
        setFoils(foilData.foils ?? []);
        const p = prodData as Record<string, unknown>;
        if (p?.id) {
          const s = (k: string) => (p[k] != null ? String(p[k]) : "");
          const si = (k: string) => (p[k] != null ? String(p[k] as number) : "");
          setForm({
            customer_id: si("customer_id"),
            ig_code: s("ig_code"),
            ig_short_name: s("ig_short_name"),
            client_code: s("client_code"),
            client_name: s("client_name"),
            requester: s("requester"),
            sku: s("sku"),
            label_shape_code: s("label_shape_code"),
            product_format: s("product_format"),
            die_cut_tool_code: s("die_cut_tool_code"),
            assembly_code: s("assembly_code"),
            positions_on_sheet: si("positions_on_sheet"),
            labels_per_sheet: si("labels_per_sheet"),
            pieces_per_box: si("pieces_per_box"),
            pieces_per_pallet: si("pieces_per_pallet"),
            foil_id: si("foil_id"),
            foil_type: s("foil_type"),
            color_coverage: s("color_coverage"),
            ean_code: s("ean_code"),
            has_print_sample: !!p.has_print_sample,
            print_note: s("print_note"),
            production_notes: s("production_notes"),
            approval_status: s("approval_status"),
            item_status: s("item_status") || "aktivní",
            print_data_version: s("print_data_version"),
            stock_quantity: si("stock_quantity"),
            realization_log: s("realization_log"),
            internal_note: s("internal_note"),
          });
          setHasImage(!!p.has_image);
          setHasPdf(!!p.has_pdf);
          if (Array.isArray(p.iml_product_colors)) {
            const rows: ProductColorRow[] = (p.iml_product_colors as ProductColorResp[]).map(
              (r, i) => ({
                pantone_id: r.pantone_id,
                code: r.iml_pantone_colors?.code ?? "",
                name: r.iml_pantone_colors?.name ?? null,
                hex: r.iml_pantone_colors?.hex ?? null,
                coverage_pct: String(r.coverage_pct),
                sort_order: r.sort_order ?? i,
              })
            );
            setColors(rows);
          }
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
    setLoading(true);

    try {
      const res = await fetch(`/api/iml/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          customer_id: form.customer_id ? parseInt(form.customer_id, 10) : null,
          foil_id: form.foil_id ? parseInt(form.foil_id, 10) : null,
          positions_on_sheet: form.positions_on_sheet ? parseInt(form.positions_on_sheet, 10) : null,
          labels_per_sheet: form.labels_per_sheet ? parseInt(form.labels_per_sheet, 10) : null,
          pieces_per_box: form.pieces_per_box ? parseInt(form.pieces_per_box, 10) : null,
          pieces_per_pallet: form.pieces_per_pallet ? parseInt(form.pieces_per_pallet, 10) : null,
          stock_quantity: form.stock_quantity ? parseInt(form.stock_quantity, 10) : null,
          custom_data: Object.keys(customData).length > 0 ? customData : null,
          colors: colors
            .filter((c) => c.code && c.coverage_pct !== "")
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
        <Link
          href={`/iml/products/${id}`}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <ProductFilesUpload
          productId={parseInt(id, 10)}
          hasImage={hasImage}
          hasPdf={hasPdf}
        />

        <ProductFormSections
          form={form}
          setField={setField}
          customers={customers}
          foils={foils}
          colors={colors}
          onColorsChange={setColors}
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
            href={`/iml/products/${id}`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </Link>
        </div>
      </form>
    </>
  );
}
