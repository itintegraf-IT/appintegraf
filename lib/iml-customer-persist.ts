import type { Prisma } from "@prisma/client";
import { normalizeTaxCountry } from "@/lib/iml-customer-units";
import { normalizeAddressInput } from "@/lib/iml-shipping";
import type { DraftBranch, DraftShippingAddress } from "@/lib/iml-customer-form-draft";
import {
  draftShippingFromApi,
  ensureDefaultShippingFlag,
  newTempId,
} from "@/lib/iml-customer-form-draft";
import {
  parseIncomingContacts,
  parseIncomingEmails,
  pickLegacyContactPerson,
  pickLegacyEmailFromNested,
  pickLegacyPhoneFromContacts,
  syncCustomerContacts,
  syncCustomerEmails,
  validateNestedContacts,
  validateNestedEmails,
  type IncomingCustomerEmail,
  type NormalizedCustomerContact,
} from "@/lib/iml-customer-nested";

type Tx = Prisma.TransactionClient;

function branchTaxCountry(raw: string | null | undefined): string | null {
  if (raw == null || raw === "" || raw === "OTHER") return null;
  return normalizeTaxCountry(raw);
}

export type IncomingBranchPayload = {
  id?: number;
  tempId?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  contact_person?: string | null;
  tax_country?: string | null;
  ico?: string | null;
  dic?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
  billing_address?: string | null;
  billing_company?: string | null;
  label_requirements?: string | null;
  pallet_packaging?: string | null;
  prepress_notes?: string | null;
  allow_under_over_delivery_percent?: number | null;
  individual_requirements?: string | null;
  customer_note?: string | null;
  sort_order?: number;
  emails?: unknown;
  contacts?: unknown;
  shipping_addresses?: unknown[];
};

export function parseDraftShippingList(raw: unknown): DraftShippingAddress[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => {
    const row = item as Record<string, unknown>;
    const normalized = normalizeAddressInput(row);
    return {
      tempId: String(row.tempId ?? `api_${i}`),
      id: row.id != null ? parseInt(String(row.id), 10) : undefined,
      label: normalized.label ?? "",
      recipient: normalized.recipient ?? "",
      street: normalized.street ?? "",
      city: normalized.city ?? "",
      postal_code: normalized.postal_code ?? "",
      country: normalized.country ?? "Česká republika",
      is_default: normalized.is_default,
      label_requirements: normalized.label_requirements ?? "",
      pallet_packaging: normalized.pallet_packaging ?? "",
      prepress_notes: normalized.prepress_notes ?? "",
      expedition_note: normalized.expedition_note ?? "",
    };
  });
}

export async function replaceCustomerShippingAddresses(
  tx: Tx,
  customerId: number,
  addresses: DraftShippingAddress[]
): Promise<void> {
  const rows = ensureDefaultShippingFlag(addresses);
  await tx.iml_customer_shipping_addresses.deleteMany({
    where: { customer_id: customerId },
  });
  if (rows.length === 0) return;

  let defaultSet = false;
  for (const addr of rows) {
    const data = normalizeAddressInput(addr as unknown as Record<string, unknown>);
    const isDefault = data.is_default || !defaultSet;
    if (isDefault) defaultSet = true;
    await tx.iml_customer_shipping_addresses.create({
      data: {
        customer_id: customerId,
        label: data.label,
        recipient: data.recipient,
        street: data.street,
        city: data.city,
        postal_code: data.postal_code,
        country: data.country ?? "Česká republika",
        is_default: isDefault,
        label_requirements: data.label_requirements,
        pallet_packaging: data.pallet_packaging,
        prepress_notes: data.prepress_notes,
        expedition_note: data.expedition_note,
      },
    });
  }
}

async function resolveBranchNested(
  branch: IncomingBranchPayload
): Promise<{
  emails: IncomingCustomerEmail[];
  contacts: NormalizedCustomerContact[];
  error?: { error: string; field?: string };
}> {
  const emailsValidated = await validateNestedEmails(parseIncomingEmails(branch.emails));
  if (!emailsValidated.ok) {
    return { emails: [], contacts: [], error: { error: emailsValidated.error, field: emailsValidated.field } };
  }
  const contactsValidated = await validateNestedContacts(parseIncomingContacts(branch.contacts));
  if (!contactsValidated.ok) {
    return {
      emails: [],
      contacts: [],
      error: { error: contactsValidated.error, field: contactsValidated.field },
    };
  }
  return { emails: emailsValidated.rows, contacts: contactsValidated.rows };
}

