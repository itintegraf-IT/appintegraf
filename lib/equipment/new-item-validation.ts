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
  /** Cena nad hranicí odepisovaného majetku, a přesto číslo z řady drobného majetku (výslovně potvrzeno). */
  confirmedSmallAsset: boolean;
};

/** Pole formuláře, ke kterému chyba patří (formulář na něj přesune fokus). */
export type NewItemField =
  | "name"
  | "category"
  | "purchaseDate"
  | "purchasePrice"
  | "invoiceNumber"
  | "supplier"
  | "brand"
  | "model"
  | "units"
  | "serials"
  | "assetTag"
  | "room"
  | "warranty"
  | "description"
  | "notes";

export type NewItemValidation =
  | { ok: true; data: NewItemInput; warnings: string[] }
  | { ok: false; error: string; field?: NewItemField };

export const MAX_UNITS_PER_CREATE = 50;

/** „1 kus“, „2 kusy“, „5 kusů“. */
export function unitsLabel(n: number): string {
  if (n === 1) return "1 kus";
  return n >= 2 && n <= 4 ? `${n} kusy` : `${n} kusů`;
}
/** Majetek se vstupní cenou VYŠŠÍ než tato částka je odepisovaný (§ 26 ZDP) a eviduje se v ABRA Gen. */
export const DEPRECIABLE_ASSET_THRESHOLD_CZK = 80000;
const MAX_PRICE = 99999999.99; // DECIMAL(10,2)

class InvalidInput extends Error {
  constructor(
    message: string,
    readonly field?: NewItemField
  ) {
    super(message);
  }
}

function text(
  body: Record<string, unknown>,
  key: string,
  label: string,
  max: number,
  field: NewItemField
): string | null {
  const value = body[key];
  if (value == null) return null;
  if (typeof value !== "string") throw new InvalidInput(`Pole „${label}“ má neplatný formát.`, field);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new InvalidInput(`Pole „${label}“ může mít nejvýše ${max} znaků.`, field);
  return trimmed || null;
}

function required(value: string | null, message: string, field: NewItemField): string {
  if (!value) throw new InvalidInput(message, field);
  return value;
}

function localDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" → Date (UTC půlnoc); neexistující den (30. 2.) odmítne. */
function parseDate(value: string, label: string, field: NewItemField): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match ? new Date(`${value}T00:00:00Z`) : null;
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new InvalidInput(`Pole „${label}“ není platné datum.`, field);
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
  if (!raw) throw new InvalidInput("Vyplňte pořizovací cenu.", "purchasePrice");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new InvalidInput("Pořizovací cena musí být číslo v Kč (např. 24 990,50).", "purchasePrice");
  }
  const price = Number(raw);
  if (price > MAX_PRICE) throw new InvalidInput("Pořizovací cena je příliš vysoká.", "purchasePrice");
  return price.toFixed(2);
}

function parseIntField(value: unknown, label: string, field: NewItemField): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  if (!Number.isInteger(n) || n <= 0) throw new InvalidInput(`Pole „${label}“ má neplatnou hodnotu.`, field);
  return n;
}

