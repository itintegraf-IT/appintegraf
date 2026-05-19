import type { Prisma } from "@prisma/client";
import {
  validateEmail,
  validateInternationalPhone,
  validateTaxIds,
} from "@/lib/iml-validation";
import { isImlEmailKind, type ImlEmailKind } from "@/lib/iml-customer-units";

export type IncomingCustomerEmail = {
  id?: number;
  email: string;
  kind?: string;
  sort_order?: number;
  is_primary?: boolean;
};

export type IncomingCustomerContact = {
  id?: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  role?: string | null;
  sort_order?: number;
  is_primary?: boolean;
};

export function parseIncomingEmails(raw: unknown): IncomingCustomerEmail[] {
  if (!Array.isArray(raw)) return [];
  const out: IncomingCustomerEmail[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const email = String(r.email ?? "").trim();
    if (!email) continue;
    const kind = String(r.kind ?? "general").trim();
    out.push({
      id: r.id != null ? parseInt(String(r.id), 10) : undefined,
      email,
      kind: isImlEmailKind(kind) ? kind : "general",
      sort_order: r.sort_order != null ? parseInt(String(r.sort_order), 10) : out.length,
      is_primary: r.is_primary === true || r.is_primary === "true",
    });
  }
  return out;
}

export function parseIncomingContacts(raw: unknown): IncomingCustomerContact[] {
  if (!Array.isArray(raw)) return [];
  const out: IncomingCustomerContact[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = String(r.name ?? "").trim();
    if (!name) continue;
    out.push({
      id: r.id != null ? parseInt(String(r.id), 10) : undefined,
      name,
      phone: r.phone != null ? String(r.phone) : null,
      email: r.email != null ? String(r.email) : null,
      role: r.role != null ? String(r.role).trim() : null,
      sort_order: r.sort_order != null ? parseInt(String(r.sort_order), 10) : out.length,
      is_primary: r.is_primary === true || r.is_primary === "true",
    });
  }
  return out;
}

export async function validateNestedEmails(
  rows: IncomingCustomerEmail[]
): Promise<{ ok: true; rows: IncomingCustomerEmail[] } | { ok: false; error: string; field: string }> {
  const normalized: IncomingCustomerEmail[] = [];
  for (let i = 0; i < rows.length; i++) {
    const v = validateEmail(rows[i].email);
    if (!v.ok) {
      return { ok: false, error: v.error ?? "Neplatný e-mail", field: `emails[${i}]` };
    }
    normalized.push({ ...rows[i], email: v.value! });
  }
  return { ok: true, rows: normalized };
}

export type NormalizedCustomerContact = {
  name: string;
  phone: string | null;
  email: string | null;
  role: string | null;
  sort_order: number;
  is_primary: boolean;
};

export async function validateNestedContacts(
  rows: IncomingCustomerContact[]
): Promise<
  | { ok: true; rows: NormalizedCustomerContact[] }
  | { ok: false; error: string; field: string }
> {
  const normalized: NormalizedCustomerContact[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const phoneV = validateInternationalPhone(row.phone);
    if (!phoneV.ok) {
      return { ok: false, error: phoneV.error ?? "Neplatný telefon", field: `contacts[${i}].phone` };
    }
    const emailV = validateEmail(row.email);
    if (!emailV.ok) {
      return { ok: false, error: emailV.error ?? "Neplatný e-mail", field: `contacts[${i}].email` };
    }
    normalized.push({
      name: row.name.trim(),
      phone: phoneV.value,
      email: emailV.value,
      role: row.role?.trim() || null,
      sort_order: row.sort_order ?? i,
      is_primary: Boolean(row.is_primary),
    });
  }
  return { ok: true, rows: normalized };
}

export async function syncCustomerEmails(
  tx: Prisma.TransactionClient,
  customerId: number,
  rows: IncomingCustomerEmail[]
) {
  await tx.iml_customer_emails.deleteMany({ where: { customer_id: customerId } });
  if (rows.length === 0) return;

  let primarySet = false;
  const data = rows.map((r, idx) => {
    const isPrimary = r.is_primary && !primarySet;
    if (isPrimary) primarySet = true;
    return {
      customer_id: customerId,
      email: r.email,
      kind: (r.kind ?? "general") as ImlEmailKind,
      sort_order: r.sort_order ?? idx,
      is_primary: isPrimary,
    };
  });
  if (!primarySet && data.length > 0) data[0].is_primary = true;

  await tx.iml_customer_emails.createMany({ data });
}

export async function syncCustomerContacts(
  tx: Prisma.TransactionClient,
  customerId: number,
  rows: NormalizedCustomerContact[]
) {
  await tx.iml_customer_contacts.deleteMany({ where: { customer_id: customerId } });
  if (rows.length === 0) return;

  let primarySet = false;
  const data = rows.map((r, idx) => {
    const isPrimary = r.is_primary && !primarySet;
    if (isPrimary) primarySet = true;
    return {
      customer_id: customerId,
      name: r.name,
      phone: r.phone,
      email: r.email,
      role: r.role,
      sort_order: r.sort_order ?? idx,
      is_primary: isPrimary,
    };
  });
  if (!primarySet && data.length > 0) data[0].is_primary = true;

  await tx.iml_customer_contacts.createMany({ data });
}

export function pickLegacyEmailFromNested(rows: IncomingCustomerEmail[]): string | null {
  const billing = rows.find((r) => r.kind === "billing" && r.is_primary);
  if (billing) return billing.email;
  const primary = rows.find((r) => r.is_primary);
  if (primary) return primary.email;
  return rows[0]?.email ?? null;
}

export function pickLegacyPhoneFromContacts(
  rows: Array<{ phone: string | null; is_primary: boolean }>
): string | null {
  const primary = rows.find((r) => r.is_primary && r.phone);
  if (primary?.phone) return primary.phone;
  return rows.find((r) => r.phone)?.phone ?? null;
}

export function pickLegacyContactPerson(
  rows: Array<{ name: string; is_primary: boolean }>
): string | null {
  const primary = rows.find((r) => r.is_primary);
  return primary?.name ?? rows[0]?.name ?? null;
}
