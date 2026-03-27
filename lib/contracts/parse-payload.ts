import { Prisma } from "@prisma/client";

function parseOptionalInt(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseOptionalDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseOptionalDecimal(v: unknown): Prisma.Decimal | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  try {
    return new Prisma.Decimal(String(v));
  } catch {
    return undefined;
  }
}

/** Pole pro create/update smlouvy z JSON těla požadavku. */
export function parseContractPayload(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const contract_number =
    body.contract_number === undefined
      ? undefined
      : body.contract_number === null || body.contract_number === ""
        ? null
        : String(body.contract_number).trim() || null;
  const party_company =
    body.party_company === undefined
      ? undefined
      : body.party_company == null || body.party_company === ""
        ? null
        : String(body.party_company).trim() || null;
  const party_contact =
    body.party_contact === undefined
      ? undefined
      : body.party_contact == null || body.party_contact === ""
        ? null
        : String(body.party_contact).trim() || null;
  const description =
    body.description === undefined
      ? undefined
      : body.description == null
        ? null
        : String(body.description);

  const contract_type_id = parseOptionalInt(body.contract_type_id);
  const department_id = parseOptionalInt(body.department_id);
  const responsible_user_id = parseOptionalInt(body.responsible_user_id);

  const value_amount = parseOptionalDecimal(body.value_amount);
  const value_currency =
    body.value_currency === undefined
      ? undefined
      : body.value_currency == null || body.value_currency === ""
        ? null
        : String(body.value_currency).trim().slice(0, 10) || "CZK";

  const effective_from = parseOptionalDate(body.effective_from);
  const valid_until = parseOptionalDate(body.valid_until);
  const expires_at = parseOptionalDate(body.expires_at);

  return {
    title,
    contract_number,
    party_company,
    party_contact,
    description,
    contract_type_id,
    department_id,
    responsible_user_id,
    value_amount,
    value_currency,
    effective_from,
    valid_until,
    expires_at,
  };
}
