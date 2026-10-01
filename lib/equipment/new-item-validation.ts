/**
 * Validace zařazení nové položky (nákup drobného majetku). Čistá funkce bez DB.
 * Povinné: název, skupina, datum pořízení, pořizovací cena, doklad.
 */

export type NewItemInput = {
  name: string;
  categoryId: number;
  purchaseDate: Date;
  /** Normalizovaná cena s dvěma desetinnými místy, např. "24990.50" (pro sloupec DECIMAL). */
  purchasePrice: string;
  invoiceNumber: string;
  supplier: string | null;
  brand: string | null;
  model: string | null;
  unitCount: number;
  /** Jedna položka na kus; `null` = kus bez sériového čísla. */
  serialNumbers: (string | null)[];
  roomId: number | null;
  warrantyUntil: Date | null;
  description: string | null;
  notes: string | null;
  manualAssetTag: string | null;
  poolCode: string | null;
};

export type NewItemValidation =
  | { ok: true; data: NewItemInput; warnings: string[] }
  | { ok: false; error: string };

export const MAX_UNITS_PER_CREATE = 50;
/** Od této ceny jde o odepisovaný majetek, který se eviduje v ABRA Gen. */
export const DEPRECIABLE_ASSET_THRESHOLD_CZK = 80000;
const MAX_PRICE = 99999999.99; // DECIMAL(10,2)

class InvalidInput extends Error {}

