"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CHECKLIST_LABELS,
  CHECKLIST_PLACEHOLDERS,
  ONBOARDING_HR_KEYS,
  ONBOARDING_IT_KEYS,
  OFFBOARDING_KEYS,
  isPhoneOrComputerEquipment,
  type ChecklistItemKey,
  type ChecklistMap,
  type EmploymentType,
  type EmployeeStatus,
} from "@/lib/personalistika-employee-types";

export type EmployeeEquipment = {
  assignment_id: number;
  assigned_at: string;
  equipment_id: number;
  name: string;
  asset_tag: string | null;
  serial_number: string | null;
  status: string | null;
  category_name?: string | null;
  category_code?: string | null;
};

export type EmployeeFormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  personal_phone: string;
  personal_email: string;
  position_title: string;
  position_id: number | null;
  department_id: number | null;
  employment_type: EmploymentType;
  start_date: string;
  end_date: string;
  status: EmployeeStatus;
  notes: string;
  onboarding: ChecklistMap;
  offboarding: ChecklistMap;
};

export const EMPTY_EMPLOYEE_FORM: EmployeeFormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  personal_phone: "",
  personal_email: "",
  position_title: "",
  position_id: null,
  department_id: null,
  employment_type: "thp",
  start_date: "",
  end_date: "",
  status: "active",
  notes: "",
  onboarding: {},
  offboarding: {},
};

export type EmployeeFormOption = { id: number; name: string };

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500";

