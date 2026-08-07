import { prisma } from "@/lib/db";
import {
  parseLabelGridOverridesFromSettingsValue,
  type LabelGridOverridesMap,
} from "./label-grid-overrides";

let cached: { at: number; value: LabelGridOverridesMap } | null = null;
const CACHE_MS = 30_000;

export async function loadLabelGridOverrides(): Promise<LabelGridOverridesMap> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.value;

  const row = await prisma.stitky_settings.findUnique({
    where: { key: "label_grid_overrides" },
  });
  const value = parseLabelGridOverridesFromSettingsValue(row?.value);
  cached = { at: now, value };
  return value;
}

export function invalidateLabelGridOverridesCache(): void {
  cached = null;
}
