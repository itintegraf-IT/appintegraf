import type { Prisma } from "@prisma/client";

/** Návrh dat pro založení / aktualizaci iml_products z grafické zakázky. */
export type MaketyProductDraft = {
  mode: "create" | "update";
  product_id: number | null;
  customer_id: number | null;
  die_cut_id: number | null;
  ig_code: string | null;
  client_code: string | null;
  ig_short_name: string | null;
  client_name: string | null;
  production_notes: string | null;
  item_status: string;
  approval_status: string;
  missing_fields: string[];
};

export function buildMaketyProductDraft(input: {
  customer_id: number | null;
  product_id: number | null;
  die_cut_id: number | null;
  label_code: string | null;
  product_name?: string | null;
  body: string;
  customer_name?: string | null;
  product?: {
    ig_code: string | null;
    client_code: string | null;
    ig_short_name: string | null;
    client_name?: string | null;
  } | null;
}): MaketyProductDraft {
  const mode = input.product_id != null ? "update" : "create";
  const ig_code =
    input.label_code?.trim() ||
    input.product?.ig_code?.trim() ||
    null;
  const client_code = input.product?.client_code?.trim() || ig_code;
  const ig_short_name =
    input.product?.ig_short_name?.trim() ||
    (ig_code ? `Grafika ${ig_code}` : null);
  const production_notes = input.body.trim().slice(0, 5000) || null;
  const client_name =
    input.product_name?.trim() ||
    input.product?.client_name?.trim() ||
    input.customer_name?.trim() ||
    null;

  const missing_fields: string[] = [];
  if (input.customer_id == null) missing_fields.push("customer_id");
  if (!ig_code) missing_fields.push("ig_code");

  return {
    mode,
    product_id: input.product_id,
    customer_id: input.customer_id,
    die_cut_id: input.die_cut_id,
    ig_code,
    client_code,
    ig_short_name,
    client_name,
    production_notes,
    item_status: "aktivní",
    approval_status: "approved",
    missing_fields,
  };
}

export function draftToProductCreateScalars(
  draft: MaketyProductDraft
): Prisma.iml_productsCreateInput {
  if (draft.customer_id == null) {
    throw new Error("Chybí klient");
  }
  return {
    ig_code: draft.ig_code,
    client_code: draft.client_code,
    ig_short_name: draft.ig_short_name,
    client_name: draft.client_name,
    production_notes: draft.production_notes,
    item_status: draft.item_status,
    approval_status: draft.approval_status,
    is_active: true,
    product_kind: "iml",
    iml_customers: { connect: { id: draft.customer_id } },
    ...(draft.die_cut_id != null
      ? { iml_die_cuts: { connect: { id: draft.die_cut_id } } }
      : {}),
  };
}

export function draftToProductUpdateScalars(
  draft: MaketyProductDraft
): Prisma.iml_productsUpdateInput {
  return {
    ig_code: draft.ig_code ?? undefined,
    client_code: draft.client_code ?? undefined,
    ig_short_name: draft.ig_short_name ?? undefined,
    client_name: draft.client_name ?? undefined,
    production_notes: draft.production_notes ?? undefined,
    item_status: draft.item_status,
    approval_status: draft.approval_status,
    is_active: true,
    ...(draft.die_cut_id != null
      ? { iml_die_cuts: { connect: { id: draft.die_cut_id } } }
      : {}),
  };
}