function ChecklistCard({
  title,
  description,
  keys,
  values,
  canWrite,
  onChange,
  phonePcEquipment = [],
  companyEmail = "",
}: {
  title: string;
  description: string;
  keys: readonly ChecklistItemKey[];
  values: ChecklistMap;
  canWrite: boolean;
  onChange: (next: ChecklistMap) => void;
  phonePcEquipment?: EmployeeEquipment[];
  companyEmail?: string;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-xs text-gray-500">{description}</p>
      <div className="mt-3 space-y-3">
        {keys.map((key) => {
          const item = values[key] ?? { done: false, note: "" };
          const showEquipment = key === "phone_pc";
          const showEmail = key === "company_email";
          const done = !!item.done;
          const emailTrimmed = companyEmail.trim();
          return (
            <div
              key={key}
              className={`rounded-lg border p-3 transition-colors ${
                done
                  ? "border-emerald-300 bg-emerald-50/80"
                  : "border-amber-200 bg-amber-50/50"
              }`}
            >
              <label
                className={`flex items-start gap-2 text-sm ${
                  done ? "text-emerald-950" : "text-amber-950"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={done}
                  disabled={!canWrite}
                  onChange={(e) =>
                    onChange({
                      ...values,
                      [key]: { ...item, done: e.target.checked, note: item.note ?? "" },
                    })
                  }
                />
                <span className="font-medium">
                  {CHECKLIST_LABELS[key]}
                  <span
                    className={`ml-2 text-[10px] font-semibold uppercase tracking-wide ${
                      done ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    {done ? "Hotovo" : "Čeká"}
                  </span>
                </span>
              </label>
              {showEquipment && (
                <div
                  className={`mt-2 rounded-md border px-3 py-2 ${
                    done ? "border-emerald-200 bg-white/80" : "border-amber-200 bg-white/80"
                  }`}
                >
                  {phonePcEquipment.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      Žádný telefon ani počítač v majetku není přiřazen.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {phonePcEquipment.map((eq) => (
                        <li
                          key={eq.assignment_id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <div>
                            <div className="font-medium text-gray-900">{eq.name}</div>
                            <div className="text-xs text-gray-500">
                              {[eq.category_name, eq.asset_tag, eq.serial_number]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </div>
                          </div>
                          <Link
                            href={`/equipment/${eq.equipment_id}`}
                            className="shrink-0 text-xs font-medium text-red-700 hover:underline"
                          >
                            Majetek
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {showEmail && (
                <div
                  className={`mt-2 rounded-md border px-3 py-2 text-sm ${
                    done ? "border-emerald-200 bg-white/80" : "border-amber-200 bg-white/80"
                  }`}
                >
                  {emailTrimmed ? (
                    <div>
                      <div className="font-medium text-gray-900">{emailTrimmed}</div>
                      <div className="text-xs text-gray-500">E-mail z kontaktu / uživatele</div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">E-mail u kontaktu není vyplněn.</p>
                  )}
                </div>
              )}
              <input
                value={item.note ?? ""}
                disabled={!canWrite}
                onChange={(e) =>
                  onChange({
                    ...values,
                    [key]: { ...item, done: !!item.done, note: e.target.value },
                  })
                }
                placeholder={
                  (showEquipment && phonePcEquipment.length > 0) || (showEmail && emailTrimmed)
                    ? "Poznámka"
                    : CHECKLIST_PLACEHOLDERS[key]
                }
                className={`${inputCls} mt-2 ${
                  done ? "border-emerald-200 bg-white" : "border-amber-200 bg-white"
                }`}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function EmployeeForm({
  form,
  setForm,
  canWrite,
  equipment,
  userId,
  isNew,
  positions = [],
  departments = [],
}: {
  form: EmployeeFormState;
  setForm: React.Dispatch<React.SetStateAction<EmployeeFormState>>;
  canWrite: boolean;
  equipment: EmployeeEquipment[];
  userId?: number | null;
  isNew: boolean;
  positions?: EmployeeFormOption[];
  departments?: EmployeeFormOption[];
}) {
  const phonePcEquipment = useMemo(
    () => equipment.filter(isPhoneOrComputerEquipment),
    [equipment]
  );

  const onboardingPhonePcDone = !!form.onboarding.phone_pc?.done;
  const onboardingCompanyEmailDone = !!form.onboarding.company_email?.done;

  // Telefon/PC z majetku: auto jen u nástupu (výstup = ruční vrácení, nesmí se přepisovat).
  useEffect(() => {
    if (isNew || phonePcEquipment.length === 0 || onboardingPhonePcDone) return;
    const names = phonePcEquipment.map((e) => e.name).join(", ");
    setForm((f) => {
      const onItem = f.onboarding.phone_pc ?? { done: false, note: "" };
      if (onItem.done) return f;
      const note = onItem.note?.trim() === names ? "" : onItem.note ?? "";
      return {
        ...f,
        onboarding: {
          ...f.onboarding,
          phone_pc: { ...onItem, done: true, note },
        },
      };
    });
  }, [isNew, phonePcEquipment, onboardingPhonePcDone, setForm]);

  // E-mail z kontaktu: auto jen u nástupu; zrušení mailu při výstupu zůstává ruční.
  useEffect(() => {
    const email = form.email.trim();
    if (isNew || !email || onboardingCompanyEmailDone) return;
    setForm((f) => {
      const onItem = f.onboarding.company_email ?? { done: false, note: "" };
      if (onItem.done) return f;
      const note =
        onItem.note?.trim().toLowerCase() === email.toLowerCase() ? "" : onItem.note ?? "";
      return {
        ...f,
        onboarding: {
          ...f.onboarding,
          company_email: { ...onItem, done: true, note },
        },
      };
    });
  }, [isNew, form.email, onboardingCompanyEmailDone, setForm]);

  const [sectionTab, setSectionTab] = useState<"personal" | "onboarding" | "offboarding">(
    "personal"
  );

  const otherEquipment = useMemo(
    () => equipment.filter((eq) => !isPhoneOrComputerEquipment(eq)),
    [equipment]
  );

  const tabBtn = (id: typeof sectionTab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setSectionTab(id)}
      className={`rounded-md px-3 py-2 text-sm ${
        sectionTab === id ? "bg-gray-100 font-medium text-gray-900" : "text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit">
        {tabBtn("personal", "Personální údaje")}
        {tabBtn("onboarding", "Nástup")}
        {tabBtn("offboarding", "Ukončení PP")}
      </div>

      {sectionTab === "personal" && (
        <div className="space-y-4">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Personální údaje</h3>
          <p className="mt-1 text-xs text-gray-500">
            {isNew
              ? "Při uložení se založí účet v uživatelích / kontaktech (bez modulů, mimo seznam kontaktů)."
              : userId
                ? `Provázáno s uživatelem #${userId}. Moduly a viditelnost v kontaktech nastaví admin.`
                : "Provázáno s uživatelem aplikace."}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Jméno *</label>
              <input
                className={inputCls}
                value={form.first_name}
                disabled={!canWrite}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Příjmení *</label>
              <input
                className={inputCls}
                value={form.last_name}
                disabled={!canWrite}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>E-mail *</label>
              <input
                type="email"
                className={inputCls}
                value={form.email}
                disabled={!canWrite}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Telefon</label>
              <input
                className={inputCls}
                value={form.phone}
                disabled={!canWrite}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Osobní telefon</label>
              <input
                className={inputCls}
                value={form.personal_phone}
                disabled={!canWrite}
                onChange={(e) => setForm((f) => ({ ...f, personal_phone: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Osobní e-mail</label>
              <input
                type="email"
                className={inputCls}
                value={form.personal_email}
                disabled={!canWrite}
                onChange={(e) => setForm((f) => ({ ...f, personal_email: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Pozice (katalog)</label>
              <select
                className={inputCls}
                value={form.position_id ?? ""}
                disabled={!canWrite}
                onChange={(e) => {
                  const id = e.target.value ? parseInt(e.target.value, 10) : null;
                  const name = id ? positions.find((p) => p.id === id)?.name ?? "" : "";
                  setForm((f) => ({
                    ...f,
                    position_id: id,
                    position_title: name || f.position_title,
                  }));
                }}
              >
                <option value="">— Bez katalogové pozice —</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Pozice / pracovní zařazení</label>
              <input
                className={inputCls}
                value={form.position_title}
                disabled={!canWrite}
                onChange={(e) => setForm((f) => ({ ...f, position_title: e.target.value }))}
                placeholder="Volný text, pokud není v katalogu"
              />
            </div>
            <div>
              <label className={labelCls}>Oddělení</label>
              <select
                className={inputCls}
                value={form.department_id ?? ""}
                disabled={!canWrite}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    department_id: e.target.value ? parseInt(e.target.value, 10) : null,
                  }))
                }
              >
                <option value="">— Bez oddělení —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Typ pozice *</label>
              <select
                className={inputCls}
                value={form.employment_type}
                disabled={!canWrite}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    employment_type: e.target.value === "delnik" ? "delnik" : "thp",
                  }))
                }
              >
                <option value="thp">THP</option>
                <option value="delnik">Dělnická</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Datum nástupu</label>
              <input
                type="date"
                className={inputCls}
                value={form.start_date}
                disabled={!canWrite}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Stav</label>
              <select
                className={inputCls}
                value={form.status}
                disabled={!canWrite}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value === "terminated" ? "terminated" : "active",
                    end_date:
                      e.target.value === "terminated"
                        ? f.end_date || new Date().toISOString().slice(0, 10)
                        : "",
                  }))
                }
              >
                <option value="active">Aktivní</option>
                <option value="terminated">Ukončený PP</option>
              </select>
            </div>
            {form.status === "terminated" && (
              <div>
                <label className={labelCls}>Datum ukončení</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.end_date}
                  disabled={!canWrite}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className={labelCls}>Poznámka</label>
              <textarea
                className={inputCls}
                rows={2}
                value={form.notes}
                disabled={!canWrite}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
        </section>

        {!isNew && (
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Přidělený majetek</h3>
            <p className="mt-1 text-xs text-gray-500">
              Aktivní přiřazení z evidence majetku — jen přehled.
            </p>
            {equipment.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">Žádný aktivně přidělený majetek.</p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-100">
                {equipment.map((eq) => (
                  <li
                    key={eq.assignment_id}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{eq.name}</div>
                      <div className="text-xs text-gray-500">
                        {[eq.category_name, eq.asset_tag, eq.serial_number]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </div>
                    <Link
                      href={`/equipment/${eq.equipment_id}`}
                      className="shrink-0 text-xs font-medium text-red-700 hover:underline"
                    >
                      Majetek
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        </div>
      )}

      {sectionTab === "onboarding" && (
        <div className="space-y-4">
          <ChecklistCard
            title="Nástup — personalistika"
            description="Docházka, skříňka, klíče a přístupy v budově. Vidí a může vyplnit personalista i IT."
            keys={ONBOARDING_HR_KEYS}
            values={form.onboarding}
            canWrite={canWrite}
            onChange={(onboarding) => setForm((f) => ({ ...f, onboarding }))}
          />
          <ChecklistCard
            title="Nástup — IT"
            description="Čip IS, VPN. Telefon/PC z Majetku, firemní e-mail z kontaktu."
            keys={ONBOARDING_IT_KEYS}
            values={form.onboarding}
            canWrite={canWrite}
            onChange={(onboarding) => setForm((f) => ({ ...f, onboarding }))}
            phonePcEquipment={isNew ? [] : phonePcEquipment}
            companyEmail={form.email}
          />
          {!isNew && (
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900">Ostatní přiřazený majetek</h3>
              <p className="mt-1 text-xs text-gray-500">
                Položky mimo telefon/PC (telefon a PC jsou u položky výše).
              </p>
              {otherEquipment.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">Žádný další přiřazený majetek.</p>
              ) : (
                <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-100">
                  {otherEquipment.map((eq) => (
                    <li
                      key={eq.assignment_id}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{eq.name}</div>
                        <div className="text-xs text-gray-500">
                          {[eq.category_name, eq.asset_tag, eq.serial_number]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </div>
                      </div>
                      <Link
                        href={`/equipment/${eq.equipment_id}`}
                        className="shrink-0 text-xs font-medium text-red-700 hover:underline"
                      >
                        Otevřít
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      {sectionTab === "offboarding" && (
        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Datum ukončení PP</h3>
            <p className="mt-1 text-xs text-gray-500">
              Ke kterému dni je pracovní poměr ukončen. Při vyplnění data se stav přepne na ukončený.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Datum ukončení *</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.end_date}
                  disabled={!canWrite}
                  onChange={(e) => {
                    const end_date = e.target.value;
                    setForm((f) => ({
                      ...f,
                      end_date,
                      status: end_date ? "terminated" : f.status,
                    }));
                  }}
                />
              </div>
              <div>
                <label className={labelCls}>Stav</label>
                <select
                  className={inputCls}
                  value={form.status}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value === "terminated" ? "terminated" : "active",
                      end_date:
                        e.target.value === "active" ? "" : f.end_date,
                    }))
                  }
                >
                  <option value="active">Aktivní</option>
                  <option value="terminated">Ukončený PP</option>
                </select>
              </div>
            </div>
          </section>
          <ChecklistCard
            title="Ukončení pracovního poměru"
            description="Potvrzení, že bylo vše odebráno a vráceno. Stejné položky jako u nástupu."
            keys={OFFBOARDING_KEYS}
            values={form.offboarding}
            canWrite={canWrite}
            onChange={(offboarding) => setForm((f) => ({ ...f, offboarding }))}
            phonePcEquipment={isNew ? [] : phonePcEquipment}
            companyEmail={form.email}
          />
        </div>
      )}
    </div>
  );
}
