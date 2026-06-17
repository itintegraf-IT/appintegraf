import { Prisma } from "@prisma/client";
import type { parseImlProductBodyForSave } from "@/lib/iml/parse-product-body";

type ParsedProduct = Awaited<ReturnType<typeof parseImlProductBodyForSave>>;

export type ImlProductExistingFk = {
  customer_id?: number | null;
  foil_id?: number | null;
  foil_material_id?: number | null;
  color_material_id?: number | null;
  paper_material_id?: number | null;
  lacquer_material_id?: number | null;
};

type RelationInput =
  | { connect: { id: number } }
  | { disconnect: true }
  | undefined;

/**
 * Update FK vazby: connect při novém id, disconnect jen pokud byla dříve a nově je null,
 * jinak vynechat (Prisma nemění existující vazbu).
 */
function fkRelationUpdate(
  newId: number | null | undefined,
  existingId: number | null | undefined,
  opts?: { allowDisconnect?: boolean }
): RelationInput {
  if (newId != null) return { connect: { id: newId } };
  if (opts?.allowDisconnect !== false && existingId != null) return { disconnect: true };
  return undefined;
}

function spreadRelation(
  key: keyof Prisma.iml_productsUpdateInput,
  value: RelationInput
): Prisma.iml_productsUpdateInput {
  return value != null ? ({ [key]: value } as Prisma.iml_productsUpdateInput) : {};
}

/** Mapuje parsovaná data produktu na Prisma 7 update input (FK přes relations). */
export function toImlProductUpdateData(
  data: ParsedProduct & { last_edited_by?: string | null },
  existing?: ImlProductExistingFk
): Prisma.iml_productsUpdateInput {
  const {
    customer_id,
    foil_id,
    foil_material_id,
    color_material_id,
    paper_material_id,
    lacquer_material_id,
    custom_data,
    ...scalars
  } = data;

  return {
    ...scalars,
    last_edited_by: data.last_edited_by ?? undefined,
    custom_data:
      custom_data == null ? Prisma.DbNull : (custom_data as Prisma.InputJsonValue),
    ...spreadRelation(
      "iml_customers",
      fkRelationUpdate(customer_id, existing?.customer_id, { allowDisconnect: false })
    ),
    ...spreadRelation("iml_foils", fkRelationUpdate(foil_id, existing?.foil_id)),
    ...spreadRelation(
      "foil_material",
      fkRelationUpdate(foil_material_id, existing?.foil_material_id)
    ),
    ...spreadRelation(
      "color_material",
      fkRelationUpdate(color_material_id, existing?.color_material_id)
    ),
    ...spreadRelation(
      "paper_material",
      fkRelationUpdate(paper_material_id, existing?.paper_material_id)
    ),
    ...spreadRelation(
      "lacquer_material",
      fkRelationUpdate(lacquer_material_id, existing?.lacquer_material_id)
    ),
  };
}

/** Create input – Prisma 7 také vyžaduje relation syntax u FK. */
export function toImlProductCreateData(
  data: ParsedProduct & { last_edited_by?: string | null }
): Prisma.iml_productsCreateInput {
  const {
    customer_id,
    foil_id,
    foil_material_id,
    color_material_id,
    paper_material_id,
    lacquer_material_id,
    custom_data,
    ...scalars
  } = data;

  return {
    ...scalars,
    last_edited_by: data.last_edited_by ?? undefined,
    custom_data:
      custom_data == null ? Prisma.DbNull : (custom_data as Prisma.InputJsonValue),
    ...(customer_id != null
      ? { iml_customers: { connect: { id: customer_id } } }
      : {}),
    ...(foil_id != null ? { iml_foils: { connect: { id: foil_id } } } : {}),
    ...(foil_material_id != null
      ? { foil_material: { connect: { id: foil_material_id } } }
      : {}),
    ...(color_material_id != null
      ? { color_material: { connect: { id: color_material_id } } }
      : {}),
    ...(paper_material_id != null
      ? { paper_material: { connect: { id: paper_material_id } } }
      : {}),
    ...(lacquer_material_id != null
      ? { lacquer_material: { connect: { id: lacquer_material_id } } }
      : {}),
  };
}
