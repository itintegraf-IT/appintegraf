"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, Pencil, Plus, Star, Trash2, X } from "lucide-react";

type ShippingAddress = {
  id: number;
  customer_id: number;
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
};

type FormState = {
  label: string;
  recipient: string;
  street: string;
  city: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  label_requirements: string;
  pallet_packaging: string;
  prepress_notes: string;
};

const emptyForm: FormState = {
  label: "",
  recipient: "",
  street: "",
  city: "",
  postal_code: "",
  country: "Česká republika",
  is_default: false,
  label_requirements: "",
  pallet_packaging: "",
  prepress_notes: "",
};

/**
 * Komponenta pro správu doručovacích adres zákazníka.
 * - Seznam karet (výchozí první, ostatní podle stáří)
 * - Modal pro vytvoření a editaci
 * - Tlačítko „Nastavit jako výchozí" (atomic flip na serveru)
 * - Mazání s potvrzením; při mazání výchozí server přenese výchozí na nejstarší další
 */
export default function CustomerShippingAddresses({
  customerId,
  canWrite = true,
  embedded = false,
}: {
  customerId: number;
  canWrite?: boolean;
  /**
   * Pokud true, komponenta nerenderuje vlastní vnější kartu (border + padding + nadpis)
   * a očekává, že ji obalí rodič (např. SectionShell nebo Tab panel).
   * V tomto režimu stále zobrazuje malý toolbar s tlačítkem „+ Přidat adresu".
   */
  embedded?: boolean;
}) {
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/iml/customers/${customerId}/shipping-addresses`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba načítání");
      setAddresses(Array.isArray(data.addresses) ? data.addresses : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba načítání");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, is_default: addresses.length === 0 });
    setModalError(null);
    setModalOpen(true);
  };

  const openEdit = (a: ShippingAddress) => {
    setEditingId(a.id);
    setForm({
      label: a.label ?? "",
      recipient: a.recipient ?? "",
      street: a.street ?? "",
      city: a.city ?? "",
      postal_code: a.postal_code ?? "",
      country: a.country ?? "Česká republika",
      is_default: a.is_default,
      label_requirements: a.label_requirements ?? "",
      pallet_packaging: a.pallet_packaging ?? "",
      prepress_notes: a.prepress_notes ?? "",
    });
    setModalError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setModalError(null);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!form.label.trim() && !form.street.trim()) {
      setModalError("Vyplňte alespoň název (štítek) nebo ulici.");
      return;
    }

    setSaving(true);
    try {
      const url = editingId
        ? `/api/iml/customers/${customerId}/shipping-addresses/${editingId}`
        : `/api/iml/customers/${customerId}/shipping-addresses`;
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba ukládání");

      await load();
      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Chyba ukládání");
    } finally {
      setSaving(false);
    }
  };

  const setAsDefault = async (a: ShippingAddress) => {
    if (a.is_default) return;
    setBusyId(a.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/iml/customers/${customerId}/shipping-addresses/${a.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: a.label,
            recipient: a.recipient,
            street: a.street,
            city: a.city,
            postal_code: a.postal_code,
            country: a.country,
            is_default: true,
            label_requirements: a.label_requirements,
            pallet_packaging: a.pallet_packaging,
            prepress_notes: a.prepress_notes,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setBusyId(null);
    }
  };

  const removeAddress = async (a: ShippingAddress) => {
    const msg = a.is_default
      ? `Smazat výchozí adresu „${a.label || a.street || "bez popisu"}"? Výchozí bude přenesena na nejstarší z ostatních.`
      : `Smazat adresu „${a.label || a.street || "bez popisu"}"?`;
    if (!confirm(msg)) return;
    setBusyId(a.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/iml/customers/${customerId}/shipping-addresses/${a.id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setBusyId(null);
    }
  };

  const body = (
    <>
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Načítání…</p>
      ) : addresses.length === 0 ? (
        <p className="text-sm text-gray-500">
          Zákazník zatím nemá žádnou doručovací adresu.
        </p>
      ) : (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <li
              key={a.id}
              className={`rounded-lg border p-4 ${
                a.is_default
                  ? "border-red-200 bg-red-50/40"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="font-medium text-gray-900">
                      {a.label || "(bez názvu)"}
                    </span>
                    {a.is_default && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        <Star className="h-3 w-3 fill-red-600 text-red-600" />
                        Výchozí
                      </span>
                    )}
                  </div>
                  {a.recipient && (
                    <p className="mt-1 text-sm text-gray-700">{a.recipient}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-600">
                    {[a.street, [a.postal_code, a.city].filter(Boolean).join(" "), a.country]
                      .filter(Boolean)
                      .join(", ") || "(bez adresy)"}
                  </p>
                  {(a.label_requirements || a.pallet_packaging || a.prepress_notes) && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                        Individuální požadavky k adrese
                      </summary>
                      <div className="mt-1 space-y-1 text-xs text-gray-600">
                        {a.label_requirements && (
                          <p>
                            <strong>Etikety:</strong> {a.label_requirements}
                          </p>
                        )}
                        {a.pallet_packaging && (
                          <p>
                            <strong>Palety/balení:</strong> {a.pallet_packaging}
                          </p>
                        )}
                        {a.prepress_notes && (
                          <p>
                            <strong>Pre-press:</strong> {a.prepress_notes}
                          </p>
                        )}
                      </div>
                    </details>
                  )}
                </div>
                {canWrite && (
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    {!a.is_default && (
                      <button
                        type="button"
                        onClick={() => setAsDefault(a)}
                        disabled={busyId === a.id}
                        className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        title="Nastavit jako výchozí"
                      >
                        <Star className="h-3 w-3" />
                        Výchozí
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(a)}
                      className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                      title="Upravit"
                    >
                      <Pencil className="h-3 w-3" />
                      Upravit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAddress(a)}
                      disabled={busyId === a.id}
                      className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                      title="Smazat"
                    >
                      <Trash2 className="h-3 w-3" />
                      Smazat
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? "Upravit doručovací adresu" : "Přidat doručovací adresu"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Zavřít"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                {modalError}
              </div>
            )}

            <form onSubmit={submitForm} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Štítek (např. „Sklad Praha")
                </label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Příjemce (jméno / firma)
                </label>
                <input
                  type="text"
                  value={form.recipient}
                  onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Ulice, č. p.
                </label>
                <input
                  type="text"
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  PSČ
                </label>
                <input
                  type="text"
                  value={form.postal_code}
                  onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Město
                </label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Země
                </label>
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.is_default}
                    onChange={(e) =>
                      setForm({ ...form, is_default: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-600"
                  />
                  Nastavit jako výchozí adresu pro objednávky
                </label>
              </div>

              <details className="sm:col-span-2">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                  Individuální požadavky (volitelné, specifické pro tuto adresu)
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Požadavky na etikety
                    </label>
                    <textarea
                      value={form.label_requirements}
                      onChange={(e) =>
                        setForm({ ...form, label_requirements: e.target.value })
                      }
                      rows={2}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Palety / balení
                    </label>
                    <textarea
                      value={form.pallet_packaging}
                      onChange={(e) =>
                        setForm({ ...form, pallet_packaging: e.target.value })
                      }
                      rows={2}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Pre-press poznámky
                    </label>
                    <textarea
                      value={form.prepress_notes}
                      onChange={(e) =>
                        setForm({ ...form, prepress_notes: e.target.value })
                      }
                      rows={2}
                      className={inputCls}
                    />
                  </div>
                </div>
              </details>

              <div className="flex justify-end gap-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? "Ukládám…" : editingId ? "Uložit změny" : "Přidat adresu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );

  // Embedded: pouze toolbar + obsah; obal poskytuje rodič (SectionShell / tab panel).
  if (embedded) {
    return (
      <div>
        {canWrite && (
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              Přidat adresu
            </button>
          </div>
        )}
        {body}
      </div>
    );
  }

  // Standalone: vlastní karta s nadpisem (použití mimo detail / kdekoli).
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Doručovací adresy</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Libovolný počet adres, jedna z nich označená jako výchozí.
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            Přidat adresu
          </button>
        )}
      </header>
      {body}
    </section>
  );
}

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2";
