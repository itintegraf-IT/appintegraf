"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductFilesUpload } from "../_components/ProductFilesUpload";
import { ProductFilesUploadPlaceholder } from "../_components/ProductFilesUploadPlaceholder";
import { CustomFieldsFormSection } from "../../_components/CustomFieldsFormSection";
import ProductFormSections, {
  emptyProductForm,
  type ProductFormState,
  type CustomerOption,
} from "../_components/ProductFormSections";

export default function ImlProductAddPage() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdProductId, setCreatedProductId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyProductForm);
  const [customData, setCustomData] = useState<Record<string, string | number | boolean>>({});

  const setField = <K extends keyof ProductFormState>(
    k: K,
    v: ProductFormState[K]
  ) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch("/api/iml/customers")
      .then((r) => r.json())
      .then((data) => setCustomers(data.customers ?? []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/iml/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          customer_id: form.customer_id ? parseInt(form.customer_id, 10) : null,
          positions_on_sheet: form.positions_on_sheet ? parseInt(form.positions_on_sheet, 10) : null,
          pieces_per_box: form.pieces_per_box ? parseInt(form.pieces_per_box, 10) : null,
          pieces_per_pallet: form.pieces_per_pallet ? parseInt(form.pieces_per_pallet, 10) : null,
          stock_quantity: form.stock_quantity ? parseInt(form.stock_quantity, 10) : null,
          custom_data: Object.keys(customData).length > 0 ? customData : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Chyba při ukládání");
        setLoading(false);
        return;
      }

      setCreatedProductId(data.id);
    } catch {
      setError("Chyba při ukládání");
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Přidat produkt</h1>
          <p className="mt-1 text-gray-600">Nový produkt do katalogu IML</p>
        </div>
        <Link
          href="/iml/products"
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

        {createdProductId ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="mb-4 font-medium text-green-800">Produkt byl vytvořen. Níže můžete nahrát obrázek a PDF.</p>
            <ProductFilesUpload
              productId={createdProductId}
              hasImage={false}
              hasPdf={false}
            />
            <div className="mt-4 flex gap-2">
              <Link
                href={`/iml/products/${createdProductId}`}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
              >
                Zobrazit produkt
              </Link>
              <Link
                href={`/iml/products/${createdProductId}/edit`}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Upravit produkt
              </Link>
              <Link
                href="/iml/products/add"
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Přidat další
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ProductFilesUploadPlaceholder />

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
                href="/iml/products"
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Zrušit
              </Link>
            </div>
          </>
        )}
      </form>
    </>
  );
}
