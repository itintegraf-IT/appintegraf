"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Mail, MapPin, User, Users, X } from "lucide-react";
import { Tabs, type TabDef } from "../../_components/Tabs";
import CustomerFormSections, {
  emptyCustomerForm,
  type CustomerFormErrors,
  type CustomerFormState,
} from "./CustomerFormSections";
import CustomerEmailsEditor, {
  type CustomerEmailRow,
} from "./CustomerEmailsEditor";
import CustomerContactsEditor, {
  type CustomerContactRow,
} from "./CustomerContactsEditor";
import CustomerShippingAddresses from "./CustomerShippingAddresses";
import {
  validateBranchForm,
  validateCustomerField,
} from "./customerValidation";

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  onClose: () => void;
  headquartersId: number;
  branchId?: number | null;
  mode: Mode;
  onSaved?: () => void;
};

type CustomerApi = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  tax_country: string | null;
  billing_company: string | null;
  ico: string | null;
  dic: string | null;
  billing_address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
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

function buildPayload(
  form: CustomerFormState,
  emailRows: CustomerEmailRow[],
  contactRows: CustomerContactRow[]
) {
  const taxCountry = form.tax_country === "OTHER" ? null : form.tax_country || null;
  return {
    ...form,
    tax_country: taxCountry,
    emails: emailRows.filter((r) => r.email.trim()),
    contacts: contactRows.filter((r) => r.name.trim()),
  };
}

export default function CustomerBranchModal({
  open,
  onClose,
  headquartersId,
  branchId: initialBranchId,
  mode,
  onSaved,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<CustomerFormState>(emptyCustomerForm);
  const [emailRows, setEmailRows] = useState<CustomerEmailRow[]>([]);
  const [contactRows, setContactRows] = useState<CustomerContactRow[]>([]);
  const [errors, setErrors] = useState<CustomerFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [savedBranchId, setSavedBranchId] = useState<number | null>(initialBranchId ?? null);
  const [phase, setPhase] = useState<"form" | "shipping">("form");

  const isEdit = mode === "edit" && initialBranchId != null;
  const branchId = savedBranchId ?? initialBranchId ?? null;
  const canShowShipping = branchId != null;

  const resetForm = useCallback(() => {
    setForm(emptyCustomerForm);
    setEmailRows([]);
    setContactRows([]);
    setErrors({});
    setError(null);
    setSavedBranchId(initialBranchId ?? null);
    setPhase("form");
  }, [initialBranchId]);

  useEffect(() => {
    if (!open) return;
    if (isEdit && initialBranchId) {
      setLoadingData(true);
      fetch(`/api/iml/customers/${initialBranchId}`)
        .then((r) => r.json())
        .then((data: CustomerApi) => {
          if (!data?.id) return;
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
            label_requirements: "",
            pallet_packaging: "",
            prepress_notes: "",
            allow_under_over_delivery_percent: "",
            individual_requirements: "",
            customer_note: "",
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
          setSavedBranchId(data.id);
        })
        .catch(() => setError("Chyba při načítání pobočky"))
        .finally(() => setLoadingData(false));
    } else {
      resetForm();
    }
  }, [open, isEdit, initialBranchId, resetForm]);

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

  const handleSave = async () => {
    setError(null);
    const formErrors = validateBranchForm(form);
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      setError("Opravte prosím chyby ve formuláři.");
      return;
    }

    setLoading(true);
    const payload = buildPayload(form, emailRows, contactRows);

    try {
      if (isEdit && branchId) {
        const res = await fetch(`/api/iml/customers/${branchId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            sync_emails: true,
            sync_contacts: true,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Chyba při ukládání");
        onSaved?.();
      } else {
        const res = await fetch(`/api/iml/customers/${headquartersId}/branches`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Chyba při vytváření pobočky");
        setSavedBranchId(data.id);
        setPhase("shipping");
        onSaved?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    resetForm();
    onClose();
    router.refresh();
  };

  if (!open) return null;

  const formTabs: TabDef[] = [
    {
      id: "identification",
      label: "Identifikace",
      icon: <User className="h-4 w-4" />,
      content: (
        <CustomerFormSections
          form={form}
          setField={setField}
          mode="sections"
          errors={errors}
          onBlurField={handleBlur}
          visibleSections={["identification"]}
          branchMode
          compact
          nameLabel="Název pobočky *"
        />
      ),
    },
    {
      id: "billing",
      label: "Adresa / fakturace",
      icon: <Building2 className="h-4 w-4" />,
      content: (
        <CustomerFormSections
          form={form}
          setField={setField}
          mode="sections"
          errors={errors}
          onBlurField={handleBlur}
          visibleSections={["billing"]}
          branchMode
          compact
        />
      ),
    },
    {
      id: "emails",
      label: "E-maily",
      icon: <Mail className="h-4 w-4" />,
      content: <CustomerEmailsEditor rows={emailRows} onChange={setEmailRows} />,
    },
    {
      id: "contacts",
      label: "Kontakty",
      icon: <Users className="h-4 w-4" />,
      content: <CustomerContactsEditor rows={contactRows} onChange={setContactRows} />,
    },
    {
      id: "shipping",
      label: "Doručovací adresy",
      icon: <MapPin className="h-4 w-4" />,
      hidden: !canShowShipping,
      content: canShowShipping ? (
        <div>
          <p className="mb-3 text-sm text-gray-500">
            Doručovací adresy vázané na tuto pobočku. Použijí se při objednávkách s touto jednotkou.
          </p>
          <CustomerShippingAddresses customerId={branchId!} embedded />
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Nejdříve uložte pobočku – poté zde přidáte doručovací adresy.
        </p>
      ),
    },
  ];

  const title = isEdit
    ? `Upravit pobočku${form.name ? `: ${form.name}` : ""}`
    : phase === "shipping" && form.name
      ? `Pobočka „${form.name}" – doručovací adresy`
      : "Nová pobočka";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Zavřít"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {loadingData ? (
            <p className="py-8 text-center text-gray-500">Načítání…</p>
          ) : phase === "shipping" && canShowShipping ? (
            <div>
              <p className="mb-4 text-sm text-gray-600">
                Pobočka byla uložena. Přidejte doručovací adresy nebo zavřete okno tlačítkem Hotovo.
              </p>
              <CustomerShippingAddresses customerId={branchId!} embedded />
            </div>
          ) : (
            <Tabs tabs={formTabs} defaultId="identification" storageKey="branchModal" />
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </button>
          {phase === "shipping" && canShowShipping ? (
            <button
              type="button"
              onClick={handleDone}
              className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
            >
              Hotovo
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleSave}
              className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Ukládám…" : isEdit ? "Uložit" : "Vytvořit pobočku"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
