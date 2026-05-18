"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isMaterialCategoryCode } from "@/lib/materialy/categories";
import {
  MaterialFormFields,
  emptyMaterialFormValues,
  type MaterialFormValues,
} from "./MaterialFormFields";

function toDateInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function materialPayload(form: MaterialFormValues): Record<string, unknown> {
  return {
    category_code: form.category_code,
    subcategory_id: form.subcategory_id ? parseInt(form.subcategory_id, 10) : null,
    name: form.name.trim(),
    code: form.code.trim() || null,
    manufacturer: form.manufacturer.trim() || null,
    supplier: form.supplier.trim() || null,
    description: form.description.trim() || null,
    cas_number: form.cas_number.trim() || null,
    notes: form.notes.trim() || null,
    valid_until: form.valid_until || null,
    certificate_valid_until: form.certificate_valid_until || null,
    is_active: form.is_active,
  };
}

export function MaterialEditForm({ materialId }: { materialId: number }) {
  const router = useRouter();
  const [loadError, setLoadError] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [form, setForm] = useState<MaterialFormValues | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingData(true);
    setLoadError("");
    void (async () => {
      try {
        const r = await fetch(`/api/materialy/${materialId}`);
        const d = (await r.json().catch(() => ({}))) as { material?: Record<string, unknown>; error?: string };
        if (!r.ok) {
          if (!cancelled) setLoadError(typeof d.error === "string" ? d.error : "Nelze načíst materiál.");
          return;
        }
        const m = d.material;
        if (!m || typeof m !== "object") {
          if (!cancelled) setLoadError("Materiál nenalezen.");
          return;
        }
        const cat = String(m.category_code ?? "FOIL");
        if (!cancelled) {
          setForm({
            ...emptyMaterialFormValues(isMaterialCategoryCode(cat) ? cat : "FOIL"),
            subcategory_id:
              m.subcategory_id != null && m.subcategory_id !== "" ? String(m.subcategory_id) : "",
            name: String(m.name ?? ""),
            code: String(m.code ?? ""),
            manufacturer: String(m.manufacturer ?? ""),
            supplier: String(m.supplier ?? ""),
            description: String(m.description ?? ""),
            cas_number: String(m.cas_number ?? ""),
            notes: String(m.notes ?? ""),
            valid_until: toDateInputValue(m.valid_until as string | undefined),
            certificate_valid_until: toDateInputValue(m.certificate_valid_until as string | undefined),
            is_active: m.is_active !== false,
          });
        }
      } catch {
        if (!cancelled) setLoadError("Chyba při načítání.");
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [materialId]);

  if (loadingData) return <p className="text-sm text-gray-500">Načítání…</p>;
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!form) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch(`/api/materialy/${materialId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(materialPayload(form)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Chyba při ukládání");
      setLoading(false);
      return;
    }
    router.push(`/materialy/${materialId}`);
    router.refresh();
  };

  return (
    <form
      onSubmit={submit}
      className="max-w-4xl rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <MaterialFormFields form={form} setForm={setForm} mode="edit" error={error} />

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "Ukládám…" : "Uložit změny"}
        </button>
        <Link href={`/materialy/${materialId}`} className="text-sm text-gray-500 hover:text-red-600">
          Zrušit
        </Link>
      </div>
    </form>
  );
}
