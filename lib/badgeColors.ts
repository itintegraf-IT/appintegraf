export const BADGE_COLOR_KEYS = [
  "blue",
  "green",
  "orange",
  "red",
  "purple",
  "cyan",
  "lime",
  "pink",
  "black",
] as const;

export type BadgeColorKey = (typeof BADGE_COLOR_KEYS)[number];

export const BADGE_COLOR_LABELS: Record<BadgeColorKey, string> = {
  blue: "Modrá",
  green: "Zelená",
  orange: "Oranžová",
  red: "Červená",
  purple: "Fialová",
  cyan: "Tyrkysová",
  lime: "Žlutá",
  pink: "Růžová",
  black: "Černá",
};

export function badgeColorVar(key: string | null | undefined): string | null {
  if (!key || !BADGE_COLOR_KEYS.includes(key as BadgeColorKey)) return null;
  return `var(--badge-${key})`;
}

export function parseBadgeColor(value: unknown): { color: string | null } | { error: string } {
  if (value === undefined || value === null) return { color: null };
  if (typeof value !== "string") return { error: "badgeColor musí být string nebo null" };
  if (!BADGE_COLOR_KEYS.includes(value as BadgeColorKey)) {
    return { error: `Neplatná hodnota badgeColor: "${value}"` };
  }
  return { color: value };
}
