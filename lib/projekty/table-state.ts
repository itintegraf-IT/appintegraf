import type { ColumnSizingState } from "@tanstack/react-table";

const VERSION = "v1";
const PREFIX = "crm.colsizes";

function storageKey(tableKey: string): string {
  return `${PREFIX}.${tableKey}.${VERSION}`;
}

export function loadColumnSizing(tableKey: string): ColumnSizingState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(tableKey));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as ColumnSizingState;
  } catch {
    return {};
  }
}

export function saveColumnSizing(tableKey: string, sizing: ColumnSizingState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(tableKey), JSON.stringify(sizing));
  } catch {
    // localStorage full / disabled / private mode — silently ignore
  }
}
