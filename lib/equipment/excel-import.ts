import * as XLSX from "xlsx";

export type ParsedEquipmentCategory = {
  name: string;
  responsibleRaw: string;
};

export type ParsedEquipmentRoom = {
  code: string;
  name: string;
  aliases: string[];
};

export type ParsedEquipmentItem = {
  rowNumber: number;
  assetTag: string;
  name: string;
  categoryName: string;
  year: number | null;
  quantity: number;
  originalRoomName: string;
  originalRoomCode: string;
  workerName: string;
  costCenter: string;
  extra: string;
  location: string | null;
  notes: string | null;
};

export type ParsedEquipmentWorkbook = {
  categories: ParsedEquipmentCategory[];
  rooms: ParsedEquipmentRoom[];
  items: ParsedEquipmentItem[];
  warnings: string[];
  errors: string[];
};

export type ResponsibleUser = {
  id: number;
  first_name: string;
  last_name: string;
};

function cell(row: unknown[], index: number): string {
  if (index < 0 || index >= row.length) return "";
  const v = row[index];
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

export function normalizeHeader(s: string): string {
  return stripDiacritics(String(s ?? ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeCategoryName(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function headerEquals(headers: string[], want: string): number {
  const n = normalizeHeader(want);
  return headers.findIndex((h) => normalizeHeader(h) === n);
}

function sheetToAoa(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: true,
  }) as unknown[][];
}

function rowHasContent(row: unknown[]): boolean {
  return row.some((c) => String(c ?? "").trim() !== "");
}

function findMajetekHeaderRow(aoa: unknown[][]): number {
  const max = Math.min(aoa.length, 8);
  for (let i = 0; i < max; i++) {
    const headers = (aoa[i] ?? []).map((h) => String(h ?? ""));
    const inv = headerEquals(headers, "Inv.číslo");
    const cat = headerEquals(headers, "KATEGORIE");
    const name = headerEquals(headers, "Název");
    if (inv >= 0 && cat >= 0 && name >= 0) return i;
  }
  return -1;
}

function findRoomsHeaderRow(aoa: unknown[][]): number {
  const max = Math.min(aoa.length, 8);
  for (let i = 0; i < max; i++) {
    const headers = (aoa[i] ?? []).map((h) => String(h ?? ""));
    const name = headerEquals(headers, "Název");
    const newCode = headerEquals(headers, "nový kód");
    if (name >= 0 && newCode >= 0) return i;
  }
  return -1;
}

function findCategoriesHeaderRow(aoa: unknown[][]): number {
  const max = Math.min(aoa.length, 10);
  for (let i = 0; i < max; i++) {
    const headers = (aoa[i] ?? []).map((h) => String(h ?? ""));
    const cat = headerEquals(headers, "KATEGORIE");
    const resp = headerEquals(headers, "ZODPOVĚDNÁ OSOBA");
    const inv = headerEquals(headers, "Inv.číslo");
    // List majetku má stejné dvě hlavičky — číselník je bez inventárního čísla.
    if (cat >= 0 && resp >= 0 && inv < 0) return i;
  }
  return -1;
}

function isSkipRoomRow(name: string, oldCode: string, newCode: string): boolean {
  const n = name.toLowerCase();
  if (n.includes("nepřenášíme") || n.includes("neprenasiime") || n.includes("neprenasime")) {
    return true;
  }
  if (n === "nezařazeno" || n === "nezarazeno") return true;
  if (normalizeHeader(newCode) === "mistnosti") return true;
  if (normalizeHeader(oldCode) === "puvodni" && !/^\d+$/.test(newCode)) return true;
  if (!newCode) return true;
  return false;
}

export function slugCategoryCode(name: string): string {
  const ascii = stripDiacritics(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  return ascii || "CAT";
}

export function uniqueCategoryCode(name: string, taken: Set<string>): string {
  const base = slugCategoryCode(name);
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  for (let i = 2; i < 100; i++) {
    const suffix = `_${i}`;
    const code = `${base.slice(0, Math.max(1, 20 - suffix.length))}${suffix}`;
    if (!taken.has(code)) {
      taken.add(code);
      return code;
    }
  }
  throw new Error(`Nepodařilo se vytvořit unikátní kód skupiny pro ${name}`);
}

export function matchResponsibleUser(
  raw: string,
  users: ResponsibleUser[]
): { userId: number | null; warning?: string } {
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name) return { userId: null };
  if (name.includes("/")) {
    return {
      userId: null,
      warning: `Zodpovědnou osobu nelze jednoznačně spárovat: ${name}`,
    };
  }

  const key = stripDiacritics(name).toLowerCase();
  const exact = users.filter((u) => {
    const lf = stripDiacritics(`${u.last_name} ${u.first_name}`).toLowerCase();
    const fl = stripDiacritics(`${u.first_name} ${u.last_name}`).toLowerCase();
    return lf === key || fl === key;
  });
  if (exact.length === 1) return { userId: exact[0].id };
  if (exact.length > 1) {
    return { userId: null, warning: `Jméno ${name} odpovídá více uživatelům` };
  }

  const lastOnly = users.filter(
    (u) => stripDiacritics(u.last_name).toLowerCase() === key
  );
  if (lastOnly.length === 1) return { userId: lastOnly[0].id };
  if (lastOnly.length > 1) {
    return { userId: null, warning: `Příjmení ${name} není jednoznačné` };
  }

  return { userId: null, warning: `Uživatel nenalezen: ${name}` };
}

export function formatOriginalLocation(roomName: string, roomCode: string): string | null {
  let text = "";
  if (roomName && roomCode) text = `${roomName} (${roomCode})`;
  else if (roomName) text = roomName;
  else if (roomCode) text = roomCode;
  if (!text) return null;
  return text.slice(0, 200);
}

export function formatItemNotes(opts: {
  workerName: string;
  costCenter: string;
  extra: string;
}): string | null {
  const parts: string[] = [];
  if (opts.workerName) parts.push(`Pracovník: ${opts.workerName}`);
  if (opts.costCenter) parts.push(`Středisko: ${opts.costCenter}`);
  if (opts.extra) parts.push(opts.extra);
  return parts.length ? parts.join("\n") : null;
}

function parseYear(raw: string): number | null {
  const m = raw.match(/(19|20)\d{2}/);
  if (!m) return null;
  const y = parseInt(m[0], 10);
  if (y < 1900 || y > 2100) return null;
  return y;
}

function parseQuantity(raw: string): number {
  const n = parseInt(raw.replace(",", "."), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

function parseCategoriesSheet(aoa: unknown[][], warnings: string[]): ParsedEquipmentCategory[] {
  const headerRow = findCategoriesHeaderRow(aoa);
  if (headerRow < 0) return [];
  const headers = (aoa[headerRow] ?? []).map((h) => String(h ?? ""));
  const catIdx = headerEquals(headers, "KATEGORIE");
  const respIdx = headerEquals(headers, "ZODPOVĚDNÁ OSOBA");
  const seen = new Set<string>();
  const out: ParsedEquipmentCategory[] = [];
  for (let i = headerRow + 1; i < aoa.length; i++) {
    const row = aoa[i] ?? [];
    if (!rowHasContent(row)) continue;
    const name = cell(row, catIdx);
    if (!name) continue;
    const key = normalizeCategoryName(name);
    if (seen.has(key)) {
      warnings.push(`Duplicitní kategorie v číselníku: ${name}`);
      continue;
    }
    seen.add(key);
    out.push({ name, responsibleRaw: cell(row, respIdx) });
  }
  return out;
}

function parseRoomsSheet(aoa: unknown[][], warnings: string[]): ParsedEquipmentRoom[] {
  const headerRow = findRoomsHeaderRow(aoa);
  if (headerRow < 0) return [];
  const headers = (aoa[headerRow] ?? []).map((h) => String(h ?? ""));
  const nameIdx = headerEquals(headers, "Název");
  const oldIdx = headerEquals(headers, "Místnost");
  const newIdx = headerEquals(headers, "nový kód");
  const byCode = new Map<string, ParsedEquipmentRoom>();

  for (let i = headerRow + 1; i < aoa.length; i++) {
    const row = aoa[i] ?? [];
    if (!rowHasContent(row)) continue;
    const name = cell(row, nameIdx);
    const oldCode = cell(row, oldIdx);
    const newCode = cell(row, newIdx);
    if (isSkipRoomRow(name, oldCode, newCode)) continue;
    const code = newCode.toUpperCase().slice(0, 40);
    const existing = byCode.get(code);
    if (!existing) {
      byCode.set(code, { code, name: name || code, aliases: [] });
      continue;
    }
    if (name && name !== existing.name && !existing.aliases.includes(name)) {
      existing.aliases.push(name);
    }
  }

  const rooms = [...byCode.values()];
  if (rooms.length === 0) {
    warnings.push("Záložka místností neobsahuje žádný nový kód k založení.");
  }
  return rooms;
}

function parseMajetekSheet(
  aoa: unknown[][],
  headerRow: number,
  errors: string[],
  warnings: string[]
): ParsedEquipmentItem[] {
  const headers = (aoa[headerRow] ?? []).map((h) => String(h ?? ""));
  const invIdx = headerEquals(headers, "Inv.číslo");
  const catIdx = headerEquals(headers, "KATEGORIE");
  const nameIdx = headerEquals(headers, "Název");
  const yearIdx = headerEquals(headers, "Rok");
  const ksIdx = headerEquals(headers, "Ks");
  const roomNameIdx = headerEquals(headers, "Název místnosti");
  const roomCodeIdx = headerEquals(headers, "Místnost");
  const workerIdx = headerEquals(headers, "Jméno pracovníka");
  const centerIdx = headerEquals(headers, "Název střediska");
  const extraIdx = headerEquals(headers, "Doplňující údaje");

  const seen = new Set<string>();
  const items: ParsedEquipmentItem[] = [];

  for (let i = headerRow + 1; i < aoa.length; i++) {
    const row = aoa[i] ?? [];
    if (!rowHasContent(row)) continue;
    const excelRow = i + 1;
    const assetTag = cell(row, invIdx).slice(0, 40);
    const name = cell(row, nameIdx).slice(0, 200);
    const categoryName = cell(row, catIdx);
    if (!assetTag || !name) {
      errors.push(`Řádek ${excelRow}: chybí inventární číslo nebo název.`);
      continue;
    }
    if (seen.has(assetTag)) {
      warnings.push(`Řádek ${excelRow}: duplicitní Inv.číslo ${assetTag} — přeskočeno.`);
      continue;
    }
    seen.add(assetTag);
    if (!categoryName) {
      errors.push(`Řádek ${excelRow} (${assetTag}): chybí kategorie.`);
      continue;
    }

    const year = parseYear(cell(row, yearIdx));
    const quantity = parseQuantity(cell(row, ksIdx));
    const originalRoomName = cell(row, roomNameIdx);
    const originalRoomCode = cell(row, roomCodeIdx);
    const workerName = cell(row, workerIdx);
    const costCenter = cell(row, centerIdx);
    const extra = cell(row, extraIdx);

    items.push({
      rowNumber: excelRow,
      assetTag,
      name,
      categoryName,
      year,
      quantity,
      originalRoomName,
      originalRoomCode,
      workerName,
      costCenter,
      extra,
      location: formatOriginalLocation(originalRoomName, originalRoomCode),
      notes: formatItemNotes({ workerName, costCenter, extra }),
    });
  }

  return items;
}

export function parseEquipmentWorkbook(wb: XLSX.WorkBook): ParsedEquipmentWorkbook {
  const warnings: string[] = [];
  const errors: string[] = [];

  let majetekAoa: unknown[][] | null = null;
  let majetekHeader = -1;
  let roomsAoa: unknown[][] | null = null;
  let catsAoa: unknown[][] | null = null;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const aoa = sheetToAoa(ws);
    if (majetekHeader < 0) {
      const h = findMajetekHeaderRow(aoa);
      if (h >= 0) {
        majetekAoa = aoa;
        majetekHeader = h;
      }
    }
    if (!roomsAoa && findRoomsHeaderRow(aoa) >= 0) {
      roomsAoa = aoa;
    }
    if (!catsAoa && findCategoriesHeaderRow(aoa) >= 0) {
      catsAoa = aoa;
    }
  }

  if (!majetekAoa || majetekHeader < 0) {
    errors.push("V souboru chybí záložka majetku (očekávané sloupce Inv.číslo, KATEGORIE, Název).");
    return { categories: [], rooms: [], items: [], warnings, errors };
  }

  const items = parseMajetekSheet(majetekAoa, majetekHeader, errors, warnings);
  const rooms = roomsAoa ? parseRoomsSheet(roomsAoa, warnings) : [];
  if (!roomsAoa) {
    warnings.push("Záložka místností nebyla rozpoznána — místnosti se nezaloží.");
  }

  let categories = catsAoa ? parseCategoriesSheet(catsAoa, warnings) : [];
  if (!catsAoa) {
    warnings.push("Záložka kategorií nebyla rozpoznána — skupiny se odvodí z listu majetku.");
  }

  const catKeys = new Set(categories.map((c) => normalizeCategoryName(c.name)));
  for (const item of items) {
    const key = normalizeCategoryName(item.categoryName);
    if (!catKeys.has(key)) {
      catKeys.add(key);
      categories.push({ name: item.categoryName, responsibleRaw: "" });
    }
  }

  if (items.length === 0) {
    errors.push("Záložka majetku neobsahuje žádné platné řádky.");
  }

  return { categories, rooms, items, warnings, errors };
}

export function parseEquipmentExcelBuffer(buf: Buffer | Uint8Array): ParsedEquipmentWorkbook {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true, raw: false });
  return parseEquipmentWorkbook(wb);
}

export function yearToPurchaseDate(year: number | null): Date | null {
  if (year == null) return null;
  return new Date(Date.UTC(year, 0, 1));
}

export function roomDescription(room: ParsedEquipmentRoom): string | null {
  if (room.aliases.length === 0) return null;
  return `Také: ${room.aliases.join("; ")}`.slice(0, 65000);
}
