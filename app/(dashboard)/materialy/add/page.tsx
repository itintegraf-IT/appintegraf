"use client";

import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MATERIAL_CATEGORIES,
  isMaterialCategoryCode,
  type MaterialCategoryCode,
} from "@/lib/materialy/categories";
import { MaterialyDeferredAttachmentFields } from "../_components/MaterialyAttachmentFields";

type Subcat = { id: number; name: string };

function MaterialAddForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") ?? "FOIL";
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
  }>({
    category_code: isMaterialCategoryCode(initialCategory) ? initialCategory : "FOIL",
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
  });
  const [subs, setSubs] = useState<Subcat[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingDocType, setPendingDocType] = useState("SDS");

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
    };
    const res = await fetch("/api/materialy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Chyba");
      setLoading(false);
      return;
    }
    const created = (data as { material?: { id: number } }).material;
    if (!created?.id) {
      setError("Neočekávaná odpověď serveru.");
      setLoading(false);
      return;
    }
    if (pendingFile) {
      const fd = new FormData();
      fd.append("file", pendingFile);
      fd.append("document_type", pendingDocType);
      const up = await fetch(`/api/materialy/${created.id}/files`, { method: "POST", body: fd });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok) {
        setError(
          typeof upData.error === "string"
            ? `${upData.error} (materiál byl vytvořen, dokument nahrajte na detailu.)`
            : "Materiál byl vytvořen, ale dokument se nepodařilo nahrát — zkuste to na detailu."
        );
        setLoading(false);
        router.push(`/materialy/${created.id}`);
        return;
      }
    }
    router.push(`/materialy/${created.id}`);
  };

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-600">
        Podtypy se načítají podle zvolené kategorie (papír / fólie / barvy / laky se nemíchají). Úpravu nebo skrytí
        záznamu provedete po uložení na{" "}
        <span className="font-medium">detailu materiálu</span> nebo přes odkaz „Upravit“ v seznamu.
      </p>
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
            Pro tuto kategorii zatím nemáte žádný podtyp.{" "}
            <Link href="/materialy/settings" className="text-red-600 hover:underline">
              Přidejte podtyp v nastavení
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

      <MaterialyDeferredAttachmentFields
        docType={pendingDocType}
        onDocTypeChange={setPendingDocType}
        onFileChange={setPendingFile}
      />
      {pendingFile ? (
        <p className="text-xs text-gray-600">
          Vybraný soubor: <span className="font-medium">{pendingFile.name}</span>
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
      >
        {loading ? "Ukládám…" : "Vytvořit"}
      </button>
      <Link href="/materialy" className="ml-3 text-sm text-gray-500 hover:text-red-600">
        Zrušit
      </Link>
    </form>
  );
}

export default function MaterialAddPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Nový materiál</h1>
      <Suspense fallback={<p>Načítání…</p>}>
        <MaterialAddForm />
      </Suspense>
    </>
  );
}