function parseSerials(body: Record<string, unknown>, unitCount: number): (string | null)[] {
  const clean = (v: unknown): string | null => {
    if (v == null) return null;
    if (typeof v !== "string") throw new InvalidInput("Sériové číslo má neplatný formát.", "serials");
    const t = v.trim();
    if (t.length > 100) throw new InvalidInput("Sériové číslo může mít nejvýše 100 znaků.", "serials");
    return t || null;
  };

  let serials: (string | null)[];
  if (Array.isArray(body.serial_numbers)) {
    if (body.serial_numbers.length !== unitCount && !(unitCount === 1 && body.serial_numbers.length === 0)) {
      throw new InvalidInput("Počet sériových čísel neodpovídá počtu kusů.", "serials");
    }
    serials = unitCount === 1 && body.serial_numbers.length === 0 ? [null] : body.serial_numbers.map(clean);
  } else if (unitCount === 1) {
    serials = [clean(body.serial_number)];
  } else {
    serials = Array.from({ length: unitCount }, () => null);
  }

  const filled = serials.filter((s): s is string => s !== null).map((s) => s.toLowerCase());
  if (new Set(filled).size !== filled.length) {
    throw new InvalidInput("Sériová čísla kusů musí být unikátní.", "serials");
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
    // Pořadí kontrol = pořadí polí ve formuláři (doklad → položka), hlásí se první chyba.
    const invoiceNumber = required(
      text(b, "invoice_number", "Doklad", 100, "invoiceNumber"),
      "Vyplňte číslo dokladu (faktury nebo jiného dokladu o pořízení).",
      "invoiceNumber"
    );
    const purchaseDateText = required(
      text(b, "purchase_date", "Datum pořízení", 10, "purchaseDate"),
      "Vyplňte datum pořízení.",
      "purchaseDate"
    );
    const purchaseDate = parseDate(purchaseDateText, "Datum pořízení", "purchaseDate");
    if (purchaseDateText > localDateString(opts.today)) {
      throw new InvalidInput("Datum pořízení nemůže být v budoucnosti.", "purchaseDate");
    }
    const purchasePrice = parsePrice(b.purchase_price);

    const name = required(text(b, "name", "Název", 200, "name"), "Vyplňte název.", "name");
    const categoryId = parseIntField(b.category_id, "Skupina", "category");
    if (categoryId == null) throw new InvalidInput("Vyberte skupinu majetku.", "category");

    const unitCount = b.unit_count == null || b.unit_count === "" ? 1 : Number(b.unit_count);
    if (!Number.isInteger(unitCount) || unitCount < 1 || unitCount > MAX_UNITS_PER_CREATE) {
      throw new InvalidInput(`Počet kusů musí být 1–${MAX_UNITS_PER_CREATE}.`, "units");
    }
    const serialNumbers = parseSerials(b, unitCount);

    // Klient pole posílá jen při volbě „zadat ručně“ — prázdné se nesmí tiše změnit na číslo z řady.
    const manualRequested = b.manual_asset_tag != null;
    const manualAssetTag = text(b, "manual_asset_tag", "Inventární číslo", 40, "assetTag");
    if (manualRequested) {
      if (!opts.canSetManualTag) {
        throw new InvalidInput("Inventární číslo ručně může zadat jen správce evidence.", "assetTag");
      }
      if (!manualAssetTag) throw new InvalidInput("Zadejte inventární číslo z ABRA Gen.", "assetTag");
      if (/\s/.test(manualAssetTag)) throw new InvalidInput("Inventární číslo nesmí obsahovat mezery.", "assetTag");
      if (unitCount > 1) throw new InvalidInput("Ruční inventární číslo lze zadat jen u jednoho kusu.", "assetTag");
    }
    const poolCode = text(b, "pool_qr_code", "Kód z fondu QR", 120, "assetTag");
    if (poolCode) {
      if (unitCount > 1) throw new InvalidInput("Kód z fondu QR lze použít jen u jednoho kusu.", "assetTag");
      if (manualAssetTag) {
        throw new InvalidInput("Zadejte buď ruční inventární číslo, nebo kód z fondu QR.", "assetTag");
      }
    }

    const aboveThreshold = Number(purchasePrice) > DEPRECIABLE_ASSET_THRESHOLD_CZK;
    if (aboveThreshold && unitCount > 1) {
      throw new InvalidInput(
        "Majetek nad 80 000 Kč zařazujte po jednom kuse — každý kus má v ABRA Gen vlastní inventární číslo.",
        "units"
      );
    }
    const confirmedSmallAsset = aboveThreshold && !manualAssetTag;
    if (confirmedSmallAsset && b.confirm_small_asset !== true) {
      throw new InvalidInput(
        "Cena je nad 80 000 Kč — takový majetek se eviduje v ABRA Gen jako odepisovaný. Zadejte jeho inventární číslo z Gen, nebo potvrďte, že jde o drobný majetek.",
        "assetTag"
      );
    }

    const warrantyText = text(b, "warranty_until", "Záruka do", 10, "warranty");
    const warnings = confirmedSmallAsset
      ? ["Zařazeno jako drobný majetek, ačkoli cena je nad 80 000 Kč (potvrzeno při zařazení)."]
      : [];

    return {
      ok: true,
      warnings,
      data: {
        name,
        categoryId,
        purchaseDate,
        purchasePrice,
        invoiceNumber,
        supplier: text(b, "supplier", "Dodavatel", 200, "supplier"),
        brand: text(b, "brand", "Značka", 100, "brand"),
        model: text(b, "model", "Model", 100, "model"),
        unitCount,
        serialNumbers,
        roomId: parseIntField(b.room_id, "Místnost", "room"),
        warrantyUntil: warrantyText ? parseDate(warrantyText, "Záruka do", "warranty") : null,
        description: text(b, "description", "Popis", 5000, "description"),
        notes: text(b, "notes", "Poznámky", 5000, "notes"),
        manualAssetTag,
        poolCode,
        confirmedSmallAsset,
      },
    };
  } catch (e) {
    if (e instanceof InvalidInput) return { ok: false, error: e.message, field: e.field };
    throw e;
  }
}
