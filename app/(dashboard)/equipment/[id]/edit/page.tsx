"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  EQUIPMENT_ITEM_STATUS,
  isEquipmentItemStatus,
  type EquipmentItemStatus,
} from "@/lib/equipment-status";
import { EquipmentResponsibleEditor } from "../../_components/EquipmentResponsibleEditor";

type Category = {
  id: number;
  name: string;
  code: string;
  responsible_user_id?: number | null;
  users_responsible?: { id: number; first_name: string; last_name: string } | null;
};
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
  disposed_at: string;
  disposal_reason: string;
};
type Equipment = {
  id: number;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  description: string | null;
  category_id: number;
  purchase_date: string | null;
  purchase_price: number | null;
  supplier: string | null;
  invoice_number: string | null;
  status: string;
  location: string | null;
  notes: string | null;
};

export default function EditEquipmentPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [categories, setCategories] = useState<Category[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
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
    disposed_at: "",
    disposal_reason: "",
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/equipment/categories`).then((r) => r.json()),
      fetch(`/api/equipment/${id}`).then((r) => r.json()),
      fetch(`/api/equipment/rooms`).then((r) => r.json()),
    ]).then(([cats, item, roomsData]) => {
      setCategories(Array.isArray(cats) ? cats : []);
      setRooms(Array.isArray(roomsData) ? roomsData : []);
      if (item?.id) {
        const statusRaw = item.status ?? "";
        setForm({
          name: item.name,
          brand: item.brand ?? "",
          model: item.model ?? "",
          serial_number: item.serial_number ?? "",
          description: item.description ?? "",
          category_id: String(item.category_id),
          purchase_date: item.purchase_date
            ? new Date(item.purchase_date).toISOString().slice(0, 10)
            : "",
          purchase_price: item.purchase_price != null ? String(item.purchase_price) : "",
          supplier: item.supplier ?? "",
          invoice_number: item.invoice_number ?? "",
          status: isEquipmentItemStatus(statusRaw)
            ? statusRaw
            : EQUIPMENT_ITEM_STATUS.SKLADEM,
          location: item.location ?? "",
          notes: item.notes ?? "",
          room_id: item.room_id != null ? String(item.room_id) : "",
          warranty_until: item.warranty_until
            ? new Date(item.warranty_until).toISOString().slice(0, 10)
            : "",
          last_service_at: item.last_service_at
            ? new Date(item.last_service_at).toISOString().slice(0, 10)
            : "",
          disposed_at: item.disposed_at
            ? new Date(item.disposed_at).toISOString().slice(0, 10)
            : "",
          disposal_reason: item.disposal_reason ?? "",
        });
      }
    }).catch(() => setError("Chyba při načítání"))
      .finally(() => setLoadingData(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/equipment/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          purchase_date: form.purchase_date || null,
          purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
          room_id: form.room_id || null,
          warranty_until: form.warranty_until || null,
          last_service_at: form.last_service_at || null,
          disposed_at: form.disposed_at || null,
          disposal_reason: form.disposal_reason || null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Chyba při ukládání");
        setLoading(false);
        return;
      }

      router.push(`/equipment/${id}`);
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
          <h1 className="text-2xl font-bold text-gray-900">Upravit vybavení</h1>
          <p className="mt-1 text-gray-600">{form.name || "Vybavení"}</p>
        </div>
        <Link
          href={`/equipment/${id}`}
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
          {form.category_id ? (
            <div className="sm:col-span-2">
              <EquipmentResponsibleEditor
                key={form.category_id}
                categoryId={parseInt(form.category_id, 10)}
                categoryName={categories.find((c) => String(c.id) === form.category_id)?.name ?? ""}
                currentUserId={
                  categories.find((c) => String(c.id) === form.category_id)?.responsible_user_id ?? null
                }
                currentPerson={
                  categories.find((c) => String(c.id) === form.category_id)?.users_responsible ?? null
                }
                canEdit
              />
            </div>
          ) : null}
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Vyřazeno dne</label>
            <input
              type="date"
              value={form.disposed_at}
              onChange={(e) => setForm({ ...form, disposed_at: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Důvod vyřazení</label>
            <input
              type="text"
              value={form.disposal_reason}
              onChange={(e) => setForm({ ...form, disposal_reason: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
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
            href={`/equipment/${id}`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </Link>
        </div>
      </form>
    </>
  );
}
