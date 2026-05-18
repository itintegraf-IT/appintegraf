"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  MATERIAL_CATEGORIES,
  isMaterialCategoryCode,
  type MaterialCategoryCode,
} from "@/lib/materialy/categories";
import { MaterialyDeferredAttachmentFields } from "./MaterialyAttachmentFields";

const inputCls =
  "w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400";

export type MaterialFormValues = {
  category_code: MaterialCategoryCode;
  subcategory_id: string;
  name: string;
  code: string;
  manufacturer: string;
  supplier: string;
  description: string;
  cas_number: string;
  notes: string;
  valid_until: string;
  certificate_valid_until: string;
  is_active: boolean;
};

export const emptyMaterialFormValues = (
  category: MaterialCategoryCode = "PAPER"
): MaterialFormValues => ({
  category_code: category,
  subcategory_id: "",
  name: "",
  code: "",
  manufacturer: "",
  supplier: "",
  description: "",
  cas_number: "",
  notes: "",
  valid_until: "",
  certificate_valid_until: "",
  is_active: true,
});

type Subcat = { id: number; name: string };

type Props = {
  form: MaterialFormValues;
  setForm: (next: MaterialFormValues) => void;
  mode: "create" | "edit";
  error?: string;
  pendingDocType?: string;
  onPendingDocTypeChange?: (v: string) => void;
  onPendingFileChange?: (f: File | null) => void;
  pendingFileName?: string | null;
};

export function MaterialFormFields({
  form,
  setForm,
  mode,
  error,
  pendingDocType,
  onPendingDocTypeChange,
  onPendingFileChange,
  pendingFileName,
}: Props) {
  const [subs, setSubs] = useState<Subcat[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSubs([]);
    setSubsLoading(true);
    void (async () => {
      try {
        const r = await fetch(`/api/materialy/subcategories?category=${form.category_code}`);
        const d = (await r.json().catch(() => ({}))) as { subcategories?: Subcat[] };
        if (!cancelled) setSubs(r.ok && Array.isArray(d.subcategories) ? d.subcategories : []);
      } catch {
        if (!cancelled) setSubs([]);
      } finally {
        if (!cancelled) setSubsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.category_code]);

  const patch = (partial: Partial<MaterialFormValues>) => setForm({ ...form, ...partial });

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {mode === "create" ? (
        <p className="text-xs text-gray-500">
          Povinné jsou kategorie, podtyp (pokud existuje) a název. Ostatní pole jsou volitelná.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-0.5 block text-xs font-medium text-gray-600">Kategorie *</label>
          <select
            value={form.category_code}
            onChange={(e) => {
              const v = e.target.value;
              if (!isMaterialCategoryCode(v)) return;
              patch({ category_code: v, subcategory_id: "" });
            }}
            className={inputCls}
          >
            {MATERIAL_CATEGORIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-0.5 block text-xs font-medium text-gray-600">
            Podtyp{subs.length > 0 ? " *" : ""}
          </label>
          {subsLoading ? (
            <p className="py-1.5 text-xs text-gray-400">Načítání…</p>
          ) : subs.length === 0 ? (
            <p className="py-1 text-xs text-gray-500">
              <Link href="/materialy/settings" className="text-red-600 hover:underline">
                Nastavení podtypů
              </Link>
            </p>
          ) : (
            <select
              required={subs.length > 0}
              value={form.subcategory_id}
              onChange={(e) => patch({ subcategory_id: e.target.value })}
              className={inputCls}
            >
              <option value="">— vyberte —</option>
              {subs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="mb-0.5 block text-xs font-medium text-gray-600">Název *</label>
          <input
            required
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-0.5 block text-xs font-medium text-gray-600">Kód</label>
          <input value={form.code} onChange={(e) => patch({ code: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="mb-0.5 block text-xs font-medium text-gray-600">Výrobce</label>
          <input
            value={form.manufacturer}
            onChange={(e) => patch({ manufacturer: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-0.5 block text-xs font-medium text-gray-600">Dodavatel</label>
          <input
            value={form.supplier}
            onChange={(e) => patch({ supplier: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>

      <details className="rounded-lg border border-gray-200 bg-gray-50/60 open:bg-white">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-700">
          Podrobnosti a dokumenty <span className="font-normal text-gray-400">(volitelné)</span>
        </summary>
        <div className="space-y-3 border-t border-gray-100 px-3 pb-3 pt-2">
          <div>
            <label className="mb-0.5 block text-xs font-medium text-gray-600">Popis</label>
            <textarea
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={2}
              className={inputCls}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-0.5 block text-xs font-medium text-gray-600">Číslo CAS</label>
              <input
                value={form.cas_number}
                onChange={(e) => patch({ cas_number: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs font-medium text-gray-600">Platnost BL / SDS</label>
              <input
                type="date"
                value={form.valid_until}
                onChange={(e) => patch({ valid_until: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs font-medium text-gray-600">Platnost certifikátu</label>
              <input
                type="date"
                value={form.certificate_valid_until}
                onChange={(e) => patch({ certificate_valid_until: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="mb-0.5 block text-xs font-medium text-gray-600">Poznámky</label>
            <textarea
              value={form.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              rows={2}
              className={inputCls}
            />
          </div>

          {mode === "create" && pendingDocType != null && onPendingDocTypeChange && onPendingFileChange ? (
            <div>
              <MaterialyDeferredAttachmentFields
                compact
                docType={pendingDocType}
                onDocTypeChange={onPendingDocTypeChange}
                onFileChange={onPendingFileChange}
              />
              {pendingFileName ? (
                <p className="mt-1 text-xs text-gray-500">
                  Soubor: <span className="font-medium">{pendingFileName}</span>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </details>

      {mode === "edit" ? (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => patch({ is_active: e.target.checked })}
            className="rounded border-gray-300"
          />
          Aktivní v katalogu
        </label>
      ) : null}
    </div>
  );
}
