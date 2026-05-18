"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MATERIAL_CATEGORIES,
  isMaterialCategoryCode,
  type MaterialCategoryCode,
} from "@/lib/materialy/categories";

type Subcat = { id: number; name: string };

function toDateInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function MaterialEditForm({ materialId }: { materialId: number }) {
  const router = useRouter();
  const [loadError, setLoadError] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [form, setForm] = useState<{
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
  } | null>(null);

  const [subs, setSubs] = useState<Subcat[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
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
            category_code: isMaterialCategoryCode(cat) ? cat : "FOIL",
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

  useEffect(() => {
    if (!form) return;
    let cancelled = false;
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
  }, [form?.category_code]);

  if (loadingData) return <p className="text-sm text-gray-500">Načítání…</p>;
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!form) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (subs.length > 0 && !form.subcategory_id) {
      setError("Vyberte podtyp materiálu.");
      setLoading(false);
      return;
    }
    const body: Record<string, unknown> = {
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
    const res = await fetch(`/api/materialy/${materialId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
    <form onSubmit={submit} className="max-w-lg space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <label className="mb-1 block text-sm font-medium">Kategorie</label>
        <select
          value={form.category_code}
          onChange={(e) => {
            const v = e.target.value;
            if (!isMaterialCategoryCode(v)) return;
            setForm({
              ...form,
              category_code: v,
              subcategory_id: "",
            });
          }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        >
          {MATERIAL_CATEGORIES.map((c: (typeof MATERIAL_CATEGORIES)[number]) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Podtyp materiálu{subs.length > 0 ? " *" : ""}
        </label>
        {subsLoading ? (
          <p className="text-sm text-gray-500">Načítání podtypů…</p>
        ) : subs.length === 0 ? (
          <p className="text-sm text-gray-600">
            Žádný podtyp —{" "}
            <Link href="/materialy/settings" className="text-red-600 hover:underline">
              nastavení podtypů
            </Link>
            .
          </p>
        ) : (
          <select
            required={subs.length > 0}
            value={form.subcategory_id}
            onChange={(e) => setForm({ ...form, subcategory_id: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">— vyberte podtyp —</option>
            {subs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Název *</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Kód</label>
        <input
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Výrobce</label>
        <input
          value={form.manufacturer}
          onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Dodavatel</label>
        <input
          value={form.supplier}
          onChange={(e) => setForm({ ...form, supplier: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Popis</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Číslo CAS</label>
        <input
          value={form.cas_number}
          onChange={(e) => setForm({ ...form, cas_number: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Poznámky</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Platnost BL / SDS</label>
          <input
            type="date"
            value={form.valid_until}
            onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Platnost certifikátu</label>
          <input
            type="date"
            value={form.certificate_valid_until}
            onChange={(e) => setForm({ ...form, certificate_valid_until: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="mat-active"
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          className="rounded border-gray-300"
        />
        <label htmlFor="mat-active" className="text-sm">
          Aktivní v katalogu (zobrazen ve výběrech)
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
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
