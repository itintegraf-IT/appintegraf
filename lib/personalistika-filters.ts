import { EDUCATION_LEVELS, WORK_TYPES } from "@/lib/personalistika-db";

export const DATE_PRESETS = [
  { value: "all", label: "Vše" },
  { value: "last_month", label: "Poslední měsíc" },
  { value: "last_3_months", label: "Poslední 3 měsíce" },
  { value: "last_6_months", label: "Poslední půl roku" },
  { value: "last_year", label: "Poslední rok" },
  { value: "custom", label: "Konkrétní datum" },
] as const;

export type DatePreset = (typeof DATE_PRESETS)[number]["value"];

export type ApplicationFilters = {
  q?: string;
  status?: string | null;
  positionId?: number | null;
  workType?: string | null;
  educationLevel?: string | null;
  city?: string | null;
  datePreset?: DatePreset | null;
  dateFrom?: string | null;
};

export function normalizeDatePreset(input: string | null | undefined): DatePreset {
  const val = String(input ?? "").trim().toLowerCase();
  if (DATE_PRESETS.some((p) => p.value === val)) return val as DatePreset;
  return "all";
}

export function buildApplicationsWhereClause(filters: ApplicationFilters): {
  whereSql: string;
  params: unknown[];
} {
  const whereParts: string[] = [];
  const params: unknown[] = [];

  const q = String(filters.q ?? "").trim();
  if (q) {
    whereParts.push(
      `(a.first_name LIKE ? OR a.last_name LIKE ? OR a.email LIKE ? OR a.phone LIKE ? OR a.position_name LIKE ?)`
    );
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }

  const status = String(filters.status ?? "").trim();
  if (status && status !== "all") {
    whereParts.push(`a.status = ?`);
    params.push(status);
  }

  if (filters.positionId) {
    whereParts.push(`a.position_id = ?`);
    params.push(filters.positionId);
  }

  const workType = String(filters.workType ?? "").trim();
  if (workType && workType !== "all") {
    whereParts.push(`JSON_UNQUOTE(JSON_EXTRACT(a.details_json, '$.work_type')) = ?`);
    params.push(workType);
  }

  const educationLevel = String(filters.educationLevel ?? "").trim();
  if (educationLevel && educationLevel !== "all") {
    whereParts.push(`JSON_UNQUOTE(JSON_EXTRACT(a.details_json, '$.education_level')) = ?`);
    params.push(educationLevel);
  }

  const city = String(filters.city ?? "").trim();
  if (city && city !== "all") {
    whereParts.push(`JSON_UNQUOTE(JSON_EXTRACT(a.details_json, '$.correspondence_address.city')) LIKE ?`);
    params.push(`%${city}%`);
  }

  const datePreset = normalizeDatePreset(filters.datePreset ?? "all");
  if (datePreset === "last_month") {
    whereParts.push(`a.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)`);
  } else if (datePreset === "last_3_months") {
    whereParts.push(`a.created_at >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)`);
  } else if (datePreset === "last_6_months") {
    whereParts.push(`a.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)`);
  } else if (datePreset === "last_year") {
    whereParts.push(`a.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)`);
  } else if (datePreset === "custom") {
    const dateFrom = String(filters.dateFrom ?? "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      whereParts.push(`DATE(a.created_at) >= ?`);
      params.push(dateFrom);
    }
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
  return { whereSql, params };
}

export function getFilterOptionsMetadata() {
  return {
    educationLevels: [{ value: "all", label: "Vše" }, ...EDUCATION_LEVELS],
    workTypes: [{ value: "all", label: "Vše" }, ...WORK_TYPES],
    datePresets: DATE_PRESETS,
  };
}
