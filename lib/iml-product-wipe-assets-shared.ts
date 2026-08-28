import { imlItemStatusLabel } from "@/lib/iml-constants";

/** Stavy položky, u kterých smí admin smazat tisková data a softproof. */
export const IML_WIPE_ASSET_STATUSES = [
  "zablokovaná",
  "neaktivní",
  "chyba",
] as const;

/** Sentinel pro položky bez vyplněného stavu (`item_status` null / prázdný). */
export const IML_WIPE_STATUS_NONE = "__none__";

export type ImlWipeAssetStatus = (typeof IML_WIPE_ASSET_STATUSES)[number];

/** Všechny volby ve filtru mazání (stavy + bez stavu). */
export const IML_WIPE_SELECTABLE_STATUSES = [
  ...IML_WIPE_ASSET_STATUSES,
  IML_WIPE_STATUS_NONE,
] as const;

export type ImlWipeSelectableStatus = (typeof IML_WIPE_SELECTABLE_STATUSES)[number];

export const IML_WIPE_ASSETS_DEFAULT_BATCH = 20;

export function wipeStatusLabel(status: string): string {
  if (status === IML_WIPE_STATUS_NONE) return "bez stavu";
  return imlItemStatusLabel(status);
}

export function isWipeAssetStatus(value: string): value is ImlWipeAssetStatus {
  return (IML_WIPE_ASSET_STATUSES as readonly string[]).includes(value);
}

export function isWipeSelectableStatus(value: string): value is ImlWipeSelectableStatus {
  return (IML_WIPE_SELECTABLE_STATUSES as readonly string[]).includes(value);
}

export function isProductStatusEmpty(status: string | null | undefined): boolean {
  return !status?.trim();
}
