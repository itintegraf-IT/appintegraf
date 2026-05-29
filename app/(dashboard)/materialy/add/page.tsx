"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MaterialFormFields,
  emptyMaterialFormValues,
  type MaterialFormValues,
} from "../_components/MaterialFormFields";
import type { PendingMaterialAttachment } from "../_components/MaterialyAttachmentFields";
import { MATERIALY_MAX_BYTES } from "@/lib/materialy/upload";

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
    issued_at: form.issued_at || null,
    valid_until: form.valid_until || null,
  };
}

function MaterialAddForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") ?? "PAPER";
  const [form, setForm] = useState<MaterialFormValues>(() => emptyMaterialFormValues(initialCategory || "PAPER"));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingMaterialAttachment[]>([]);
  const [defaultAttachmentTypeForNew, setDefaultAttachmentTypeForNew] = useState("SDS");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/materialy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(materialPayload(form)),
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

    if (pendingAttachments.length === 0) {
      setLoading(false);
      router.push(`/materialy/${created.id}`);
      return;
    }

    let ok = 0;
    const errs: string[] = [];
    for (const row of pendingAttachments) {
      const file = row.file;
      if (file.size > MATERIALY_MAX_BYTES) {
        errs.push(`${file.name}: větší než 20 MB`);
        continue;
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("document_type", row.documentType);
      const up = await fetch(`/api/materialy/${created.id}/files`, { method: "POST", body: fd });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok) {
        errs.push(
          `${file.name}: ${typeof upData.error === "string" ? upData.error : "chyba nahrání"}`
        );
      } else {
        ok += 1;
      }
    }

    if (errs.length > 0 && ok === 0) {
      setLoading(false);
      router.push(`/materialy/${created.id}?nahrano=0&nahrChyb=${errs.length}`);
      return;
    }

    const q = new URLSearchParams();
    if (ok > 0) q.set("nahrano", String(ok));
    if (errs.length > 0) q.set("nahrChyb", String(errs.length));

    setLoading(false);
    router.push(`/materialy/${created.id}${q.toString() ? `?${q}` : ""}`);
  };

  return (
    <form
      onSubmit={submit}
      className="max-w-4xl rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <MaterialFormFields
        form={form}
        setForm={setForm}
        mode="create"
        error={error}
        pendingAttachments={pendingAttachments}
        onPendingAttachmentsChange={setPendingAttachments}
        defaultAttachmentTypeForNew={defaultAttachmentTypeForNew}
        onDefaultAttachmentTypeForNewChange={setDefaultAttachmentTypeForNew}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "Ukládám…" : "Vytvořit"}
        </button>
        <Link href="/materialy" className="text-sm text-gray-500 hover:text-red-600">
          Zrušit
        </Link>
      </div>
    </form>
  );
}

export default function MaterialAddPage() {
  return (
    <>
      <h1 className="mb-3 text-2xl font-bold">Nový materiál</h1>
      <Suspense fallback={<p className="text-sm text-gray-500">Načítání…</p>}>
        <MaterialAddForm />
      </Suspense>
    </>
  );
}
