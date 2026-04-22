"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import CustomerFormSections, {
  emptyCustomerForm,
  type CustomerFormErrors,
  type CustomerFormState,
} from "../_components/CustomerFormSections";
import {
  validateCustomerField,
  validateCustomerForm,
} from "../_components/customerValidation";
import {
  ViewToggle,
  useViewMode,
} from "../../_components/ViewToggle";

export default function ImlCustomerAddPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<CustomerFormState>(emptyCustomerForm);
  const [errors, setErrors] = useState<CustomerFormErrors>({});
  const [viewMode, setViewMode] = useViewMode("customerForm");

  const setField = <K extends keyof CustomerFormState>(
    k: K,
    v: CustomerFormState[K]
  ) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  };

  const handleBlur = (field: keyof CustomerFormState) => {
    const err = validateCustomerField(field, form);
    setErrors((prev) => {
      const next = { ...prev };
      if (err) next[field] = err;
      else delete next[field];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const formErrors = validateCustomerForm(form);
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      setError("Opravte prosím chyby ve formuláři.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/iml/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          allow_under_over_delivery_percent: form.allow_under_over_delivery_percent
            ? parseFloat(form.allow_under_over_delivery_percent)
            : null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Chyba při ukládání");
        if (data.field) {
          setErrors((prev) => ({ ...prev, [data.field as keyof CustomerFormState]: data.error }));
        }
        setLoading(false);
        return;
      }

      router.push(`/iml/customers/${data.id}`);
      router.refresh();
    } catch {
      setError("Chyba při ukládání");
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Přidat zákazníka</h1>
          <p className="mt-1 text-gray-600">Nový záznam v evidenci IML</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
          <Link
            href="/iml/customers"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <CustomerFormSections
          form={form}
          setField={setField}
          mode={viewMode}
          errors={errors}
          onBlurField={handleBlur}
        />

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <strong>Doručovací adresy</strong> přidáte po uložení zákazníka v jeho detailu
              v sekci „Doručovací adresy". Zákazník může mít libovolný počet adres, jednu
              označenou jako výchozí.
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Ukládám…" : "Uložit"}
          </button>
          <Link
            href="/iml/customers"
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </Link>
        </div>
      </form>
    </>
  );
}