function text(body: Record<string, unknown>, key: string, label: string, max: number): string | null {
  const value = body[key];
  if (value == null) return null;
  if (typeof value !== "string") throw new InvalidInput(`Pole „${label}“ má neplatný formát.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new InvalidInput(`Pole „${label}“ může mít nejvýše ${max} znaků.`);
  return trimmed || null;
}

function required(value: string | null, message: string): string {
  if (!value) throw new InvalidInput(message);
  return value;
}

function localDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" → Date (UTC půlnoc); neexistující den (30. 2.) odmítne. */
function parseDate(value: string, label: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match ? new Date(`${value}T00:00:00Z`) : null;
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new InvalidInput(`Pole „${label}“ není platné datum.`);
  }
  return date;
}

function parsePrice(value: unknown): string {
  const raw =
    typeof value === "number"
      ? String(value)
      : typeof value === "string"
        ? value.replace(/[\s  ]/g, "").replace(",", ".")
        : "";
  if (!raw) throw new InvalidInput("Vyplňte pořizovací cenu.");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new InvalidInput("Pořizovací cena musí být číslo v Kč (např. 24 990,50).");
  }
  const price = Number(raw);
  if (price > MAX_PRICE) throw new InvalidInput("Pořizovací cena je příliš vysoká.");
  return price.toFixed(2);
}

function parseIntField(value: unknown, label: string): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  if (!Number.isInteger(n) || n <= 0) throw new InvalidInput(`Pole „${label}“ má neplatnou hodnotu.`);
  return n;
}

function parseSerials(body: Record<string, unknown>, unitCount: number): (string | null)[] {
  const clean = (v: unknown): string | null => {
    if (v == null) return null;
    if (typeof v !== "string") throw new InvalidInput("Sériové číslo má neplatný formát.");
    const t = v.trim();
    if (t.length > 100) throw new InvalidInput("Sériové číslo může mít nejvýše 100 znaků.");
    return t || null;
  };

  let serials: (string | null)[];
  if (Array.isArray(body.serial_numbers)) {
    if (body.serial_numbers.length !== unitCount && !(unitCount === 1 && body.serial_numbers.length === 0)) {
      throw new InvalidInput("Počet sériových čísel neodpovídá počtu kusů.");
    }
    serials = unitCount === 1 && body.serial_numbers.length === 0 ? [null] : body.serial_numbers.map(clean);
  } else if (unitCount === 1) {
    serials = [clean(body.serial_number)];
  } else {
    serials = Array.from({ length: unitCount }, () => null);
  }

  const filled = serials.filter((s): s is string => s !== null).map((s) => s.toLowerCase());
  if (new Set(filled).size !== filled.length) {
    throw new InvalidInput("Sériová čísla kusů musí být unikátní.");
  }
  return serials;
}

export function validateNewItemInput(
  body: unknown,
  opts: { canSetManualTag: boolean; today: Date }
): NewItemValidation {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Neplatný požadavek." };
  }
  const b = body as Record<string, unknown>;

  try {
    const name = required(text(b, "name", "Název", 200), "Vyplňte název.");
    const categoryId = parseIntField(b.category_id, "Skupina");
    if (categoryId == null) throw new InvalidInput("Vyberte skupinu majetku.");

    const purchaseDateText = required(text(b, "purchase_date", "Datum pořízení", 10), "Vyplňte datum pořízení.");
    const purchaseDate = parseDate(purchaseDateText, "Datum pořízení");
    if (purchaseDateText > localDateString(opts.today)) {
      throw new InvalidInput("Datum pořízení nemůže být v budoucnosti.");
    }
    const purchasePrice = parsePrice(b.purchase_price);
    const invoiceNumber = required(
      text(b, "invoice_number", "Doklad", 100),
      "Vyplňte číslo dokladu (faktury nebo jiného dokladu o pořízení)."
    );

    const unitCount = b.unit_count == null || b.unit_count === "" ? 1 : Number(b.unit_count);
    if (!Number.isInteger(unitCount) || unitCount < 1 || unitCount > MAX_UNITS_PER_CREATE) {
      throw new InvalidInput(`Počet kusů musí být 1–${MAX_UNITS_PER_CREATE}.`);
    }
    const serialNumbers = parseSerials(b, unitCount);

    const manualAssetTag = text(b, "manual_asset_tag", "Inventární číslo", 40);
    if (manualAssetTag) {
      if (!opts.canSetManualTag) throw new InvalidInput("Inventární číslo ručně může zadat jen správce evidence.");
      if (/\s/.test(manualAssetTag)) throw new InvalidInput("Inventární číslo nesmí obsahovat mezery.");
      if (unitCount > 1) throw new InvalidInput("Ruční inventární číslo lze zadat jen u jednoho kusu.");
    }
    const poolCode = text(b, "pool_qr_code", "Kód z fondu QR", 120);
    if (poolCode) {
      if (unitCount > 1) throw new InvalidInput("Kód z fondu QR lze použít jen u jednoho kusu.");
      if (manualAssetTag) throw new InvalidInput("Zadejte buď ruční inventární číslo, nebo kód z fondu QR.");
    }

    const warrantyText = text(b, "warranty_until", "Záruka do", 10);
    const warnings: string[] = [];
    if (Number(purchasePrice) >= DEPRECIABLE_ASSET_THRESHOLD_CZK) {
      warnings.push(
        "Majetek od 80 000 Kč se eviduje v ABRA Gen jako odepisovaný — zadejte jeho inventární číslo z Gen ručně."
      );
    }

    return {
      ok: true,
      warnings,
      data: {
        name,
        categoryId,
        purchaseDate,
        purchasePrice,
        invoiceNumber,
        supplier: text(b, "supplier", "Dodavatel", 200),
        brand: text(b, "brand", "Značka", 100),
        model: text(b, "model", "Model", 100),
        unitCount,
        serialNumbers,
        roomId: parseIntField(b.room_id, "Místnost"),
        warrantyUntil: warrantyText ? parseDate(warrantyText, "Záruka do") : null,
        description: text(b, "description", "Popis", 5000),
        notes: text(b, "notes", "Poznámky", 5000),
        manualAssetTag,
        poolCode,
      },
    };
  } catch (e) {
    if (e instanceof InvalidInput) return { ok: false, error: e.message };
    throw e;
  }
}
