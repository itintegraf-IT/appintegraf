"use client";

import { Building2, FileText, User, Wrench } from "lucide-react";
import { Tabs, type TabDef } from "../../_components/Tabs";
import { SectionShell, type ViewMode } from "../../_components/ViewToggle";

export type CustomerFormState = {
  name: string;
  email: string;
  phone: string;
  contact_person: string;
  billing_company: string;
  ico: string;
  dic: string;
  billing_address: string;
  city: string;
  postal_code: string;
  country: string;
  label_requirements: string;
  pallet_packaging: string;
  prepress_notes: string;
  allow_under_over_delivery_percent: string;
  individual_requirements: string;
  customer_note: string;
};

type Props = {
  form: CustomerFormState;
  setField: <K extends keyof CustomerFormState>(k: K, v: CustomerFormState[K]) => void;
  mode: ViewMode;
};

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2";

/**
 * Obsah formuláře pro zákazníka, použitelný jak v režimu "sekce pod sebou",
 * tak v režimu záložek. V režimu záložek se nadpisy sekcí stávají labely tabů.
 */
export default function CustomerFormSections({ form, setField, mode }: Props) {
  const sections: Array<{
    id: string;
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    content: React.ReactNode;
  }> = [
    {
      id: "identification",
      title: "Identifikace",
      subtitle: "Kontaktní údaje a obchodní jméno zákazníka",
      icon: <User className="h-4 w-4" />,
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Název zákazníka *" span={2}>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="E-mail">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Telefon">
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Kontaktní osoba" span={2}>
            <input
              type="text"
              value={form.contact_person}
              onChange={(e) => setField("contact_person", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      ),
    },
    {
      id: "billing",
      title: "Fakturační údaje",
      subtitle: "Údaje pro vystavení faktury (IČO, DIČ, fakturační adresa)",
      icon: <Building2 className="h-4 w-4" />,
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fakturační název firmy" span={2}>
            <input
              type="text"
              value={form.billing_company}
              onChange={(e) => setField("billing_company", e.target.value)}
              placeholder="Pokud se liší od názvu zákazníka"
              className={inputCls}
            />
          </Field>
          <Field label="IČO">
            <input
              type="text"
              value={form.ico}
              onChange={(e) => setField("ico", e.target.value.replace(/[^\d\s]/g, ""))}
              placeholder="12345678"
              inputMode="numeric"
              className={inputCls}
            />
          </Field>
          <Field label="DIČ">
            <input
              type="text"
              value={form.dic}
              onChange={(e) => setField("dic", e.target.value)}
              placeholder="CZ12345678"
              className={inputCls}
            />
          </Field>
          <Field label="Fakturační adresa (ulice, č. p.)" span={2}>
            <textarea
              value={form.billing_address}
              onChange={(e) => setField("billing_address", e.target.value)}
              rows={2}
              className={inputCls}
            />
          </Field>
          <Field label="Město">
            <input
              type="text"
              value={form.city}
              onChange={(e) => setField("city", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="PSČ">
            <input
              type="text"
              value={form.postal_code}
              onChange={(e) => setField("postal_code", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Země" span={2}>
            <input
              type="text"
              value={form.country}
              onChange={(e) => setField("country", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      ),
    },
    {
      id: "individual",
      title: "Individuální požadavky",
      subtitle: "Zákaznické standardy platné pro všechny jeho produkty a objednávky",
      icon: <Wrench className="h-4 w-4" />,
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Požadavky na etikety" span={2}>
            <textarea
              value={form.label_requirements}
              onChange={(e) => setField("label_requirements", e.target.value)}
              rows={2}
              placeholder="Rozměry, orientace, barevnost, potisk…"
              className={inputCls}
            />
          </Field>
          <Field label="Palety / balení" span={2}>
            <textarea
              value={form.pallet_packaging}
              onChange={(e) => setField("pallet_packaging", e.target.value)}
              rows={2}
              placeholder="Typ palety, počet ks na paletu, fixace, stretch…"
              className={inputCls}
            />
          </Field>
          <Field label="Poznámky k pre-pressu" span={2}>
            <textarea
              value={form.prepress_notes}
              onChange={(e) => setField("prepress_notes", e.target.value)}
              rows={2}
              placeholder="Profily, oříznutí, spadávky, podkladové barvy…"
              className={inputCls}
            />
          </Field>
        </div>
      ),
    },
    {
      id: "other",
      title: "Ostatní",
      subtitle: "Tolerance dodávek, obecná poznámka",
      icon: <FileText className="h-4 w-4" />,
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="% tolerance pod-/nadnákladu">
            <input
              type="number"
              step="0.01"
              value={form.allow_under_over_delivery_percent}
              onChange={(e) =>
                setField("allow_under_over_delivery_percent", e.target.value)
              }
              className={inputCls}
            />
          </Field>
          <Field label="Obecná poznámka" span={2}>
            <textarea
              value={form.customer_note}
              onChange={(e) => setField("customer_note", e.target.value)}
              rows={2}
              className={inputCls}
            />
          </Field>
          <Field label="Individuální požadavky (legacy)" span={2}>
            <textarea
              value={form.individual_requirements}
              onChange={(e) => setField("individual_requirements", e.target.value)}
              rows={2}
              placeholder="Zachováno pro zpětnou kompatibilitu – preferujte strukturovaná pole výše"
              className={inputCls}
            />
          </Field>
        </div>
      ),
    },
  ];

  if (mode === "tabs") {
    const tabs: TabDef[] = sections.map((s) => ({
      id: s.id,
      label: s.title,
      icon: s.icon,
      content: (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {s.subtitle && (
            <p className="mb-4 border-b border-gray-100 pb-3 text-sm text-gray-500">
              {s.subtitle}
            </p>
          )}
          {s.content}
        </div>
      ),
    }));
    return <Tabs tabs={tabs} storageKey="customerForm" />;
  }

  return (
    <div className="space-y-6">
      {sections.map((s) => (
        <SectionShell
          key={s.id}
          title={s.title}
          subtitle={s.subtitle}
          mode={mode}
        >
          {s.content}
        </SectionShell>
      ))}
    </div>
  );
}

function Field({
  label,
  span = 1,
  children,
}: {
  label: string;
  span?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <div className={span === 2 ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

export const emptyCustomerForm: CustomerFormState = {
  name: "",
  email: "",
  phone: "",
  contact_person: "",
  billing_company: "",
  ico: "",
  dic: "",
  billing_address: "",
  city: "",
  postal_code: "",
  country: "Česká republika",
  label_requirements: "",
  pallet_packaging: "",
  prepress_notes: "",
  allow_under_over_delivery_percent: "",
  individual_requirements: "",
  customer_note: "",
};
