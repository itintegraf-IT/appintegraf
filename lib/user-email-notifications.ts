/** Moduly, které dnes odesílají e-mailové notifikace (ne auth e-maily). */
export const EMAIL_NOTIFICATION_MODULES = [
  "calendar",
  "ukoly",
  "makety",
  "stitky",
  "equipment",
] as const;

export type EmailNotificationModule = (typeof EMAIL_NOTIFICATION_MODULES)[number];

export type EmailNotificationsMap = Record<EmailNotificationModule, boolean>;

export const EMAIL_NOTIFICATION_MODULE_LABELS: Record<EmailNotificationModule, string> = {
  calendar: "Kalendář",
  ukoly: "Úkoly",
  makety: "Makety a grafika",
  stitky: "Štítky výroba",
  equipment: "Majetek",
};

function isEmailNotificationModule(key: string): key is EmailNotificationModule {
  return (EMAIL_NOTIFICATION_MODULES as readonly string[]).includes(key);
}

/** Všechny e-mailové notifikace zapnuté (výchozí / legacy). */
export function defaultEmailNotifications(): EmailNotificationsMap {
  return {
    calendar: true,
    ukoly: true,
    makety: true,
    stitky: true,
    equipment: true,
  };
}

/**
 * Parsuje JSON z DB. Chybějící klíč = zapnuto (zachování současného chování).
 */
export function parseEmailNotifications(raw: unknown): EmailNotificationsMap {
  const result = defaultEmailNotifications();

  let obj: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return result;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      return result;
    }
  }

  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return result;
  }

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (!isEmailNotificationModule(key)) continue;
    if (typeof value === "boolean") {
      result[key] = value;
    } else if (value === 0 || value === "0" || value === "false") {
      result[key] = false;
    } else if (value === 1 || value === "1" || value === "true") {
      result[key] = true;
    }
  }

  return result;
}

/** Normalizace vstupu z admin UI / API před uložením. */
export function normalizeEmailNotifications(input: unknown): EmailNotificationsMap {
  return parseEmailNotifications(input);
}

export function serializeEmailNotifications(prefs: EmailNotificationsMap): string {
  return JSON.stringify(prefs);
}

export function isEmailNotificationEnabled(
  prefs: EmailNotificationsMap | null | undefined,
  module: EmailNotificationModule
): boolean {
  if (!prefs) return true;
  return prefs[module] !== false;
}
