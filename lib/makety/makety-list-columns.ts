/**
 * Metadata sloupců seznamu aktivních zakázek makety/grafika (bez JSX).
 */

export const MAKETY_LIST_COLUMNS_STORAGE_KEY = "makety-list-visible-columns";
export const MAKETY_LIST_COLUMNS_PREF_VERSION = 2 as const;

export type MaketyListColumnId =
  | "due_at"
  | "work_type"
  | "order_number"
  | "body"
  | "creator"
  | "assignee"
  | "priority"
  | "status"
  | "data_kind"
  | "customer"
  | "label_code"
  | "job_number"
  | "actions";

export type MaketyListColumnGroup = "zaklad" | "iml" | "ostatni";

export type MaketyListColumnMeta = {
  id: MaketyListColumnId;
  label: string;
  group: MaketyListColumnGroup;
  defaultVisible: boolean;
  /** Jen pro adminy modulu (sloupec Zadal). */
  adminOnly?: boolean;
  locked?: boolean;
};

export type MaketyListColumnPrefs = {
  version: typeof MAKETY_LIST_COLUMNS_PREF_VERSION;
  visibleColumnIds: MaketyListColumnId[];
};

export type MaketyListRow = {
  id: number;
  due_at: string;
  work_type: string;
  order_number: string | null;
  body: string;
  priority: string;
  status: string;
  data_kind: string;
  label_code: string | null;
  job_number: string | null;
  creator_name: string | null;
  assignee_name: string | null;
  customer_name: string | null;
  created_by: number;
  can_edit: boolean;
  can_copy: boolean;
};

export const MAKETY_LIST_COLUMN_GROUPS: Array<{
  id: MaketyListColumnGroup;
  label: string;
}> = [
  { id: "zaklad", label: "Základ" },
  { id: "iml", label: "IML katalog" },
  { id: "ostatni", label: "Ostatní" },
];

export const MAKETY_LIST_COLUMNS: MaketyListColumnMeta[] = [
  { id: "due_at", label: "Termín", group: "zaklad", defaultVisible: true },
  { id: "work_type", label: "Typ", group: "zaklad", defaultVisible: true },
  { id: "order_number", label: "Zakázka", group: "zaklad", defaultVisible: true },
  { id: "body", label: "Popis", group: "zaklad", defaultVisible: true },
  {
    id: "creator",
    label: "Zadal",
    group: "zaklad",
    defaultVisible: true,
    adminOnly: true,
  },
  { id: "assignee", label: "Přiřazeno", group: "zaklad", defaultVisible: true },
  { id: "priority", label: "Priorita", group: "zaklad", defaultVisible: true },
  { id: "status", label: "Stav", group: "zaklad", defaultVisible: true },
  { id: "data_kind", label: "Typ dat", group: "zaklad", defaultVisible: false },
  { id: "customer", label: "Klient", group: "iml", defaultVisible: false },
  { id: "label_code", label: "Kód etikety", group: "iml", defaultVisible: false },
  { id: "job_number", label: "Číslo zakázky (ERP)", group: "iml", defaultVisible: false },
  { id: "actions", label: "Akce", group: "ostatni", defaultVisible: true, locked: true },
];

const COLUMN_IDS = new Set<string>(MAKETY_LIST_COLUMNS.map((c) => c.id));

export function isKnownMaketyListColumnId(id: string): id is MaketyListColumnId {
  return COLUMN_IDS.has(id);
}

export function getMaketyListColumnMeta(id: MaketyListColumnId): MaketyListColumnMeta | undefined {
  return MAKETY_LIST_COLUMNS.find((c) => c.id === id);
}

export function availableMaketyListColumns(canModuleAdmin: boolean): MaketyListColumnMeta[] {
  return MAKETY_LIST_COLUMNS.filter((c) => canModuleAdmin || !c.adminOnly);
}

export function defaultVisibleMaketyListColumnIds(canModuleAdmin: boolean): MaketyListColumnId[] {
  return availableMaketyListColumns(canModuleAdmin)
    .filter((c) => c.defaultVisible)
    .map((c) => c.id);
}

export function lockedMaketyListColumnIds(canModuleAdmin: boolean): MaketyListColumnId[] {
  return availableMaketyListColumns(canModuleAdmin)
    .filter((c) => c.locked)
    .map((c) => c.id);
}

export function resolveVisibleMaketyListColumnIds(
  storedIds: MaketyListColumnId[] | null,
  canModuleAdmin: boolean
): MaketyListColumnId[] {
  const available = availableMaketyListColumns(canModuleAdmin);
  const availableIds = new Set(available.map((c) => c.id));
  const defaults = defaultVisibleMaketyListColumnIds(canModuleAdmin);
  const locked = lockedMaketyListColumnIds(canModuleAdmin);
  const lockedSet = new Set(locked);

  const source = storedIds && storedIds.length > 0 ? storedIds : defaults;
  const result: MaketyListColumnId[] = [];
  const seen = new Set<MaketyListColumnId>();

  for (const id of source) {
    if (availableIds.has(id) && !lockedSet.has(id) && !seen.has(id)) {
      result.push(id);
      seen.add(id);
    }
  }

  for (const id of locked) {
    if (availableIds.has(id)) {
      result.push(id);
      seen.add(id);
    }
  }

  return result;
}

export function isMaketyListColumnDraggable(
  id: MaketyListColumnId,
  canModuleAdmin: boolean
): boolean {
  const meta = getMaketyListColumnMeta(id);
  if (!meta || meta.locked) return false;
  if (meta.adminOnly && !canModuleAdmin) return false;
  return true;
}

export function reorderMaketyListColumnIds(
  ids: MaketyListColumnId[],
  activeId: MaketyListColumnId,
  overId: MaketyListColumnId,
  canModuleAdmin: boolean
): MaketyListColumnId[] {
  const resolved = resolveVisibleMaketyListColumnIds(ids, canModuleAdmin);
  if (!isMaketyListColumnDraggable(activeId, canModuleAdmin)) return resolved;
  if (!isMaketyListColumnDraggable(overId, canModuleAdmin)) return resolved;

  const oldIndex = resolved.indexOf(activeId);
  const newIndex = resolved.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return resolved;

  const next = [...resolved];
  next.splice(newIndex, 0, next.splice(oldIndex, 1)[0]!);
  return resolveVisibleMaketyListColumnIds(next, canModuleAdmin);
}

export function parseStoredMaketyListColumnPrefs(
  raw: string | null,
  canModuleAdmin: boolean
): MaketyListColumnId[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return resolveVisibleMaketyListColumnIds(
        parsed.filter(isKnownMaketyListColumnId),
        canModuleAdmin
      );
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      "visibleColumnIds" in parsed &&
      Array.isArray((parsed as MaketyListColumnPrefs).visibleColumnIds)
    ) {
      return resolveVisibleMaketyListColumnIds(
        (parsed as MaketyListColumnPrefs).visibleColumnIds.filter(isKnownMaketyListColumnId),
        canModuleAdmin
      );
    }
    return null;
  } catch {
    return null;
  }
}

export function serializeMaketyListColumnPrefs(ids: MaketyListColumnId[]): string {
  const prefs: MaketyListColumnPrefs = {
    version: MAKETY_LIST_COLUMNS_PREF_VERSION,
    visibleColumnIds: ids,
  };
  return JSON.stringify(prefs);
}
