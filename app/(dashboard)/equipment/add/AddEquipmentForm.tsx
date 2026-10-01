"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, ArrowLeft } from "lucide-react";
import { EquipmentResponsibleEditor } from "../_components/EquipmentResponsibleEditor";
import { DEPRECIABLE_ASSET_THRESHOLD_CZK, MAX_UNITS_PER_CREATE } from "@/lib/equipment/new-item-validation";

type Category = {
  id: number;
  name: string;
  code: string;
  responsible_user_id?: number | null;
  users_responsible?: { id: number; first_name: string; last_name: string } | null;
};
type Room = { id: number; name: string; code: string };

type Props = {
  /** Smí zadat inventární číslo ručně (správce evidence: Editor/Admin Majetku). */
  canSetManualTag: boolean;
  /** Kód z fondu QR (z odkazu skeneru `?pool=`). */
  initialPoolCode: string;
  initialRoomId: string;
};

const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2";
const labelClass = "mb-1 block text-sm font-medium";

/** Stejné čtení ceny jako na serveru (mezery a desetinná čárka). */
function parsePriceInput(value: string): number | null {
  const raw = value.replace(/[\s  ]/g, "").replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(raw) ? Number(raw) : null;
}

export function AddEquipmentForm({ canSetManualTag, initialPoolCode, initialRoomId }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unitCount, setUnitCount] = useState(1);
  const [unitSerials, setUnitSerials] = useState<string[]>([""]);
  const [poolCode, setPoolCode] = useState(initialPoolCode);
  const [tagMode, setTagMode] = useState<"series" | "manual">("series");
  const [manualTag, setManualTag] = useState("");
  const [form, setForm] = useState({
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
    notes: "",
    room_id: initialRoomId,
    warranty_until: "",
  });

  useEffect(() => {
    fetch("/api/equipment/categories?for=write")
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setCategories(data) : []))
      .catch(() => setError("Nepodařilo se načíst skupiny majetku. Obnovte stránku."));
    fetch("/api/equipment/rooms")
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setRooms(data) : []))
      .catch(() => setError("Nepodařilo se načíst místnosti. Obnovte stránku."));
  }, []);

  const price = useMemo(() => parsePriceInput(form.purchase_price), [form.purchase_price]);
  const depreciable = price !== null && price >= DEPRECIABLE_ASSET_THRESHOLD_CZK;
  const selectedCategory = categories.find((c) => String(c.id) === form.category_id);

  const setCount = (n: number) => {
    const count = Math.min(MAX_UNITS_PER_CREATE, Math.max(1, n));
    setUnitCount(count);
    setUnitSerials((prev) => {
      const next = prev.slice(0, count);
      while (next.length < count) next.push("");
      return next;
    });
    if (count > 1) setTagMode("series");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        room_id: form.room_id || null,
        warranty_until: form.warranty_until || null,
        unit_count: unitCount,
      };
      if (unitCount > 1) {
        payload.serial_numbers = unitSerials.map((s) => s.trim());
        delete payload.serial_number;
      }
      if (unitCount === 1 && poolCode) payload.pool_qr_code = poolCode;
      else if (unitCount === 1 && tagMode === "manual") payload.manual_asset_tag = manualTag;

      const res = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Položku se nepodařilo uložit.");
        return;
      }
      router.push(data.count > 1 ? "/equipment?scope=all" : `/equipment/${data.id}`);
      router.refresh();
    } catch {
      setError("Spojení se serverem selhalo. Nic se neuložilo — zkuste to znovu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Zařadit majetek</h1>
          <p className="mt-1 text-muted-foreground">
            Nový drobný majetek do evidence. Inventární číslo přidělí aplikace z číselné řady.
          </p>
        </div>
        <Link
          href="/equipment"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Zpět
        </Link>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {error ? (
          <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-primary/40 p-3 text-sm font-medium text-primary">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="eq-name" className={labelClass}>Název *</label>
            <input id="eq-name" type="text" required maxLength={200} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="eq-category" className={labelClass}>Skupina *</label>
            <select id="eq-category" required value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })} className={inputClass}>
              <option value="">Vyberte skupinu</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="eq-units" className={labelClass}>Počet kusů</label>
            <input id="eq-units" type="number" min={1} max={MAX_UNITS_PER_CREATE} value={unitCount}
              onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)} className={inputClass} />
            <p className="mt-1 text-xs text-muted-foreground">
              Každý kus dostane vlastní inventární číslo a QR štítek (max {MAX_UNITS_PER_CREATE}).
            </p>
          </div>
          {selectedCategory ? (
            <div className="sm:col-span-2">
              <EquipmentResponsibleEditor
                key={form.category_id}
                categoryId={selectedCategory.id}
                categoryName={selectedCategory.name}
                currentUserId={selectedCategory.responsible_user_id ?? null}
                currentPerson={selectedCategory.users_responsible ?? null}
                canEdit
              />
            </div>
          ) : null}

          <div>
            <label htmlFor="eq-date" className={labelClass}>Datum pořízení *</label>
            <input id="eq-date" type="date" required value={form.purchase_date}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="eq-price" className={labelClass}>Pořizovací cena za kus (Kč) *</label>
            <input id="eq-price" type="text" inputMode="decimal" required value={form.purchase_price}
              onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} className={inputClass}
              placeholder="např. 24 990,50" aria-describedby={depreciable ? "eq-price-warning" : undefined} />
            {depreciable ? (
              <p id="eq-price-warning" className="mt-1 flex items-start gap-1.5 text-xs font-medium text-primary">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Majetek od 80 000 Kč se eviduje v ABRA Gen jako odepisovaný — zadejte jeho inventární číslo z Gen ručně.
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="eq-invoice" className={labelClass}>Doklad (číslo faktury) *</label>
            <input id="eq-invoice" type="text" required maxLength={100} value={form.invoice_number}
              onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} className={inputClass}
              placeholder="např. FP-2026-0815" />
            <p className="mt-1 text-xs text-muted-foreground">Faktura, dodací list nebo jiný doklad o pořízení.</p>
          </div>
          <div>
            <label htmlFor="eq-supplier" className={labelClass}>Dodavatel</label>
            <input id="eq-supplier" type="text" maxLength={200} value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })} className={inputClass} />
          </div>

          <div>
            <label htmlFor="eq-brand" className={labelClass}>Značka</label>
            <input id="eq-brand" type="text" maxLength={100} value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="eq-model" className={labelClass}>Model</label>
            <input id="eq-model" type="text" maxLength={100} value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })} className={inputClass} />
          </div>
          {unitCount === 1 ? (
            <div>
              <label htmlFor="eq-serial" className={labelClass}>Sériové číslo</label>
              <input id="eq-serial" type="text" maxLength={100} value={form.serial_number}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })} className={inputClass} />
            </div>
          ) : (
            <fieldset className="rounded-lg border border-dashed border-border p-4 sm:col-span-2">
              <legend className="px-1 text-sm font-medium">Sériová čísla kusů (nepovinná)</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {unitSerials.map((sn, i) => (
                  <label key={i} className="block text-xs text-muted-foreground">
                    Kus {i + 1}
                    <input type="text" maxLength={100} value={sn}
                      onChange={(e) => {
                        const next = [...unitSerials];
                        next[i] = e.target.value;
                        setUnitSerials(next);
                      }}
                      className={`${inputClass} mt-0.5 font-mono text-sm text-foreground`} />
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div>
            <label htmlFor="eq-room" className={labelClass}>Místnost</label>
            <select id="eq-room" value={form.room_id}
              onChange={(e) => setForm({ ...form, room_id: e.target.value })} className={inputClass}>
              <option value="">— Bez místnosti —</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.code} – {r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="eq-warranty" className={labelClass}>Záruka do</label>
            <input id="eq-warranty" type="date" value={form.warranty_until}
              onChange={(e) => setForm({ ...form, warranty_until: e.target.value })} className={inputClass} />
          </div>

          <fieldset className="rounded-lg border border-border p-4 sm:col-span-2">
            <legend className="px-1 text-sm font-medium">Inventární číslo</legend>
            {unitCount === 1 && poolCode ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <p>
                  Převezme se ze štítku z fondu QR: <span className="font-mono">{poolCode}</span>
                </p>
                <button type="button" onClick={() => setPoolCode("")}
                  className="min-h-11 rounded-lg border border-border px-3 hover:bg-muted">
                  Nepoužít štítek z fondu
                </button>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <label className="flex min-h-11 items-center gap-2">
                  <input type="radio" name="tag-mode" checked={tagMode === "series"} onChange={() => setTagMode("series")} />
                  Přidělit automaticky z číselné řady
                </label>
                {canSetManualTag && unitCount === 1 ? (
                  <>
                    <label className="flex min-h-11 items-center gap-2">
                      <input type="radio" name="tag-mode" checked={tagMode === "manual"} onChange={() => setTagMode("manual")} />
                      Zadat ručně (číslo z ABRA Gen u odepisovaného majetku)
                    </label>
                    {tagMode === "manual" ? (
                      <input type="text" required maxLength={40} value={manualTag}
                        onChange={(e) => setManualTag(e.target.value)} aria-label="Inventární číslo z ABRA Gen"
                        className={`${inputClass} max-w-xs font-mono`} placeholder="např. 1215" />
                    ) : null}
                  </>
                ) : null}
              </div>
            )}
          </fieldset>

          <div className="sm:col-span-2">
            <label htmlFor="eq-description" className={labelClass}>Popis</label>
            <textarea id="eq-description" rows={3} maxLength={5000} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="eq-notes" className={labelClass}>Poznámky</label>
            <textarea id="eq-notes" rows={2} maxLength={5000} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button type="submit" disabled={loading}
            className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {loading ? "Ukládám…" : unitCount > 1 ? `Zařadit ${unitCount} kusů` : "Zařadit"}
          </button>
          <Link href="/equipment" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 hover:bg-muted">
            Zrušit
          </Link>
        </div>
      </form>
    </>
  );
}
