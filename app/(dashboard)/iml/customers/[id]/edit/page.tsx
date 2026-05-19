"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import CustomerFormSections, {
  emptyCustomerForm,
  type CustomerFormErrors,
  type CustomerFormState,
} from "../../_components/CustomerFormSections";
import CustomerEmailsEditor, {
  type CustomerEmailRow,
} from "../../_components/CustomerEmailsEditor";
import CustomerContactsEditor, {
  type CustomerContactRow,
} from "../../_components/CustomerContactsEditor";
import {
  validateCustomerField,
  validateCustomerForm,
} from "../../_components/customerValidation";
import {
  ViewToggle,
  useViewMode,
} from "../../../_components/ViewToggle";

type CustomerApi = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  tax_country: string | null;
  allow_under_over_delivery_percent: number | null;
  customer_note: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  individual_requirements: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  billing_company: string | null;
  ico: string | null;
  dic: string | null;
  label_requirements: string | null;
  pallet_packaging: string | null;
  prepress_notes: string | null;
  iml_customer_emails?: Array<{
    email: string;
    kind: string;
    is_primary: boolean;
    sort_order: number;
  }>;
  iml_customer_contacts?: Array<{
    name: string;
    phone: string | null;
    email: string | null;
    role: string | null;
    is_primary: boolean;
    sort_order: number;
  }>;
};

export default function ImlCustomerEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [legacyShippingAddress, setLegacyShippingAddress] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerFormState>(emptyCustomerForm);
  const [emailRows, setEmailRows] = useState<CustomerEmailRow[]>([]);
  const [contactRows, setContactRows] = useState<CustomerContactRow[]>([]);
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

  useEffect(() => {
    fetch(`/api/iml/customers/${id}`)
      .then((r) => r.json())
      .then((data: CustomerApi) => {
        if (data?.id) {
          setForm({
            name: data.name ?? "",
            email: data.email ?? "",
            phone: data.phone ?? "",
            contact_person: data.contact_person ?? "",
            tax_country: data.tax_country ?? "CZ",
            billing_company: data.billing_company ?? "",
            ico: data.ico ?? "",
            dic: data.dic ?? "",
            billing_address: data.billing_address ?? "",
            city: data.city ?? "",
            postal_code: data.postal_code ?? "",
            country: data.country ?? "Česká republika",
            label_requirements: data.label_requirements ?? "",
            pallet_packaging: data.pallet_packaging ?? "",
            prepress_notes: data.prepress_notes ?? "",
            allow_under_over_delivery_percent:
              data.allow_under_over_delivery_percent != null
                ? String(data.allow_under_over_delivery_percent)
                : "",
            individual_requirements: data.individual_requirements ?? "",
            customer_note: data.customer_note ?? "",
          });
          setEmailRows(
            (data.iml_customer_emails ?? []).map((e) => ({
              email: e.email,
              kind: e.kind,
              is_primary: e.is_primary,
              sort_order: e.sort_order,
            }))
          );
          setContactRows(
            (data.iml_customer_contacts ?? []).map((c) => ({
              name: c.name,
              phone: c.phone ?? "",
              email: c.email ?? "",
              role: c.role ?? "",
              is_primary: c.is_primary,
              sort_order: c.sort_order,
            }))
          );
          setLegacyShippingAddress(data.shipping_address);
        }
      })
      .catch(() => setError("Chyba při načítání"))
      .finally(() => setLoadingData(false));
  }, [id]);

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

    const taxCountry =
      form.tax_country === "OTHER" ? null : form.tax_country || null;

    try {
      const res = await fetch(`/api/iml/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tax_country: taxCountry,
          allow_under_over_delivery_percent: form.allow_under_over_delivery_percent
            ? parseFloat(form.allow_under_over_delivery_percent)
            : null,
          shipping_address: legacyShippingAddress,
          sync_emails: true,
          emails: emailRows.filter((r) => r.email.trim()),
          sync_contacts: true,
          contacts: contactRows.filter((r) => r.name.trim()),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Chyba při ukládání");
        if (data.field) {
          setErrors((prev) => ({
            ...prev,
            [data.field as keyof CustomerFormState]: data.error,
          }));
        }
        setLoading(false);
        return;
      }

      router.push(`/iml/customers/${id}`);
      router.refresh();
    } catch {
      setError("Chyba při ukládání");
      setLoading(false);
    }
  };

  if (loadingData) {
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
          <h1 className="text-2xl font-bold text-gray-900">Upravit zákazníka</h1>
          <p className="mt-1 text-gray-600">{form.name || "Zákazník"}</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
          <Link
            href={`/iml/customers/${id}`}
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

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">E-maily</h2>
          <CustomerEmailsEditor rows={emailRows} onChange={setEmailRows} />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Kontaktní osoby</h2>
          <CustomerContactsEditor rows={contactRows} onChange={setContactRows} />
        </div>

        {legacyShippingAddress && legacyShippingAddress.trim() !== "" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="flex-1">
                <strong>Legacy pole „Doručovací adresa":</strong> Tento zákazník má
                vyplněné staré jednořádkové pole. Spravujte adresy v detailu zákazníka.
                <div className="mt-1 whitespace-pre-wrap rounded border border-amber-200 bg-white px-2 py-1 text-xs text-gray-700">
                  {legacyShippingAddress}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Ukládám…" : "Uložit"}
          </button>
          <Link
            href={`/iml/customers/${id}`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </Link>
        </div>
      </form>
    </>
  );
}
