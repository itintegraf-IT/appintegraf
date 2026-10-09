"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MachineSelectOptions } from "@/components/shared-machines/MachineSelectOptions";

type SheetType = { id: number; name: string };
type PrintMachine = { id: number; name: string; machine_group?: string };

type FormState = {
  code: string;
  name: string;
  sheet_type_id: string;
  format_text: string;
  sheet_size_text: string;
  print_machine_id: string;
  note: string;
};

const emptyForm: FormState = {
  code: "",
  name: "",
  sheet_type_id: "",
  format_text: "",
  sheet_size_text: "",
  print_machine_id: "",
  note: "",
};

export function TechnologieForm({
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
  const [sheetTypes, setSheetTypes] = useState<SheetType[]>([]);
  const [printMachines, setPrintMachines] = useState<PrintMachine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/technologie/sheet-types")
      .then((r) => r.json())
      .then((data: { items?: SheetType[] }) => {
        setSheetTypes(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {});
    fetch("/api/shared-machines")
      .then((r) => r.json())
      .then((data: { machines?: PrintMachine[] }) => {
        setPrintMachines(Array.isArray(data.machines) ? data.machines : []);
      })
      .catch(() => {});
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        code: form.code,
        name: form.name,
        sheet_type_id: form.sheet_type_id || null,
        format_text: form.format_text,
        sheet_size_text: form.sheet_size_text,
        print_machine_id: form.print_machine_id || null,
        note: form.note,
      };
      const url = mode === "create" ? "/api/technologie" : `/api/technologie/${id}`;
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
      router.push(nextId ? `/technologie/${nextId}` : "/technologie");
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
          href={id ? `/technologie/${id}` : "/technologie"}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          {mode === "create" ? "Nový rozkres" : "Upravit rozkres"}
        </h1>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Kód *</span>
          <input
            required
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono"
            maxLength={32}
            placeholder="A48x"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-gray-700">Název *</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            maxLength={255}
            placeholder="8X-A4-l/R"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Typ archu</span>
          <select
            value={form.sheet_type_id}
            onChange={(e) => setForm((f) => ({ ...f, sheet_type_id: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">—</option>
            {sheetTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Tiskový stroj</span>
          <select
            value={form.print_machine_id}
            onChange={(e) => setForm((f) => ({ ...f, print_machine_id: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">—</option>
            <MachineSelectOptions machines={printMachines} />
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Formát</span>
          <input
            value={form.format_text}
            onChange={(e) => setForm((f) => ({ ...f, format_text: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            maxLength={64}
            placeholder="210x297"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Velikost archu</span>
          <input
            value={form.sheet_size_text}
            onChange={(e) => setForm((f) => ({ ...f, sheet_size_text: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            maxLength={64}
            placeholder="1000x700"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">Poznámka</span>
        <textarea
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
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
          href={id ? `/technologie/${id}` : "/technologie"}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Zrušit
        </Link>
      </div>
    </form>
  );
}