export async function createBranchRecord(
  tx: Tx,
  headquartersId: number,
  branch: IncomingBranchPayload,
  sortIndex: number
): Promise<{ id: number } | { error: string; field?: string }> {
  const nested = await resolveBranchNested(branch);
  if (nested.error) return nested.error;

  const legacyEmail =
    branch.email?.trim() || pickLegacyEmailFromNested(nested.emails) || null;
  const legacyPhone =
    branch.phone?.trim() || pickLegacyPhoneFromContacts(nested.contacts) || null;
  const legacyContact =
    branch.contact_person?.trim() || pickLegacyContactPerson(nested.contacts) || null;

  const created = await tx.iml_customers.create({
    data: {
      name: String(branch.name).trim(),
      email: legacyEmail,
      phone: legacyPhone,
      contact_person: legacyContact,
      tax_country: branchTaxCountry(branch.tax_country),
      ico: branch.ico ?? null,
      dic: branch.dic ?? null,
      city: branch.city ? String(branch.city).trim() : null,
      postal_code: branch.postal_code ? String(branch.postal_code).trim() : null,
      country: branch.country ? String(branch.country).trim() : "Česká republika",
      billing_address: branch.billing_address ? String(branch.billing_address).trim() : null,
      billing_company: branch.billing_company ? String(branch.billing_company).trim() : null,
      label_requirements: branch.label_requirements
        ? String(branch.label_requirements).trim()
        : null,
      pallet_packaging: branch.pallet_packaging
        ? String(branch.pallet_packaging).trim()
        : null,
      prepress_notes: branch.prepress_notes ? String(branch.prepress_notes).trim() : null,
      allow_under_over_delivery_percent: branch.allow_under_over_delivery_percent ?? null,
      individual_requirements: branch.individual_requirements
        ? String(branch.individual_requirements).trim()
        : null,
      customer_note: branch.customer_note ? String(branch.customer_note).trim() : null,
      parent_id: headquartersId,
      unit_type: "branch",
      sort_order: branch.sort_order ?? sortIndex,
    },
  });

  if (nested.emails.length > 0) {
    await syncCustomerEmails(tx, created.id, nested.emails);
  } else if (legacyEmail) {
    await syncCustomerEmails(tx, created.id, [
      { email: legacyEmail, kind: "general", is_primary: true, sort_order: 0 },
    ]);
  }
  if (nested.contacts.length > 0) {
    await syncCustomerContacts(tx, created.id, nested.contacts);
  }

  const shipping = parseDraftShippingList(branch.shipping_addresses);
  await replaceCustomerShippingAddresses(tx, created.id, shipping);

  return { id: created.id };
}

export async function updateBranchRecord(
  tx: Tx,
  branchId: number,
  branch: IncomingBranchPayload
): Promise<{ ok: true } | { error: string; field?: string }> {
  const nested = await resolveBranchNested(branch);
  if (nested.error) return nested.error;

  const legacyEmail =
    branch.email?.trim() || pickLegacyEmailFromNested(nested.emails) || null;
  const legacyPhone =
    branch.phone?.trim() || pickLegacyPhoneFromContacts(nested.contacts) || null;
  const legacyContact =
    branch.contact_person?.trim() || pickLegacyContactPerson(nested.contacts) || null;

  await tx.iml_customers.update({
    where: { id: branchId },
    data: {
      name: String(branch.name).trim(),
      email: legacyEmail,
      phone: legacyPhone,
      contact_person: legacyContact,
      tax_country: branchTaxCountry(branch.tax_country),
      ico: branch.ico ?? null,
      dic: branch.dic ?? null,
      city: branch.city ? String(branch.city).trim() : null,
      postal_code: branch.postal_code ? String(branch.postal_code).trim() : null,
      country: branch.country ? String(branch.country).trim() : "Česká republika",
      billing_address: branch.billing_address ? String(branch.billing_address).trim() : null,
      billing_company: branch.billing_company ? String(branch.billing_company).trim() : null,
      label_requirements: branch.label_requirements
        ? String(branch.label_requirements).trim()
        : null,
      pallet_packaging: branch.pallet_packaging
        ? String(branch.pallet_packaging).trim()
        : null,
      prepress_notes: branch.prepress_notes ? String(branch.prepress_notes).trim() : null,
      allow_under_over_delivery_percent: branch.allow_under_over_delivery_percent ?? null,
      individual_requirements: branch.individual_requirements
        ? String(branch.individual_requirements).trim()
        : null,
      customer_note: branch.customer_note ? String(branch.customer_note).trim() : null,
      sort_order: branch.sort_order ?? 0,
    },
  });

  await syncCustomerEmails(tx, branchId, nested.emails);
  await syncCustomerContacts(tx, branchId, nested.contacts);

  const shipping = parseDraftShippingList(branch.shipping_addresses);
  await replaceCustomerShippingAddresses(tx, branchId, shipping);

  return { ok: true };
}

