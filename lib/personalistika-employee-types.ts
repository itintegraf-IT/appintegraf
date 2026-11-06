/** Client-safe typy a konstanty zaměstnanců (bez DB / Node závislostí). */

export const EMPLOYMENT_TYPES = ["thp", "delnik"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYEE_STATUSES = ["active", "terminated"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const ONBOARDING_HR_KEYS = [
  "attendance",
  "locker",
  "keys",
  "building_access",
] as const;

export const ONBOARDING_IT_KEYS = [
  "chip_is",
  "phone_pc",
  "company_email",
  "vpn",
  "it_other",
] as const;

export const OFFBOARDING_KEYS = [
  ...ONBOARDING_HR_KEYS,
  ...ONBOARDING_IT_KEYS,
] as const;

export type ChecklistItemKey =
  | (typeof ONBOARDING_HR_KEYS)[number]
  | (typeof ONBOARDING_IT_KEYS)[number];

export type ChecklistItem = {
  done: boolean;
  note?: string;
  at?: string | null;
  by?: number | null;
};

export type ChecklistMap = Partial<Record<ChecklistItemKey, ChecklistItem>>;

export type EmployeeRow = {
  id: number;
  user_id: number;
  application_id: number | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  personal_phone: string | null;
  personal_email: string | null;
  position_title: string | null;
  department_id: number | null;
  employment_type: EmploymentType;
  start_date: Date | string | null;
  end_date: Date | string | null;
  status: EmployeeStatus;
  notes: string | null;
  onboarding_json: string | null;
  offboarding_json: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Date;
  updated_at: Date;
};

export function normalizeEmploymentType(input: unknown): EmploymentType {
  const val = String(input ?? "").trim().toLowerCase();
  return val === "delnik" ? "delnik" : "thp";
}

export function normalizeEmployeeStatus(input: unknown): EmployeeStatus {
  const val = String(input ?? "").trim().toLowerCase();
  return val === "terminated" ? "terminated" : "active";
}

export function parseChecklistJson(raw: unknown): ChecklistMap {
  if (!raw) return {};
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!obj || typeof obj !== "object") return {};
  const out: ChecklistMap = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    out[key as ChecklistItemKey] = {
      done: !!item.done,
      note: typeof item.note === "string" ? item.note : "",
      at: typeof item.at === "string" ? item.at : null,
      by: typeof item.by === "number" ? item.by : item.by != null ? Number(item.by) || null : null,
    };
  }
  return out;
}

export function serializeChecklistJson(map: ChecklistMap | null | undefined): string {
  return JSON.stringify(map ?? {});
}

/** Heuristika: telefon / notebook / PC podle kategorie nebo názvu. */
export function isPhoneOrComputerEquipment(item: {
  name?: string | null;
  category_name?: string | null;
  category_code?: string | null;
}): boolean {
  const hay = [item.category_code, item.category_name, item.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return (
    /\b(telefon|mobil|phone|smartphone|iphone|motorola|samsung|xiaomi)\b/.test(hay) ||
    /\b(notebook|laptop|desktop|pocitac|pc|computer|imac|macbook)\b/.test(hay) ||
    /\b(tel|mob|nb|lap)\b/.test(hay)
  );
}
