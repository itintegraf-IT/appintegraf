"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import CustomerFormSections, {
  emptyCustomerForm,
  type CustomerFormErrors,
  type CustomerFormState,
} from "./CustomerFormSections";
import CustomerEmailsEditor, { type CustomerEmailRow } from "./CustomerEmailsEditor";
import CustomerContactsEditor, { type CustomerContactRow } from "./CustomerContactsEditor";
import CustomerHeadquartersToggle from "./CustomerHeadquartersToggle";
import CustomerShippingAddressesDraft from "./CustomerShippingAddressesDraft";
import CustomerBranchesDraftCard, {
  validateAllBranches,
} from "./CustomerBranchesDraftCard";
import {
  validateCustomerField,
  validateCustomerForm,
} from "./customerValidation";
import { ViewToggle, useViewMode } from "../../_components/ViewToggle";
import {
  type CustomerFormExtendedDraft,
  draftShippingFromApi,
  emptyCustomerFormExtendedDraft,
  validateDraftShippingList,
} from "@/lib/iml-customer-form-draft";
import { mapApiBranchToDraft } from "@/lib/iml-customer-persist";

type Mode = "create" | "edit";

type CustomerApi = {
  id: number;
  name: string;
  unit_type: string;
  parent_id: number | null;
  parent?: { id: number; name: string } | null;
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
  iml_customer_shipping_addresses?: Array<{
    id: number;
    label: string | null;
    recipient: string | null;
    street: string | null;
    city: string | null;
    postal_code: string | null;
    country: string | null;
    is_default: boolean;
    label_requirements: string | null;
    pallet_packaging: string | null;
    prepress_notes: string | null;
    expedition_note?: string | null;
  }>;
  branches?: Array<Parameters<typeof mapApiBranchToDraft>[0]>;
};

type Props = {
  mode: Mode;
  customerId?: string;
};

function buildSubmitPayload(
  form: CustomerFormState,
  emailRows: CustomerEmailRow[],
  contactRows: CustomerContactRow[],
  draft: CustomerFormExtendedDraft,
  legacyShippingAddress: string | null
) {
  const taxCountry = form.tax_country === "OTHER" ? null : form.tax_country || null;
  return {
    ...form,
    tax_country: taxCountry,
    allow_under_over_delivery_percent: form.allow_under_over_delivery_percent
      ? parseFloat(form.allow_under_over_delivery_percent)
      : null,
    shipping_address: legacyShippingAddress,
    is_headquarters: draft.isHeadquarters,
    sync_emails: true,
    emails: emailRows.filter((r) => r.email.trim()),
    sync_contacts: true,
    contacts: contactRows.filter((r) => r.name.trim()),
    shipping_addresses: draft.shipping_addresses,
    branches: draft.isHeadquarters
      ? draft.branches.map((b) => ({
          id: b.id,
          tempId: b.tempId,
          name: b.name,
          email: b.email,
          phone: b.phone,
          contact_person: b.contact_person,
          tax_country: b.tax_country === "OTHER" ? null : b.tax_country,
          billing_company: b.billing_company,
          ico: b.ico,
          dic: b.dic,
          billing_address: b.billing_address,
          city: b.city,
          postal_code: b.postal_code,
          country: b.country,
          label_requirements: b.label_requirements,
          pallet_packaging: b.pallet_packaging,
          prepress_notes: b.prepress_notes,
          allow_under_over_delivery_percent: b.allow_under_over_delivery_percent
            ? parseFloat(b.allow_under_over_delivery_percent)
            : null,
          individual_requirements: b.individual_requirements,
          customer_note: b.customer_note,
          emails: b.emails.filter((r) => r.email.trim()),
          contacts: b.contacts.filter((r) => r.name.trim()),
          shipping_addresses: b.shipping_addresses,
        }))
      : [],
  };
}

