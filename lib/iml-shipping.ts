/**
 * Pomocné funkce pro práci s doručovacími adresami IML zákazníků.
 * Vytaženo z route handlerů, aby route.ts exportoval pouze HTTP handlery
 * (Next.js App Router typová kontrola).
 */

export type NormalizedShippingAddress = {
  label: string | null;
  recipient: string | null;
  street: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  is_default: boolean;
  label_requirements: string | null;
  pallet_packaging: string | null;
  prepress_notes: string | null;
};

/**
 * Normalizuje vstupní pole adresy – trim, prázdné → null, booleany z true/false/"true".
 */
export function normalizeAddressInput(
  raw: Record<string, unknown>
): NormalizedShippingAddress {
  const str = (v: unknown): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  };
  return {
    label: str(raw.label),
    recipient: str(raw.recipient),
    street: str(raw.street),
    city: str(raw.city),
    postal_code: str(raw.postal_code),
    country: str(raw.country),
    is_default: raw.is_default === true || raw.is_default === "true",
    label_requirements: str(raw.label_requirements),
    pallet_packaging: str(raw.pallet_packaging),
    prepress_notes: str(raw.prepress_notes),
  };
}