/**
 * Sync poboček centrály: vytvoří nové, aktualizuje existující, smaže chybějící.
 */
export async function syncHeadquartersBranches(
  tx: Tx,
  headquartersId: number,
  incoming: IncomingBranchPayload[]
): Promise<{ ok: true } | { error: string; field?: string }> {
  const existing = await tx.iml_customers.findMany({
    where: { parent_id: headquartersId, unit_type: "branch" },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((b) => b.id));
  const keptIds = new Set<number>();

  for (let i = 0; i < incoming.length; i++) {
    const branch = incoming[i];
    const branchId =
      branch.id != null && !Number.isNaN(Number(branch.id))
        ? parseInt(String(branch.id), 10)
        : null;

    if (branchId != null && existingIds.has(branchId)) {
      const result = await updateBranchRecord(tx, branchId, { ...branch, sort_order: i });
      if ("error" in result) return result;
      keptIds.add(branchId);
    } else {
      const result = await createBranchRecord(tx, headquartersId, { ...branch, sort_order: i }, i);
      if ("error" in result) return result;
      keptIds.add(result.id);
    }
  }

  const toDelete = existing.filter((b) => !keptIds.has(b.id));
  for (const b of toDelete) {
    const orderCount = await tx.iml_orders.count({ where: { customer_id: b.id } });
    if (orderCount > 0) {
      return {
        error: `Pobočku nelze odebrat – má přiřazené objednávky (ID ${b.id})`,
      };
    }
    await tx.iml_customer_shipping_addresses.deleteMany({ where: { customer_id: b.id } });
    await tx.iml_customer_emails.deleteMany({ where: { customer_id: b.id } });
    await tx.iml_customer_contacts.deleteMany({ where: { customer_id: b.id } });
    await tx.iml_customers.delete({ where: { id: b.id } });
  }

  return { ok: true };
}

/** Map API branch row → DraftBranch pro edit formulář */
export function mapApiBranchToDraft(branch: {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  tax_country: string | null;
  billing_company: string | null;
  ico: string | null;
  dic: string | null;
  billing_address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  label_requirements?: string | null;
  pallet_packaging?: string | null;
  prepress_notes?: string | null;
  allow_under_over_delivery_percent?: number | null;
  individual_requirements?: string | null;
  customer_note?: string | null;
  iml_customer_emails?: Array<{
    email: string;
    kind: string;
    is_primary: boolean;
    sort_order: number;
  }>;
  iml_customer_contacts?: Array<{
    name: string;
    phone: string | null;
    email: string | null;
    role: string | null;
    is_primary: boolean;
    sort_order: number;
  }>;
  iml_customer_shipping_addresses?: Array<{
    id: number;
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
    expedition_note?: string | null;
  }>;
}): DraftBranch {
  return {
    tempId: newTempId(),
    id: branch.id,
    name: branch.name ?? "",
    email: branch.email ?? "",
    phone: branch.phone ?? "",
    contact_person: branch.contact_person ?? "",
    tax_country: branch.tax_country ?? "CZ",
    billing_company: branch.billing_company ?? "",
    ico: branch.ico ?? "",
    dic: branch.dic ?? "",
    billing_address: branch.billing_address ?? "",
    city: branch.city ?? "",
    postal_code: branch.postal_code ?? "",
    country: branch.country ?? "Česká republika",
    label_requirements: branch.label_requirements ?? "",
    pallet_packaging: branch.pallet_packaging ?? "",
    prepress_notes: branch.prepress_notes ?? "",
    allow_under_over_delivery_percent:
      branch.allow_under_over_delivery_percent != null
        ? String(branch.allow_under_over_delivery_percent)
        : "",
    individual_requirements: branch.individual_requirements ?? "",
    customer_note: branch.customer_note ?? "",
    emails: (branch.iml_customer_emails ?? []).map((e) => ({
      email: e.email,
      kind: e.kind,
      is_primary: e.is_primary,
      sort_order: e.sort_order,
    })),
    contacts: (branch.iml_customer_contacts ?? []).map((c) => ({
      name: c.name,
      phone: c.phone ?? "",
      email: c.email ?? "",
      role: c.role ?? "",
      is_primary: c.is_primary,
      sort_order: c.sort_order,
    })),
    shipping_addresses: (branch.iml_customer_shipping_addresses ?? []).map((a) =>
      draftShippingFromApi(a)
    ),
  };
}
