"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { MachineSelectOptions } from "@/components/shared-machines/MachineSelectOptions";

type SheetType = { id: number; name: string };
type SheetSize = { id: number; name: string };
type PrintMachine = { id: number; name: string; machine_group?: string };
type DieCutDevice = { id: number; name: string };

export type TechnologieProductFormRow = {
  name: string;
  format_text: string;
  note: string;
};

type FormState = {
  code: string;
  sheet_type_id: string;
  sheet_size_id: string;
  print_machine_id: string;
  die_cut_device_id: string;
  is_iml: boolean;
  products: TechnologieProductFormRow[];
};

const emptyProduct = (): TechnologieProductFormRow => ({
  name: "",
  format_text: "",
  note: "",
});

const emptyForm: FormState = {
  code: "",
  sheet_type_id: "",
  sheet_size_id: "",
  print_machine_id: "",
  die_cut_device_id: "",
  is_iml: false,
  products: [emptyProduct()],
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
  const [form, setForm] = useState<FormState>(() => ({
    ...emptyForm,
    ...initial,
    products:
      initial?.products && initial.products.length > 0
        ? initial.products
        : [emptyProduct()],
  }));
  const [sheetTypes, setSheetTypes] = useState<SheetType[]>([]);
  const [sheetSizes, setSheetSizes] = useState<SheetSize[]>([]);
  const [printMachines, setPrintMachines] = useState<PrintMachine[]>([]);
  const [dieCutDevices, setDieCutDevices] = useState<DieCutDevice[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/technologie/sheet-types")
      .then((r) => r.json())
      .then((data: { items?: SheetType[] }) => {
        setSheetTypes(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {});
    fetch("/api/technologie/sheet-sizes")
      .then((r) => r.json())
      .then((data: { items?: SheetSize[] }) => {
        setSheetSizes(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {});
    fetch("/api/shared-machines")
      .then((r) => r.json())
      .then((data: { machines?: PrintMachine[] }) => {
        setPrintMachines(Array.isArray(data.machines) ? data.machines : []);
      })
      .catch(() => {});
    fetch("/api/technologie/die-cut-devices")
      .then((r) => r.json())
      .then((data: { items?: DieCutDevice[] }) => {
        setDieCutDevices(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {});
  }, []);

  const updateProduct = (
    index: number,
    patch: Partial<TechnologieProductFormRow>
  ) => {
    setForm((f) => ({
      ...f,
      products: f.products.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
  };

  const addProduct = () => {
    setForm((f) => ({ ...f, products: [...f.products, emptyProduct()] }));
  };

  const removeProduct = (index: number) => {
    setForm((f) => {
      if (f.products.length <= 1) return f;
      return { ...f, products: f.products.filter((_, i) => i !== index) };
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const products = form.products
        .map((p) => ({
          name: p.name.trim(),
          format_text: p.format_text.trim(),
          note: p.note.trim(),
        }))
        .filter((p) => p.name.length > 0);
      if (products.length === 0) {
        setError("Přidejte alespoň jeden produkt s názvem.");
        setSaving(false);
        return;
      }
      const body = {
        code: form.code,
        sheet_type_id: form.sheet_type_id || null,
        sheet_size_id: form.sheet_size_id || null,
        print_machine_id: form.print_machine_id || null,
        die_cut_device_id: form.die_cut_device_id || null,
        is_iml: form.is_iml,
        products,
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
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-4">
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

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">Společná technologie</h2>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Kód *</span>
          <input
            required
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 font-mono"
            maxLength={32}
            placeholder="A48x"
          />
        </label>

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
              onChange={(e) =>
                setForm((f) => ({ ...f, print_machine_id: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">—</option>
              <MachineSelectOptions machines={printMachines} />
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Velikost archu</span>
            <select
              value={form.sheet_size_id}
              onChange={(e) => setForm((f) => ({ ...f, sheet_size_id: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">—</option>
              {sheetSizes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Výsekové zařízení</span>
            <select
              value={form.die_cut_device_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, die_cut_device_id: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">—</option>
              {dieCutDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex items-start gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            checked={form.is_iml}
            onChange={(e) => setForm((f) => ({ ...f, is_iml: e.target.checked }))}
            className="mt-0.5 h-4 w-4 rounded border-gray-300"
          />
          <span>
            <span className="font-medium">Technologie IML</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              Označí rozkres jako technologii pro IML výrobu.
            </span>
          </span>
        </label>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Produkty na archu</h2>
            <p className="text-xs text-gray-500">
              U jednoho kódu můžete zadat více názvů s vlastním formátem a poznámkou (počet
              kusů).
            </p>
          </div>
          <button
            type="button"
            onClick={addProduct}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            Přidat řádek
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="pb-2 pr-2">Název *</th>
                <th className="pb-2 pr-2">Formát</th>
                <th className="pb-2 pr-2">Poznámka (ks na archu)</th>
                <th className="pb-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {form.products.map((p, index) => (
                <tr key={index} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-2">
                    <input
                      value={p.name}
                      onChange={(e) => updateProduct(index, { name: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5"
                      maxLength={255}
                      placeholder="112-IML-OBV"
                      required={index === 0}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      value={p.format_text}
                      onChange={(e) =>
                        updateProduct(index, { format_text: e.target.value })
                      }
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5"
                      maxLength={64}
                      placeholder="489 × 155,1"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      value={p.note}
                      onChange={(e) => updateProduct(index, { note: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5"
                      placeholder="56x na archu"
                    />
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => removeProduct(index)}
                      disabled={form.products.length <= 1}
                      className="rounded border border-gray-200 p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-30"
                      title="Odebrat řádek"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
