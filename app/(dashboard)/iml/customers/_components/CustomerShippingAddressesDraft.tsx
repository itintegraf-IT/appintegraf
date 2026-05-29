"use client";

import { useState } from "react";
import { MapPin, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import {
  type DraftShippingAddress,
  emptyDraftShippingAddress,
  newTempId,
} from "@/lib/iml-customer-form-draft";

type FormState = Omit<DraftShippingAddress, "tempId" | "id">;

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
  expedition_note: "",
};

type Props = {
  addresses: DraftShippingAddress[];
  onChange: (addresses: DraftShippingAddress[]) => void;
  title?: string;
  embedded?: boolean;
  /** Text pod seznamem – např. že se uloží až s formulářem zákazníka */
  showSaveHint?: boolean;
};

export default function CustomerShippingAddressesDraft({
  addresses,
  onChange,
  title = "Doručovací adresy",
  embedded = false,
  showSaveHint = false,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTempId, setEditingTempId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [modalError, setModalError] = useState<string | null>(null);

  const openCreate = () => {
    setEditingTempId(null);
    setForm({ ...emptyForm, is_default: addresses.length === 0 });
    setModalError(null);
    setModalOpen(true);
  };

  const openEdit = (a: DraftShippingAddress) => {
    setEditingTempId(a.tempId);
    setForm({
      label: a.label,
      recipient: a.recipient,
      street: a.street,
      city: a.city,
      postal_code: a.postal_code,
      country: a.country,
      is_default: a.is_default,
      label_requirements: a.label_requirements,
      pallet_packaging: a.pallet_packaging,
      prepress_notes: a.prepress_notes,
      expedition_note: a.expedition_note,
    });
    setModalError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTempId(null);
    setForm(emptyForm);
    setModalError(null);
  };

  const commitForm = () => {
    if (!form.label.trim() && !form.street.trim()) {
      setModalError("Vyplňte alespoň název (štítek) nebo ulici.");
      return;
    }

    const row: DraftShippingAddress = {
      tempId: editingTempId ?? newTempId(),
      ...form,
    };

    let next: DraftShippingAddress[];
    if (editingTempId) {
      next = addresses.map((a) => (a.tempId === editingTempId ? row : a));
    } else {
      next = [...addresses, row];
    }

    if (row.is_default) {
      next = next.map((a) => ({
        ...a,
        is_default: a.tempId === row.tempId,
      }));
    } else if (!next.some((a) => a.is_default) && next.length > 0) {
      next = next.map((a, i) => ({ ...a, is_default: i === 0 }));
    }

    onChange(next);
    closeModal();
  };

  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
      e.preventDefault();
      commitForm();
    }
  };

  const setAsDefault = (tempId: string) => {
    onChange(
      addresses.map((a) => ({
        ...a,
        is_default: a.tempId === tempId,
      }))
    );
  };

  const removeAddress = (tempId: string) => {
    const a = addresses.find((x) => x.tempId === tempId);
    if (!a) return;
    if (!confirm(`Smazat adresu „${a.label || a.street || "bez popisu"}"?`)) return;
    let next = addresses.filter((x) => x.tempId !== tempId);
    if (a.is_default && next.length > 0) {
      next = next.map((x, i) => ({ ...x, is_default: i === 0 }));
    }
    onChange(next);
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100";

  const inner = (
    <>
      <div className="mb-3 flex items-center justify-between">
        {!embedded && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
        {embedded && <span className="text-sm font-medium text-gray-700">{title}</span>}
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          Přidat adresu
        </button>
      </div>

      {showSaveHint && addresses.length > 0 && (
        <p className="mb-3 text-sm text-gray-600">
          V formuláři máte {addresses.length}{" "}
          {addresses.length === 1 ? "adresu" : addresses.length < 5 ? "adresy" : "adres"} – uloží
          se po kliknutí na „Uložit“.
        </p>
      )}

      {addresses.length === 0 ? (
        <p className="text-sm text-gray-500">Zatím žádná doručovací adresa.</p>
      ) : (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <li
              key={a.tempId}
              className={`rounded-lg border p-4 ${
                a.is_default ? "border-red-200 bg-red-50/40" : "border-gray-200 bg-white"
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
                  {a.expedition_note && (
                    <p className="mt-1 text-xs text-gray-500">
                      <strong>Expedice:</strong> {a.expedition_note}
                    </p>
                  )}
                </div>
                <div className="flex flex-shrink-0 gap-1">
                  {!a.is_default && (
                    <button
                      type="button"
                      onClick={() => setAsDefault(a.tempId)}
                      title="Nastavit jako výchozí"
                      className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(a)}
                    className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAddress(a.tempId)}
                    className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shipping-address-draft-modal-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleModalKeyDown}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h4 id="shipping-address-draft-modal-title" className="text-lg font-semibold">
                {editingTempId ? "Upravit adresu" : "Nová doručovací adresa"}
              </h4>
              <button type="button" onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            {modalError && (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {modalError}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-700">Štítek / název</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-700">Příjemce</label>
                <input
                  type="text"
                  value={form.recipient}
                  onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-700">Ulice</label>
                <input
                  type="text"
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Město</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">PSČ</label>
                <input
                  type="text"
                  value={form.postal_code}
                  onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-700">Země</label>
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Poznámka k expedici
                </label>
                <textarea
                  value={form.expedition_note}
                  onChange={(e) => setForm({ ...form, expedition_note: e.target.value })}
                  rows={2}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_default}
                    onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                    className="rounded border-gray-300 text-red-600"
                  />
                  Výchozí doručovací adresa
                </label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={commitForm}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                {editingTempId ? "Uložit" : "Přidat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="mt-2">{inner}</div>;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">{inner}</div>
  );
}
