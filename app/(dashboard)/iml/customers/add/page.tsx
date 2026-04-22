"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";

export default function ImlCustomerAddPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
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
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Přidat zákazníka</h1>
          <p className="mt-1 text-gray-600">Nový záznam v evidenci IML</p>
        </div>
        <Link
          href="/iml/customers"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 1) Identifikace */}
        <Section title="Identifikace" subtitle="Kontaktní údaje a obchodní jméno zákazníka">
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
        </Section>

        {/* 2) Fakturační údaje */}
        <Section
          title="Fakturační údaje"
          subtitle="Údaje pro vystavení faktury (IČO, DIČ, fakturační adresa)"
        >
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
        </Section>

        {/* 3) Individuální požadavky */}
        <Section
          title="Individuální požadavky"
          subtitle="Zákaznické standardy platné pro všechny jeho produkty a objednávky"
        >
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
        </Section>

        {/* 4) Ostatní */}
        <Section title="Ostatní" subtitle="Tolerance dodávek, obecná poznámka">
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
        </Section>

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

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2";

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-4 border-b border-gray-100 pb-3">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </header>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
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
