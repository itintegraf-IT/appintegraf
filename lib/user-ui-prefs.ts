/**
 * Per-user UI preferences stored as JSON on users.ui_prefs.
 * Keys match prepared product/makety column pref identifiers.
 */

export const USER_UI_PREF_KEYS = [
  "iml_products_columns",
  "iml_products_column_widths",
  "makety-list-visible-columns",
  "makety-archive-list-visible-columns",
] as const;

export type UserUiPrefKey = (typeof USER_UI_PREF_KEYS)[number];

export type UserUiPrefsMap = Partial<Record<UserUiPrefKey, unknown>>;

export function isUserUiPrefKey(key: string): key is UserUiPrefKey {
  return (USER_UI_PREF_KEYS as readonly string[]).includes(key);
}

export function parseUserUiPrefs(raw: string | null | undefined): UserUiPrefsMap {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: UserUiPrefsMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (isUserUiPrefKey(k) && v !== undefined) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeUserUiPrefs(prefs: UserUiPrefsMap): string {
  const clean: UserUiPrefsMap = {};
  for (const key of USER_UI_PREF_KEYS) {
    if (prefs[key] !== undefined) clean[key] = prefs[key];
  }
  return JSON.stringify(clean);
}

/** Merge patch into existing prefs (undefined values remove the key). */
export function mergeUserUiPrefs(
  current: UserUiPrefsMap,
  patch: Record<string, unknown>
): UserUiPrefsMap {
  const next: UserUiPrefsMap = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (!isUserUiPrefKey(k)) continue;
    if (v === null || v === undefined) {
      delete next[k];
    } else {
      next[k] = v;
    }
  }
  return next;
}
