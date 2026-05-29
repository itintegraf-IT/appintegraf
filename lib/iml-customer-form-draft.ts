import type { CustomerEmailRow } from "@/app/(dashboard)/iml/customers/_components/CustomerEmailsEditor";
import type { CustomerContactRow } from "@/app/(dashboard)/iml/customers/_components/CustomerContactsEditor";
import type { CustomerFormState } from "@/app/(dashboard)/iml/customers/_components/CustomerFormSections";
import { emptyCustomerForm } from "@/app/(dashboard)/iml/customers/_components/CustomerFormSections";
import { emptyEmailRow } from "@/app/(dashboard)/iml/customers/_components/CustomerEmailsEditor";
import { emptyContactRow } from "@/app/(dashboard)/iml/customers/_components/CustomerContactsEditor";
import type { NormalizedShippingAddress } from "@/lib/iml-shipping";

export type DraftShippingAddress = {
  tempId: string;
  id?: number;
  label: string;
  recipient: string;
  street: string;
  city: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  label_requirements: string;
  pallet_packaging: string;
  prepress_notes: string;
  expedition_note: string;
};

export type DraftBranch = CustomerFormState & {
  tempId: string;
  id?: number;
  emails: CustomerEmailRow[];
  contacts: CustomerContactRow[];
  shipping_addresses: DraftShippingAddress[];
};

export type CustomerFormExtendedDraft = {
  isHeadquarters: boolean;
  shipping_addresses: DraftShippingAddress[];
  branches: DraftBranch[];
};

export function newTempId(): string {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyDraftShippingAddress(isDefault = false): DraftShippingAddress {
  return {
    tempId: newTempId(),
    label: "",
    recipient: "",
    street: "",
    city: "",
    postal_code: "",
    country: "Česká republika",
    is_default: isDefault,
    label_requirements: "",
    pallet_packaging: "",
    prepress_notes: "",
    expedition_note: "",
  };
}

export function emptyDraftBranch(): DraftBranch {
  return {
    tempId: newTempId(),
    ...emptyCustomerForm,
    emails: [],
    contacts: [],
    shipping_addresses: [],
  };
}

export function emptyCustomerFormExtendedDraft(): CustomerFormExtendedDraft {
  return {
    isHeadquarters: false,
    shipping_addresses: [],
    branches: [],
  };
}

export function draftShippingFromNormalized(
  row: NormalizedShippingAddress & { id?: number },
  tempId?: string
): DraftShippingAddress {
  return {
    tempId: tempId ?? newTempId(),
    id: row.id,
    label: row.label ?? "",
    recipient: row.recipient ?? "",
    street: row.street ?? "",
    city: row.city ?? "",
    postal_code: row.postal_code ?? "",
    country: row.country ?? "Česká republika",
    is_default: row.is_default,
    label_requirements: row.label_requirements ?? "",
    pallet_packaging: row.pallet_packaging ?? "",
    prepress_notes: row.prepress_notes ?? "",
    expedition_note: row.expedition_note ?? "",
  };
}

export function draftShippingFromApi(row: {
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
}): DraftShippingAddress {
  return draftShippingFromNormalized({
    id: row.id,
    label: row.label,
    recipient: row.recipient,
    street: row.street,
    city: row.city,
    postal_code: row.postal_code,
    country: row.country,
    is_default: row.is_default,
    label_requirements: row.label_requirements,
    pallet_packaging: row.pallet_packaging,
    prepress_notes: row.prepress_notes,
    expedition_note: row.expedition_note ?? null,
  });
}

export function ensureDefaultShippingFlag(rows: DraftShippingAddress[]): DraftShippingAddress[] {
  if (rows.length === 0) return rows;
  if (rows.some((r) => r.is_default)) return rows;
  return rows.map((r, i) => (i === 0 ? { ...r, is_default: true } : r));
}

/** Validace draft doručovací adresy – alespoň štítek nebo ulice. */
export function validateDraftShippingAddress(
  addr: DraftShippingAddress,
  prefix: string
): string | null {
  if (!addr.label.trim() && !addr.street.trim()) {
    return `${prefix}: vyplňte alespoň název (štítek) nebo ulici.`;
  }
  return null;
}

export function validateDraftShippingList(
  addresses: DraftShippingAddress[],
  contextLabel: string
): string | null {
  for (let i = 0; i < addresses.length; i++) {
    const err = validateDraftShippingAddress(
      addresses[i],
      `${contextLabel} – adresa ${i + 1}`
    );
    if (err) return err;
  }
  return null;
}
