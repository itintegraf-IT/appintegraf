"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProductFilesUpload } from "../../_components/ProductFilesUpload";
import { CustomFieldsFormSection } from "../../../_components/CustomFieldsFormSection";
import { IML_ITEM_STATUSES, imlItemStatusLabel } from "@/lib/iml-constants";

type Customer = { id: number; name: string };
type Product = Record<string, string | number | boolean | null | undefined>;

export default function ImlProductEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [customData, setCustomData] = useState<Record<string, string | number | boolean>>({});
  const [hasImage, setHasImage] = useState(false);
  const [hasPdf, setHasPdf] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/iml/customers").then((r) => r.json()),
      fetch(`/api/iml/products/${id}`).then((r) => r.json()),
    ]).then(([custData, prodData]: [{ customers?: Customer[] }, Product]) => {
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
          label_shape_code: String(p.label_shape_code ?? ""),
          product_format: String(p.product_format ?? ""),
          die_cut_tool_code: String(p.die_cut_tool_code ?? ""),
          assembly_code: String(p.assembly_code ?? ""),
          positions_on_sheet: p.positions_on_sheet != null ? String(p.positions_on_sheet) : "",
          pieces_per_box: p.pieces_per_box != null ? String(p.pieces_per_box) : "",
          pieces_per_pallet: p.pieces_per_pallet != null ? String(p.pieces_per_pallet) : "",
          foil_type: String(p.foil_type ?? ""),
          color_coverage: String(p.color_coverage ?? ""),
          print_note: String(p.print_note ?? ""),
          has_print_sample: !!p.has_print_sample,
          ean_code: String(p.ean_code ?? ""),
          production_notes: String(p.production_notes ?? ""),
          approval_status: String(p.approval_status ?? ""),
          realization_log: String(p.realization_log ?? ""),
          internal_note: String(p.internal_note ?? ""),
          item_status: String(p.item_status ?? "aktivní"),
          print_data_version: String(p.print_data_version ?? ""),
          stock_quantity: p.stock_quantity != null ? String(p.stock_quantity) : "",
          sku: String(p.sku ?? ""),
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
    }).catch(() => setError("Chyba při načítání"))
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
          customer_id: form.customer_id ? parseInt(String(form.customer_id), 10) : null,
          positions_on_sheet: form.positions_on_sheet ? parseInt(String(form.positions_on_sheet), 10) : null,
          pieces_per_box: form.pieces_per_box ? parseInt(String(form.pieces_per_box), 10) : null,
          pieces_per_pallet: form.pieces_per_pallet ? parseInt(String(form.pieces_per_pallet), 10) : null,
          stock_quantity: form.stock_quantity ? parseInt(String(form.stock_quantity), 10) : null,
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

  if (loadingData || Object.keys(form).length === 0) {
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
          <p className="mt-1 text-gray-600">{form.client_name || form.ig_short_name || form.ig_code || "Produkt"}</p>
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
          onImageChange={() => setHasImage(true)}
          onPdfChange={() => setHasPdf(true)}
        />

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Identifikace</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Zákazník</label>
                <select
                  value={String(form.customer_id ?? "")}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">— Vyberte —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Kód IG</label>
                <input
                  type="text"
                  value={String(form.ig_code ?? "")}
                  onChange={(e) => setForm({ ...form, ig_code: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Zkrácený název (IG)</label>
                <input
                  type="text"
                  value={String(form.ig_short_name ?? "")}
                  onChange={(e) => setForm({ ...form, ig_short_name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Kód u klienta</label>
                <input
                  type="text"
                  value={String(form.client_code ?? "")}
                  onChange={(e) => setForm({ ...form, client_code: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Název u klienta</label>
                <input
                  type="text"
                  value={String(form.client_name ?? "")}
                  onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Zadavatel</label>
                <input
                  type="text"
                  value={String(form.requester ?? "")}
                  onChange={(e) => setForm({ ...form, requester: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">SKU</label>
                <input
                  type="text"
                  value={String(form.sku ?? "")}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Výseky a montáže</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Kód tvaru etikety</label>
                <input
                  type="text"
                  value={String(form.label_shape_code ?? "")}
                  onChange={(e) => setForm({ ...form, label_shape_code: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Rozměr / formát</label>
                <input
                  type="text"
                  value={String(form.product_format ?? "")}
                  onChange={(e) => setForm({ ...form, product_format: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Kód výsekového nástroje</label>
                <input
                  type="text"
                  value={String(form.die_cut_tool_code ?? "")}
                  onChange={(e) => setForm({ ...form, die_cut_tool_code: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Kód montáže</label>
                <input
                  type="text"
                  value={String(form.assembly_code ?? "")}
                  onChange={(e) => setForm({ ...form, assembly_code: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Pozic na archu</label>
                <input
                  type="number"
                  value={String(form.positions_on_sheet ?? "")}
                  onChange={(e) => setForm({ ...form, positions_on_sheet: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Kusů v krabici</label>
                <input
                  type="number"
                  value={String(form.pieces_per_box ?? "")}
                  onChange={(e) => setForm({ ...form, pieces_per_box: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Kusů na paletě</label>
                <input
                  type="number"
                  value={String(form.pieces_per_pallet ?? "")}
                  onChange={(e) => setForm({ ...form, pieces_per_pallet: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Materiály a tisk</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Druh fólie</label>
                <input
                  type="text"
                  value={String(form.foil_type ?? "")}
                  onChange={(e) => setForm({ ...form, foil_type: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Barevnost / pokrytí</label>
                <input
                  type="text"
                  value={String(form.color_coverage ?? "")}
                  onChange={(e) => setForm({ ...form, color_coverage: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">EAN kód</label>
                <input
                  type="text"
                  value={String(form.ean_code ?? "")}
                  onChange={(e) => setForm({ ...form, ean_code: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="has_print_sample"
                  checked={!!form.has_print_sample}
                  onChange={(e) => setForm({ ...form, has_print_sample: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="has_print_sample" className="text-sm font-medium text-gray-700">
                  Máme vzor min. tisku
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Poznámka k tisku</label>
                <textarea
                  value={String(form.print_note ?? "")}
                  onChange={(e) => setForm({ ...form, print_note: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Výrobní poznámky</label>
                <textarea
                  value={String(form.production_notes ?? "")}
                  onChange={(e) => setForm({ ...form, production_notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Schvalování a metadata</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Stav schválení</label>
                <input
                  type="text"
                  value={String(form.approval_status ?? "")}
                  onChange={(e) => setForm({ ...form, approval_status: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Stav položky</label>
                <select
                  value={String(form.item_status ?? "aktivní")}
                  onChange={(e) => setForm({ ...form, item_status: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  {IML_ITEM_STATUSES.map((s) => (
                    <option key={s} value={s}>{imlItemStatusLabel(s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Verze tiskových dat</label>
                <input
                  type="text"
                  value={String(form.print_data_version ?? "")}
                  onChange={(e) => setForm({ ...form, print_data_version: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Skladem</label>
                <input
                  type="number"
                  value={String(form.stock_quantity ?? "")}
                  onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">LOG realizací</label>
                <textarea
                  value={String(form.realization_log ?? "")}
                  onChange={(e) => setForm({ ...form, realization_log: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Interní poznámka</label>
                <textarea
                  value={String(form.internal_note ?? "")}
                  onChange={(e) => setForm({ ...form, internal_note: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
            </div>
          </div>
          </div>
        </div>

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
