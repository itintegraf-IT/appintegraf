export type ListColor = {
  /** Perzistentní klíč ukládaný v DB (BoardList.color). */
  value: string;
  /** CSS color pro 8 px tečku v hlavičce (plná sytost, bez alpha). */
  dot: string;
  /** CSS color pro background sloupce (5–7 % alpha — velmi jemný tint). */
  bgTint: string;
  /** CSS color pro counter pill bg + "+ Nová karta" CTA hover bg (10–15 % alpha). */
  pillBg: string;
  /** CSS color pro counter pill text + "+ Nová karta" CTA text (plná sytost, bez alpha). */
  ctaText: string;
  /** Lidský label (CZ) pro picker tooltip + a11y. */
  label: string;
};

export const LIST_PRESET_COLORS: readonly ListColor[] = [
  {
    value: "neutral",
    dot: "hsl(215 16% 47%)",
    bgTint: "hsl(215 16% 47% / 0.05)",
    pillBg: "hsl(215 16% 47% / 0.10)",
    ctaText: "hsl(215 16% 47%)",
    label: "Neutrální",
  },
  {
    value: "info",
    dot: "hsl(var(--info))",
    bgTint: "hsl(var(--info) / 0.06)",
    pillBg: "hsl(var(--info) / 0.12)",
    ctaText: "hsl(var(--info))",
    label: "Info",
  },
  {
    value: "purple",
    dot: "hsl(270 70% 55%)",
    bgTint: "hsl(270 70% 55% / 0.06)",
    pillBg: "hsl(270 70% 55% / 0.12)",
    ctaText: "hsl(270 70% 55%)",
    label: "Fialová",
  },
  {
    value: "warning",
    dot: "hsl(var(--warning))",
    bgTint: "hsl(var(--warning) / 0.07)",
    pillBg: "hsl(var(--warning) / 0.14)",
    ctaText: "hsl(var(--warning))",
    label: "Warning",
  },
  {
    value: "success",
    dot: "hsl(var(--success))",
    bgTint: "hsl(var(--success) / 0.06)",
    pillBg: "hsl(var(--success) / 0.12)",
    ctaText: "hsl(var(--success))",
    label: "Success",
  },
  {
    value: "destructive",
    dot: "hsl(var(--destructive))",
    bgTint: "hsl(var(--destructive) / 0.06)",
    pillBg: "hsl(var(--destructive) / 0.12)",
    ctaText: "hsl(var(--destructive))",
    label: "Destructive",
  },
  {
    value: "cyan",
    dot: "hsl(190 75% 45%)",
    bgTint: "hsl(190 75% 45% / 0.06)",
    pillBg: "hsl(190 75% 45% / 0.12)",
    ctaText: "hsl(190 75% 45%)",
    label: "Azurová",
  },
  {
    value: "pink",
    dot: "hsl(330 75% 55%)",
    bgTint: "hsl(330 75% 55% / 0.06)",
    pillBg: "hsl(330 75% 55% / 0.12)",
    ctaText: "hsl(330 75% 55%)",
    label: "Růžová",
  },
] as const;

export const LIST_COLOR_VALUES = LIST_PRESET_COLORS.map((c) => c.value);

const NEUTRAL: ListColor = LIST_PRESET_COLORS[0]!;

export function defaultListColor(existingCount: number): ListColor {
  return LIST_PRESET_COLORS[existingCount % LIST_PRESET_COLORS.length] ?? NEUTRAL;
}

export function findListColor(value: string | null): ListColor {
  if (!value) return NEUTRAL;
  return LIST_PRESET_COLORS.find((c) => c.value === value) ?? NEUTRAL;
}
