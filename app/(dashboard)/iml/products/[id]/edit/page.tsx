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
} from "../../_components/ProductFormSections";

type Product = Record<string, string | number | boolean | null | undefined>;

export default function ImlProductEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ProductFormState>(emptyProductForm);
  const [customData, setCustomData] = useState<Record<string, string | number | boolean>>({});
  const [hasImage, setHasImage] = useState(false);
  const [hasPdf, setHasPdf] = useState(false);

  const setField = <K extends keyof ProductFormState>(
    k: K,
    v: ProductFormState[K]
  ) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    Promise.all([
      fetch("/api/iml/customers").then((r) => r.json()),
      fetch(`/api/iml/products/${id}`).then((r) => r.json()),
    ])
      .then(([custData, prodData]: [{ customers?: CustomerOption[] }, Product]) => {
        setCustomers(custData.customers ?? []);
        const p = prodData;
        if (p?.id) {
          setForm({
            customer_id: p.customer_id != null ? String(p.customer_id) : "",
            ig_code: String(p.ig_code ?? ""),
            ig_short_name: String(p.ig_short_name ?? ""),
            client_code: String(p.client_code ?? ""),
            client_name: String(p.client_name ?? ""),
            requester: String(p.requester ?? ""),
            sku: String(p.sku ?? ""),
            label_shape_code: String(p.label_shape_code ?? ""),
            product_format: String(p.product_format ?? ""),
            die_cut_tool_code: String(p.die_cut_tool_code ?? ""),
            assembly_code: String(p.assembly_code ?? ""),
            positions_on_sheet: p.positions_on_sheet != null ? String(p.positions_on_sheet) : "",
            pieces_per_box: p.pieces_per_box != null ? String(p.pieces_per_box) : "",
            pieces_per_pallet: p.pieces_per_pallet != null ? String(p.pieces_per_pallet) : "",
            foil_type: String(p.foil_type ?? ""),
            color_coverage: String(p.color_coverage ?? ""),
            ean_code: String(p.ean_code ?? ""),
            has_print_sample: !!p.has_print_sample,
            print_note: String(p.print_note ?? ""),
            production_notes: String(p.production_notes ?? ""),
            approval_status: String(p.approval_status ?? ""),
            item_status: String(p.item_status ?? "aktivní"),
            print_data_version: String(p.print_data_version ?? ""),
            stock_quantity: p.stock_quantity != null ? String(p.stock_quantity) : "",
            realization_log: String(p.realization_log ?? ""),
            internal_note: String(p.internal_note ?? ""),
          });
          setHasImage(!!p.has_image);
          setHasPdf(!!p.has_pdf);
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
          positions_on_sheet: form.positions_on_sheet ? parseInt(form.positions_on_sheet, 10) : null,
          pieces_per_box: form.pieces_per_box ? parseInt(form.pieces_per_box, 10) : null,
          pieces_per_pallet: form.pieces_per_pallet ? parseInt(form.pieces_per_pallet, 10) : null,
          stock_quantity: form.stock_quantity ? parseInt(form.stock_quantity, 10) : null,
          custom_data: Object.keys(customData).length > 0 ? customData : null,
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
