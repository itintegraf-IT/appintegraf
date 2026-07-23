"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  EQUIPMENT_ITEM_STATUS,
  isEquipmentItemStatus,
  type EquipmentItemStatus,
} from "@/lib/equipment-status";

type Category = { id: number; name: string; code: string };
type Room = { id: number; name: string; code: string };

type EquipmentFormState = {
  name: string;
  brand: string;
  model: string;
  serial_number: string;
  description: string;
  category_id: string;
  purchase_date: string;
  purchase_price: string;
  supplier: string;
  invoice_number: string;
  status: EquipmentItemStatus;
  location: string;
  notes: string;
  room_id: string;
  warranty_until: string;
  last_service_at: string;
  pool_qr_code: string;
};

export default function AddEquipmentPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<EquipmentFormState>({
    name: "",
    brand: "",
    model: "",
    serial_number: "",
    description: "",
    category_id: "",
    purchase_date: "",
    purchase_price: "",
    supplier: "",
    invoice_number: "",
    status: EQUIPMENT_ITEM_STATUS.SKLADEM,
    location: "",
    notes: "",
    room_id: "",
    warranty_until: "",
    last_service_at: "",
    pool_qr_code: "",
  });

  useEffect(() => {
    fetch("/api/equipment/categories")
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setCategories(data) : []))
      .catch(() => {});
    fetch("/api/equipment/rooms")
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setRooms(data) : []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          purchase_date: form.purchase_date || null,
          purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
          room_id: form.room_id || null,
          warranty_until: form.warranty_until || null,
          last_service_at: form.last_service_at || null,
          pool_qr_code: form.pool_qr_code || null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Chyba při ukládání");
        setLoading(false);
        return;
      }

      router.push(`/equipment/${data.id}`);
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
          <h1 className="text-2xl font-bold text-gray-900">Přidat vybavení</h1>
          <p className="mt-1 text-gray-600">Nový záznam v evidenci majetku</p>
        </div>
        <Link
          href="/equipment"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Název *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Kategorie *</label>
            <select
              required
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">Vyberte kategorii</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
            <select
              value={form.status}
              onChange={(e) => {
                const v = e.target.value;
                setForm({
                  ...form,
                  status: isEquipmentItemStatus(v)
                    ? v
                    : EQUIPMENT_ITEM_STATUS.SKLADEM,
                });
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value={EQUIPMENT_ITEM_STATUS.SKLADEM}>Skladem</option>
              <option value={EQUIPMENT_ITEM_STATUS.PRIRAZENO}>Přiřazeno</option>
              <option value={EQUIPMENT_ITEM_STATUS.SERVIS}>Servis</option>
              <option value={EQUIPMENT_ITEM_STATUS.VYRAZENO}>Vyřazeno</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Značka</label>
            <input
              type="text"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Model</label>
            <input
              type="text"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Sériové číslo</label>
            <input
              type="text"
              value={form.serial_number}
              onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Datum nákupu</label>
            <input
              type="date"
              value={form.purchase_date}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Pořizovací cena (Kč)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={form.purchase_price}
              onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="např. 25000"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Dodavatel</label>
            <input
              type="text"
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Číslo faktury</label>
            <input
              type="text"
              value={form.invoice_number}
              onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Umístění (text)</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Místnost</label>
            <select
              value={form.room_id}
              onChange={(e) => setForm({ ...form, room_id: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">— Bez místnosti —</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} – {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Záruka do</label>
            <input
              type="date"
              value={form.warranty_until}
              onChange={(e) => setForm({ ...form, warranty_until: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Poslední servis</label>
            <input
              type="date"
              value={form.last_service_at}
              onChange={(e) => setForm({ ...form, last_service_at: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Inventární č. z fondu (ručně)
            </label>
            <input
              type="text"
              value={form.pool_qr_code}
              onChange={(e) => setForm({ ...form, pool_qr_code: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono"
              placeholder="EQ-00001234"
            />
            <p className="mt-1 text-xs text-gray-500">
              Zadejte inventární číslo ze štítku nebo fondu QR (bez skeneru).
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Popis</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Poznámky</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Ukládám…" : "Uložit"}
          </button>
          <Link
            href="/equipment"
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </Link>
        </div>
      </form>
    </>
  );
}