export default function CustomerFormWizard({ mode, customerId }: Props) {
  const router = useRouter();
  const isEdit = mode === "edit" && Boolean(customerId);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [error, setError] = useState("");
  const [form, setForm] = useState<CustomerFormState>(emptyCustomerForm);
  const [emailRows, setEmailRows] = useState<CustomerEmailRow[]>([]);
  const [contactRows, setContactRows] = useState<CustomerContactRow[]>([]);
  const [draft, setDraft] = useState<CustomerFormExtendedDraft>(emptyCustomerFormExtendedDraft());
  const [legacyShippingAddress, setLegacyShippingAddress] = useState<string | null>(null);
  const [errors, setErrors] = useState<CustomerFormErrors>({});
  const [viewMode, setViewMode] = useViewMode("customerForm");
  const [unitType, setUnitType] = useState<string>("standalone");
  const [parentId, setParentId] = useState<number | null>(null);
  const [parentName, setParentName] = useState<string | null>(null);
  const [parentHqId, setParentHqId] = useState<number | null>(null);
  const [branchFieldErrors, setBranchFieldErrors] = useState<
    Record<string, CustomerFormErrors>
  >({});
  const [branchShippingErrors, setBranchShippingErrors] = useState<Record<string, string>>({});

  const setField = <K extends keyof CustomerFormState>(k: K, v: CustomerFormState[K]) => {
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

  const loadCustomer = useCallback(async () => {
    if (!customerId) return;
    setLoadingData(true);
    try {
      const res = await fetch(`/api/iml/customers/${customerId}`);
      const data: CustomerApi = await res.json();
      if (!data?.id) {
        setError("Zákazník nenalezen");
        return;
      }
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
      setUnitType(data.unit_type ?? "standalone");
      setParentId(data.parent_id ?? null);
      setParentName(data.parent?.name ?? null);
      setParentHqId(data.parent?.id ?? null);
      const hasBranches = (data.branches?.length ?? 0) > 0;
      setDraft({
        isHeadquarters: data.unit_type === "headquarters" || hasBranches,
        shipping_addresses: (data.iml_customer_shipping_addresses ?? []).map((a) =>
          draftShippingFromApi(a)
        ),
        branches: (data.branches ?? []).map((b) => mapApiBranchToDraft(b)),
      });
    } catch {
      setError("Chyba při načítání");
    } finally {
      setLoadingData(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (isEdit) loadCustomer();
  }, [isEdit, loadCustomer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const formErrors = validateCustomerForm(form);
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      setError("Opravte prosím chyby ve formuláři.");
      return;
    }

    setBranchFieldErrors({});
    setBranchShippingErrors({});

    const shipErr = validateDraftShippingList(draft.shipping_addresses, "Zákazník");
    if (shipErr) {
      setError(shipErr);
      return;
    }

    if (draft.isHeadquarters) {
      const branchValidation = validateAllBranches(draft.branches);
      if (!branchValidation.ok) {
        setBranchFieldErrors(branchValidation.branchErrors);
        setBranchShippingErrors(branchValidation.shippingErrors);
        setError(branchValidation.message ?? "Opravte chyby u poboček.");
        return;
      }
    }

    setLoading(true);
    const payload = buildSubmitPayload(form, emailRows, contactRows, draft, legacyShippingAddress);

    try {
      const url = isEdit ? `/api/iml/customers/${customerId}` : "/api/iml/customers";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

      const targetId = isEdit ? customerId : String(data.id);
      router.push(`/iml/customers/${targetId}`);
      router.refresh();
    } catch {
      setError("Chyba při ukládání");
      setLoading(false);
    }
  };

  const backHref = isEdit ? `/iml/customers/${customerId}` : "/iml/customers";
  const title = isEdit ? "Upravit zákazníka" : "Přidat zákazníka";
  const isRootCustomer = parentId == null;
  const hqUncheckLocked = draft.isHeadquarters && draft.branches.length > 0;
  const showConvertHint =
    isRootCustomer &&
    draft.isHeadquarters &&
    unitType === "standalone" &&
    draft.branches.length === 0;

  const headquartersToggle = isRootCustomer ? (
    <CustomerHeadquartersToggle
      variant="inline"
      checked={draft.isHeadquarters}
      uncheckLocked={hqUncheckLocked}
      showConvertHint={showConvertHint}
      onChange={(checked) =>
        setDraft((d) => ({
          ...d,
          isHeadquarters: checked,
          branches: checked ? d.branches : [],
        }))
      }
    />
  ) : null;

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
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="mt-1 text-gray-600">
            {isEdit ? form.name || "Zákazník" : "Nový záznam v evidenci IML"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
          <Link
            href={backHref}
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

        {!isRootCustomer && parentHqId != null && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            Toto je <strong>pobočka</strong> skupiny
            {parentName ? (
              <>
                {" "}
                pod centrálou{" "}
                <Link href={`/iml/customers/${parentHqId}/edit`} className="font-medium text-red-700 hover:underline">
                  {parentName}
                </Link>
              </>
            ) : null}
            . Centrálu a pobočky spravujte u centrály skupiny.
          </div>
        )}

        <CustomerFormSections
          form={form}
          setField={setField}
          mode={viewMode}
          errors={errors}
          onBlurField={handleBlur}
          identificationExtra={headquartersToggle}
        />

        <CustomerShippingAddressesDraft
          addresses={draft.shipping_addresses}
          onChange={(shipping_addresses) => setDraft((d) => ({ ...d, shipping_addresses }))}
          title="Doručovací adresy zákazníka"
          showSaveHint
        />

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">E-maily</h2>
          <CustomerEmailsEditor rows={emailRows} onChange={setEmailRows} />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Kontaktní osoby</h2>
          <CustomerContactsEditor rows={contactRows} onChange={setContactRows} />
        </div>

        {draft.isHeadquarters && (
          <CustomerBranchesDraftCard
            branches={draft.branches}
            onChange={(branches) => {
              setDraft((d) => ({ ...d, branches }));
              setBranchFieldErrors({});
              setBranchShippingErrors({});
            }}
            viewMode={viewMode}
            externalFieldErrors={branchFieldErrors}
            externalShippingErrors={branchShippingErrors}
          />
        )}

        {legacyShippingAddress && legacyShippingAddress.trim() !== "" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="flex-1">
                <strong>Legacy pole „Doručovací adresa":</strong> Staré jednořádkové pole zůstává
                v databázi; spravujte adresy v kartě výše.
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
            href={backHref}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </Link>
        </div>
      </form>
    </>
  );
}
