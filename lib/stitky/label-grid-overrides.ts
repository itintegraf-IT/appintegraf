import type { LabelGridSpec, LabelGridOverridesMap } from "./label-layout";

export type { LabelGridOverridesMap };

const OVERRIDE_KEYS: (keyof LabelGridSpec)[] = [
  "pageMarginMm",
  "colGapMm",
  "rowGapMm",
  "labelWidthMm",
  "labelHeightMm",
];

export function parseLabelGridOverrides(raw: unknown): LabelGridOverridesMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: LabelGridOverridesMap = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== "object" || Array.isArray(val)) continue;
    const partial: Partial<LabelGridSpec> = {};
    for (const k of OVERRIDE_KEYS) {
      const n = (val as Record<string, unknown>)[k];
      if (n != null && !Number.isNaN(Number(n))) {
        partial[k] = Number(n);
      }
    }
    if (Object.keys(partial).length > 0) out[key] = partial;
  }
  return out;
}

export function parseLabelGridOverridesFromSettingsValue(value: string | null | undefined): LabelGridOverridesMap {
  if (!value?.trim()) return {};
  try {
    return parseLabelGridOverrides(JSON.parse(value));
  } catch {
    return {};
  }
}

export function serializeLabelGridOverrides(map: LabelGridOverridesMap): string {
  return JSON.stringify(map);
}
