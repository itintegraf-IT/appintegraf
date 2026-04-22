"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";

type Customer = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
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
};

export default function ImlCustomerEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [legacyShippingAddress, setLegacyShippingAddress] = useState<string | null>(null);
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

  useEffect(() => {
    fetch(`/api/iml/customers/${id}`)
      .then((r) => r.json())
      .then((data: Customer) => {
        if (data?.id) {
          setForm({
            name: data.name ?? "",
            email: data.email ?? "",
            phone: data.phone ?? "",
            contact_person: data.contact_person ?? "",
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
          setLegacyShippingAddress(data.shipping_address);
        }
      })
      .catch(() => setError("Chyba při načítání"))
      .finally(() => setLoadingData(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/iml/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          allow_under_over_delivery_percent: form.allow_under_over_delivery_percent
            ? parseFloat(form.allow_under_over_delivery_percent)
            : null,
          // Legacy pole - posilame zpet nezmenene, abychom ho pri ulozeni nesmazali
          shipping_address: legacyShippingAddress,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Chyba při ukládání");
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

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

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
        <Link
          href={`/iml/customers/${id}`}
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

        {legacyShippingAddress && legacyShippingAddress.trim() !== "" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="flex-1">
                <strong>Legacy pole „Doručovací adresa":</strong> Tento zákazník má
                vyplněné staré jednořádkové pole, které bylo nahrazeno sekcí „Doručovací
                adresy" v detailu. Pole zůstává zachováno v databázi, v budoucí fázi
                migrace bude převedeno a odstraněno.
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
