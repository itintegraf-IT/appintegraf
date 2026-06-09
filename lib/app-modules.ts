/** Centrální seznam aplikačních modulů pro oprávnění uživatelů. */

export const APP_MODULE_KEYS = [
  "contacts",
  "equipment",
  "calendar",
  "planovani",
  "vyroba",
  "contracts",
  "kiosk",
  "training",
  "iml",
  "materialy",
  "ukoly",
  "makety",
  "personalistika",
  "crm",
] as const;

export type AppModuleKey = (typeof APP_MODULE_KEYS)[number];

export function expandAllModuleAccess(level = "admin"): Record<string, string> {
  return Object.fromEntries(APP_MODULE_KEYS.map((k) => [k, level]));
}

export function parseStoredModuleAccess(raw: unknown): Record<string, string> {
  if (typeof raw === "string") {
    try {
      return parseStoredModuleAccess(JSON.parse(raw));
    } catch {
      return {};
    }
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const decoded = raw as Record<string, unknown>;
  if (decoded.all === true) {
    return expandAllModuleAccess("admin");
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(decoded)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
}
