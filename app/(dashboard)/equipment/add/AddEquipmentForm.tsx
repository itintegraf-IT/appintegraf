"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { EquipmentResponsibleEditor } from "../_components/EquipmentResponsibleEditor";
import { readApiResponse } from "@/lib/equipment/api-response";
import {
  DEPRECIABLE_ASSET_THRESHOLD_CZK,
  MAX_UNITS_PER_CREATE,
  type NewItemField,
  unitsLabel,
  validateNewItemInput,
} from "@/lib/equipment/new-item-validation";

type Category = {
  id: number;
  name: string;
  code: string;
  responsible_user_id?: number | null;
  users_responsible?: { id: number; first_name: string; last_name: string } | null;
};
type Room = { id: number; name: string; code: string };
type Created = { id: number; ids: number[]; count: number; asset_tags: (string | null)[] };

type Props = {
  /** Kód z fondu QR (z odkazu skeneru `?pool=`). */
  initialPoolCode: string;
  initialRoomId: string;
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 aria-[invalid=true]:border-primary";
const labelClass = "mb-1 block text-sm font-medium";
const hintClass = "mt-1 text-xs text-muted-foreground";
const errorTextClass = "mt-1 flex items-start gap-1.5 text-sm font-medium text-primary dark:text-(--danger)";

/** Prvek, na který se přesune fokus při chybě pole (inventární číslo má cíl podle zvolené varianty). */
const FIELD_INPUT_ID: Record<NewItemField, string> = {
  name: "eq-name",
  category: "eq-category",
  purchaseDate: "eq-date",
  purchasePrice: "eq-price",
  invoiceNumber: "eq-invoice",
  supplier: "eq-supplier",
  brand: "eq-brand",
  model: "eq-model",
  units: "eq-units",
  serials: "eq-serial-0",
  assetTag: "eq-asset-tag",
  room: "eq-room",
  warranty: "eq-warranty",
  description: "eq-description",
  notes: "eq-notes",
};

function isNewItemField(value: string | undefined): value is NewItemField {
  return value !== undefined && value in FIELD_INPUT_ID;
}

/** Stejné čtení ceny jako na serveru (mezery a desetinná čárka). */
function parsePriceInput(value: string): number | null {
  const raw = value.replace(/\s/g, "").replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(raw) ? Number(raw) : null;
}

function isAboveThreshold(priceText: string): boolean {
  const price = parsePriceInput(priceText);
  return price !== null && price > DEPRECIABLE_ASSET_THRESHOLD_CZK;
}

/** Dnešní datum v Praze (YYYY-MM-DD) — horní mez data pořízení. */
function todayInPrague(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(new Date());
}

const EMPTY_FORM = {
  name: "",
  brand: "",
  model: "",
  description: "",
  category_id: "",
  purchase_date: "",
  purchase_price: "",
  supplier: "",
  invoice_number: "",
  notes: "",
  room_id: "",
  warranty_until: "",
};
type FormKey = keyof typeof EMPTY_FORM;

export function AddEquipmentForm({ initialPoolCode, initialRoomId }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadError, setLoadError] = useState("");
  const [banner, setBanner] = useState("");
  const [fieldError, setFieldError] = useState<{ field: NewItemField; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [unitsText, setUnitsText] = useState("1");
  const [serials, setSerials] = useState<string[]>([""]);
  const [poolCode, setPoolCode] = useState(initialPoolCode);
  const [tagMode, setTagMode] = useState<"series" | "manual">("series");
  const [manualTag, setManualTag] = useState("");
  const [confirmSmall, setConfirmSmall] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, room_id: initialRoomId });
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async <T,>(url: string, failure: string, apply: (data: T) => void) => {
      try {
        const result = await readApiResponse<T>(await fetch(url), failure);
        if (result.ok) apply(result.data);
        else setLoadError(result.error);
      } catch {
        setLoadError(failure);
      }
    };
    void load<Category[]>(
      "/api/equipment/categories?for=write",
      "Nepodařilo se načíst skupiny majetku. Obnovte stránku.",
      (data) => setCategories(Array.isArray(data) ? data : [])
    );
    void load<Room[]>("/api/equipment/rooms", "Nepodařilo se načíst místnosti. Obnovte stránku.", (data) =>
      setRooms(Array.isArray(data) ? data : [])
    );
  }, []);

  const unitsValue = /^\d+$/.test(unitsText.trim()) ? Number(unitsText.trim()) : NaN;
  const unitCount = unitsValue >= 1 && unitsValue <= MAX_UNITS_PER_CREATE ? unitsValue : 1;
  const multi = unitCount > 1;
  const aboveThreshold = isAboveThreshold(form.purchase_price);
  const usesPool = !multi && poolCode !== "";
  const effectiveTagMode = multi ? "series" : tagMode;
  const selectedCategory = categories.find((c) => String(c.id) === form.category_id);
  const assetTagTarget = usesPool
    ? "pool"
    : effectiveTagMode === "manual"
      ? "manual"
      : aboveThreshold
        ? "confirm"
        : "series";

  const err = (field: NewItemField) => (fieldError?.field === field ? fieldError.message : null);
  const errorProps = (field: NewItemField) =>
    err(field) ? { "aria-invalid": true, "aria-describedby": `${FIELD_INPUT_ID[field]}-error` } : {};
  const clearError = (field: NewItemField) => {
    if (fieldError?.field === field) setFieldError(null);
  };
  const setField = (key: FormKey, field: NewItemField, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    clearError(field);
  };

  const showBanner = (message: string) => {
    setBanner(message);
    requestAnimationFrame(() => {
      bannerRef.current?.focus();
      bannerRef.current?.scrollIntoView({ block: "center" });
    });
  };
  const showFieldError = (field: NewItemField, message: string) => {
    setFieldError({ field, message });
    requestAnimationFrame(() => {
      const el = document.getElementById(FIELD_INPUT_ID[field]);
      el?.focus();
      el?.scrollIntoView({ block: "center" });
    });
  };

  const onPriceChange = (value: string) => {
    const nowAbove = isAboveThreshold(value);
    if (nowAbove !== aboveThreshold) {
      setConfirmSmall(false);
      // Odepisovaný majetek má číslo z ABRA Gen → nabídnout rovnou ruční zadání.
      if (nowAbove && !multi && !poolCode) setTagMode("manual");
      if (!nowAbove && !manualTag.trim()) setTagMode("series");
    }
    setField("purchase_price", "purchasePrice", value);
  };

  const buildPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      ...form,
      room_id: form.room_id || null,
      warranty_until: form.warranty_until || null,
      // Prázdný počet je chyba (žádné tiché „1“).
      unit_count: unitsText.trim() || "0",
    };
    if (multi) payload.serial_numbers = Array.from({ length: unitCount }, (_, i) => (serials[i] ?? "").trim());
    else payload.serial_number = serials[0] ?? "";
    if (usesPool) payload.pool_qr_code = poolCode;
    else if (effectiveTagMode === "manual") payload.manual_asset_tag = manualTag;
    if (aboveThreshold && effectiveTagMode === "series" && confirmSmall) payload.confirm_small_asset = true;
    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setBanner("");
    setFieldError(null);

    const payload = buildPayload();
    const check = validateNewItemInput(payload, { canSetManualTag: true, today: new Date() });
    if (!check.ok) {
      if (check.field) showFieldError(check.field, check.error);
      else showBanner(check.error);
      return;
    }

    setLoading(true);
    let leaving = false;
    try {
      const res = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await readApiResponse<Created>(res, "Majetek se nepodařilo zařadit. Zkuste to znovu.");
      if (!result.ok) {
        if (!result.sessionExpired && isNewItemField(result.field)) showFieldError(result.field, result.error);
        else showBanner(result.error);
        return;
      }
      if (result.data.count > 1) {
        setCreated(result.data);
        window.scrollTo({ top: 0 });
        return;
      }
      // Tlačítko zůstane neaktivní až do otevření detailu (žádné druhé zařazení).
      leaving = true;
      router.push(`/equipment/${result.data.id}`);
      router.refresh();
    } catch {
      showBanner(
        "Spojení se serverem selhalo. Majetek se možná zařadil — než ho zadáte znovu, zkontrolujte seznam majetku."
      );
    } finally {
      if (!leaving) setLoading(false);
    }
  };

  /** Další položka ze stejného dokladu: doklad zůstane, zbytek se vyprázdní. */
  const startNext = () => {
    setForm((prev) => ({
      ...EMPTY_FORM,
      invoice_number: prev.invoice_number,
      purchase_date: prev.purchase_date,
      supplier: prev.supplier,
      room_id: prev.room_id,
    }));
    setUnitsText("1");
    setSerials([""]);
    setTagMode("series");
    setManualTag("");
    setConfirmSmall(false);
    setPoolCode("");
    setCreated(null);
    setBanner("");
    setFieldError(null);
  };

  const errorNode = (field: NewItemField) =>
    err(field) ? (
      <p id={`${FIELD_INPUT_ID[field]}-error`} className={errorTextClass}>
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {err(field)}
      </p>
    ) : null;

  const header = (
    <div className="mb-6 flex items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">Zařadit majetek</h1>
        <p className="mt-1 text-muted-foreground">
          Nákup drobného majetku do evidence podle dokladu. Inventární číslo přidělí aplikace z číselné řady.
        </p>
      </div>
      <Link
        href="/equipment?scope=all"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 hover:bg-muted"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Zpět
      </Link>
    </div>
  );

  if (created) {
    return (
      <>
        {header}
        <div role="status" className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="flex items-center gap-2 text-lg font-semibold">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-(--success)" aria-hidden />
            Zařazeno {unitsLabel(created.count)}
          </p>
          <p className="mt-1 text-muted-foreground">
            {form.name} · doklad {form.invoice_number}
          </p>
          <p className="mt-4 text-sm font-medium">Přidělená inventární čísla (otevřou detail kusu):</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-3">
            {created.ids.map((id, i) => (
              <li key={id}>
                <Link
                  href={`/equipment/${id}`}
                  className="inline-flex min-h-11 w-full items-center rounded-lg border border-border px-3 font-mono hover:bg-muted"
                >
                  {created.asset_tags[i] ?? `#${id}`}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startNext}
              className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:opacity-90"
            >
              Zařadit další položku z dokladu
            </button>
            <Link
              href="/equipment?scope=all"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 hover:bg-muted"
            >
              Přejít na seznam majetku
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {header}

      <form
        noValidate
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-8 rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        {loadError ? (
          <p role="alert" className={errorTextClass}>
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {loadError}
          </p>
        ) : null}
        {banner ? (
          <div
            ref={bannerRef}
            role="alert"
            tabIndex={-1}
            className="flex items-start gap-2 rounded-lg border border-primary/40 p-3 text-sm font-medium text-primary outline-none dark:text-(--danger)"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {banner}
          </div>
        ) : null}

        <section className="space-y-4">
          <h2 className="text-base font-semibold">Doklad o pořízení</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="eq-invoice" className={labelClass}>Doklad (číslo faktury) *</label>
              <input id="eq-invoice" type="text" maxLength={100} value={form.invoice_number}
                onChange={(e) => setField("invoice_number", "invoiceNumber", e.target.value)}
                className={inputClass} placeholder="např. FP-2026-0815" {...errorProps("invoiceNumber")} />
              {errorNode("invoiceNumber")}
              <p className={hintClass}>Faktura, dodací list nebo jiný doklad o pořízení.</p>
            </div>
            <div>
              <label htmlFor="eq-date" className={labelClass}>Datum pořízení *</label>
              <input id="eq-date" type="date" max={todayInPrague()} value={form.purchase_date}
                onChange={(e) => setField("purchase_date", "purchaseDate", e.target.value)}
                className={inputClass} {...errorProps("purchaseDate")} />
              {errorNode("purchaseDate")}
            </div>
            <div>
              <label htmlFor="eq-price" className={labelClass}>Pořizovací cena za kus bez DPH (Kč) *</label>
              <input id="eq-price" type="text" inputMode="decimal" value={form.purchase_price}
                onChange={(e) => onPriceChange(e.target.value)} className={inputClass}
                placeholder="např. 24 990,50" {...errorProps("purchasePrice")} />
              {errorNode("purchasePrice")}
              <p className={hintClass}>Bez DPH. Pokud jste DPH neuplatnili (bez nároku na odpočet), zadejte cenu s DPH.</p>
              {aboveThreshold ? (
                <p className="mt-2 flex items-start gap-2 rounded-lg border border-(--warning) bg-(--warning)/15 p-2 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  Cena je nad 80 000 Kč — takový majetek je odepisovaný a eviduje se v ABRA Gen. Níže zadejte jeho
                  inventární číslo z Gen.
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="eq-supplier" className={labelClass}>Dodavatel</label>
              <input id="eq-supplier" type="text" maxLength={200} value={form.supplier}
                onChange={(e) => setField("supplier", "supplier", e.target.value)} className={inputClass}
                {...errorProps("supplier")} />
              {errorNode("supplier")}
            </div>
          </div>

          <fieldset className="rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-medium">Inventární číslo</legend>
            {usesPool ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <p>
                  Převezme se ze štítku z fondu QR: <span className="font-mono">{poolCode}</span>
                </p>
                <button id={assetTagTarget === "pool" ? "eq-asset-tag" : undefined} type="button"
                  onClick={() => { setPoolCode(""); clearError("assetTag"); }}
                  className="min-h-11 rounded-lg border border-border px-3 hover:bg-muted">
                  Nepoužít štítek z fondu
                </button>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <label className="flex min-h-11 items-center gap-2">
                  <input id={assetTagTarget === "series" ? "eq-asset-tag" : undefined} type="radio" name="tag-mode"
                    checked={effectiveTagMode === "series"}
                    onChange={() => { setTagMode("series"); clearError("assetTag"); }} />
                  Přidělit automaticky z číselné řady drobného majetku
                </label>
                {multi ? (
                  <p className="text-muted-foreground">Více kusů najednou dostane po sobě jdoucí čísla z řady.</p>
                ) : (
                  <>
                    <label className="flex min-h-11 items-center gap-2">
                      <input type="radio" name="tag-mode" checked={effectiveTagMode === "manual"}
                        onChange={() => { setTagMode("manual"); clearError("assetTag"); }} />
                      Zadat ručně — číslo z ABRA Gen (odepisovaný majetek)
                    </label>
                    {effectiveTagMode === "manual" ? (
                      <input id="eq-asset-tag" type="text" maxLength={40} value={manualTag}
                        onChange={(e) => { setManualTag(e.target.value); clearError("assetTag"); }}
                        aria-label="Inventární číslo z ABRA Gen" placeholder="např. 1215"
                        className={`${inputClass} max-w-xs font-mono`} {...errorProps("assetTag")} />
                    ) : null}
                  </>
                )}
                {aboveThreshold && effectiveTagMode === "series" ? (
                  <label className="flex min-h-11 items-start gap-2 rounded-lg border border-(--warning) bg-(--warning)/15 p-3">
                    <input id={assetTagTarget === "confirm" ? "eq-asset-tag" : undefined} type="checkbox"
                      checked={confirmSmall} className="mt-1"
                      onChange={(e) => { setConfirmSmall(e.target.checked); clearError("assetTag"); }}
                      {...errorProps("assetTag")} />
                    <span>Jde o drobný majetek — přesto přidělit číslo z řady.</span>
                  </label>
                ) : null}
              </div>
            )}
            {errorNode("assetTag")}
          </fieldset>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-semibold">Položka</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="eq-name" className={labelClass}>Název *</label>
              <input id="eq-name" type="text" maxLength={200} value={form.name}
                onChange={(e) => setField("name", "name", e.target.value)} className={inputClass}
                {...errorProps("name")} />
              {errorNode("name")}
            </div>
            <div>
              <label htmlFor="eq-category" className={labelClass}>Skupina *</label>
              <select id="eq-category" value={form.category_id}
                onChange={(e) => setField("category_id", "category", e.target.value)} className={inputClass}
                {...errorProps("category")}>
                <option value="">Vyberte skupinu</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errorNode("category")}
            </div>
            <div>
              <label htmlFor="eq-units" className={labelClass}>Počet kusů *</label>
              <input id="eq-units" type="text" inputMode="numeric" value={unitsText}
                onChange={(e) => { setUnitsText(e.target.value); clearError("units"); }}
                className={inputClass} {...errorProps("units")} />
              {errorNode("units")}
              <p className={hintClass}>
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
                  canEdit={false}
                />
              </div>
            ) : null}
            <div>
              <label htmlFor="eq-brand" className={labelClass}>Značka</label>
              <input id="eq-brand" type="text" maxLength={100} value={form.brand}
                onChange={(e) => setField("brand", "brand", e.target.value)} className={inputClass}
                {...errorProps("brand")} />
              {errorNode("brand")}
            </div>
            <div>
              <label htmlFor="eq-model" className={labelClass}>Model</label>
              <input id="eq-model" type="text" maxLength={100} value={form.model}
                onChange={(e) => setField("model", "model", e.target.value)} className={inputClass}
                {...errorProps("model")} />
              {errorNode("model")}
            </div>
            {multi ? (
              <fieldset className="rounded-lg border border-dashed border-border p-4 sm:col-span-2">
                <legend className="px-1 text-sm font-medium">Sériová čísla kusů (nepovinná)</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: unitCount }, (_, i) => (
                    <label key={i} className="block text-xs text-muted-foreground">
                      Kus {i + 1}
                      <input id={`eq-serial-${i}`} type="text" maxLength={100} value={serials[i] ?? ""}
                        onChange={(e) => {
                          const next = [...serials];
                          next[i] = e.target.value;
                          setSerials(next);
                          clearError("serials");
                        }}
                        className={`${inputClass} mt-0.5 font-mono text-sm text-foreground`}
                        {...(i === 0 ? errorProps("serials") : {})} />
                    </label>
                  ))}
                </div>
                {errorNode("serials")}
              </fieldset>
            ) : (
              <div>
                <label htmlFor="eq-serial-0" className={labelClass}>Sériové číslo</label>
                <input id="eq-serial-0" type="text" maxLength={100} value={serials[0] ?? ""}
                  onChange={(e) => {
                    setSerials((prev) => [e.target.value, ...prev.slice(1)]);
                    clearError("serials");
                  }}
                  className={inputClass} {...errorProps("serials")} />
                {errorNode("serials")}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-semibold">Umístění a podrobnosti</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="eq-room" className={labelClass}>Místnost</label>
              <select id="eq-room" value={form.room_id}
                onChange={(e) => setField("room_id", "room", e.target.value)} className={inputClass}
                {...errorProps("room")}>
                <option value="">— Bez místnosti —</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.code} – {r.name}</option>
                ))}
              </select>
              {errorNode("room")}
            </div>
            <div>
              <label htmlFor="eq-warranty" className={labelClass}>Záruka do</label>
              <input id="eq-warranty" type="date" value={form.warranty_until}
                onChange={(e) => setField("warranty_until", "warranty", e.target.value)} className={inputClass}
                {...errorProps("warranty")} />
              {errorNode("warranty")}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="eq-description" className={labelClass}>Popis</label>
              <textarea id="eq-description" rows={3} maxLength={5000} value={form.description}
                onChange={(e) => setField("description", "description", e.target.value)} className={inputClass}
                {...errorProps("description")} />
              {errorNode("description")}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="eq-notes" className={labelClass}>Poznámky</label>
              <textarea id="eq-notes" rows={2} maxLength={5000} value={form.notes}
                onChange={(e) => setField("notes", "notes", e.target.value)} className={inputClass}
                {...errorProps("notes")} />
              {errorNode("notes")}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={loading}
            className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {loading ? "Ukládám…" : multi ? `Zařadit ${unitsLabel(unitCount)}` : "Zařadit"}
          </button>
          <Link href="/equipment?scope=all"
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 hover:bg-muted">
            Zrušit
          </Link>
        </div>
      </form>
    </>
  );
}
