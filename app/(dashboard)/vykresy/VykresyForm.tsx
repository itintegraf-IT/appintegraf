"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  VYKRESY_DOCUMENT_KINDS,
  VYKRESY_DOCUMENT_KIND_LABELS,
  type VykresyDocumentKind,
} from "@/lib/vykresy/constants";

type Department = { id: number; name: string };
type Machine = { id: number; name: string };

type FormState = {
  name: string;
  document_kind: VykresyDocumentKind;
  department_id: string;
  machine_id: string;
  description: string;
};

const emptyForm: FormState = {
  name: "",
  document_kind: "model_3d",
  department_id: "",
  machine_id: "",
  description: "",
};

export function VykresyForm({
  mode,
  id,
  initial,
}: {
  mode: "create" | "edit";
  id?: number;
  initial?: Partial<FormState>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({ ...emptyForm, ...initial });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.departments;
        if (Array.isArray(list)) {
          setDepartments(list.map((d: Department) => ({ id: d.id, name: d.name })));
        }
      })
      .catch(() => {});
    fetch("/api/vykresy/machines")
      .then((r) => r.json())
      .then((data: { machines?: Machine[] }) => {
        setMachines(Array.isArray(data.machines) ? data.machines : []);
      })
      .catch(() => {});
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        name: form.name,
        document_kind: form.document_kind,
        department_id: form.department_id || null,
        machine_id: form.machine_id || null,
        description: form.description,
      };
      const url = mode === "create" ? "/api/vykresy" : `/api/vykresy/${id}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        item?: { id: number };
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Uložení se nezdařilo.");
        return;
      }
      const nextId = data.item?.id ?? id;
      router.push(nextId ? `/vykresy/${nextId}` : "/vykresy");
      router.refresh();
    } catch {
      setError("Chyba při ukládání.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-4">
      <div className="mb-2">
        <Link
          href={id ? `/vykresy/${id}` : "/vykresy"}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          {mode === "create" ? "Nový výkres / model" : "Upravit záznam"}
        </h1>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">Název *</span>
        <input
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
          maxLength={255}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">Typ dokumentu *</span>
        <select
          value={form.document_kind}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              document_kind: e.target.value as VykresyDocumentKind,
            }))
          }
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        >
          {VYKRESY_DOCUMENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {VYKRESY_DOCUMENT_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Oddělení</span>
          <select
            value={form.department_id}
            onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">—</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Stroj</span>
          <select
            value={form.machine_id}
            onChange={(e) => setForm((f) => ({ ...f, machine_id: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">—</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">Popis</span>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={4}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </label>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? "Ukládám…" : "Uložit"}
        </button>
        <Link
          href={id ? `/vykresy/${id}` : "/vykresy"}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Zrušit
        </Link>
      </div>
    </form>
  );
}
