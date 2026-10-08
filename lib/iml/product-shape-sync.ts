import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/** Denormalizovaná pole produktu z tvaru / nástroje / montáže (Cicero, XML). Bez FK. */
export type ShapeSyncScalars = {
  label_shape_code?: string;
  die_cut_tool_code?: string | null;
  assembly_code?: string | null;
  positions_on_sheet?: number | null;
  labels_per_sheet?: number | null;
  format_width_mm?: Prisma.Decimal | number;
  format_height_mm?: Prisma.Decimal | number;
  product_format?: string;
};

/**
 * Denormalizovaná pole produktu z tvaru / nástroje / montáže.
 * FK (`shape_id` atd.) sem nepatří — Prisma 7 je chce přes relations.
 */
export async function buildProductFieldsFromShapeSelection(params: {
  shapeId: number | null;
  toolId: number | null;
  impositionId: number | null;
}): Promise<ShapeSyncScalars> {
  const data: ShapeSyncScalars = {};

  if (params.shapeId == null) {
    return data;
  }

  const shape = await prisma.iml_shape_catalog.findUnique({
    where: { id: params.shapeId },
    select: { shape_code: true, width_mm: true, height_mm: true },
  });
  if (!shape) return data;

  data.label_shape_code = shape.shape_code;
  data.format_width_mm = shape.width_mm;
  data.format_height_mm = shape.height_mm;
  data.product_format = `${Number(shape.width_mm)}×${Number(shape.height_mm)}`;

  if (params.toolId != null) {
    const tool = await prisma.iml_tool_catalog.findUnique({
      where: { id: params.toolId },
      select: { tool_code_orig: true, tool_code_new: true },
    });
    if (tool) {
      data.die_cut_tool_code = tool.tool_code_orig || tool.tool_code_new;
    }
  }

  if (params.impositionId != null) {
    const imp = await prisma.iml_imposition_catalog.findUnique({
      where: { id: params.impositionId },
      select: { imposition_code: true, positions_count: true },
    });
    if (imp) {
      data.assembly_code = imp.imposition_code;
      data.positions_on_sheet = imp.positions_count;
      data.labels_per_sheet = imp.positions_count;
    }
  }

  return data;
}

/** Prisma 7 update input: FK tvar/nástroj/montáž přes connect/disconnect. */
export function shapeSelectionToUpdateRelations(params: {
  shapeId: number | null;
  toolId: number | null;
  impositionId: number | null;
}): Prisma.iml_productsUpdateInput {
  const data: Prisma.iml_productsUpdateInput = {};

  if (params.shapeId != null) {
    data.iml_shape_catalog = { connect: { id: params.shapeId } };
  } else {
    data.iml_shape_catalog = { disconnect: true };
  }

  if (params.toolId != null) {
    data.iml_tool_catalog = { connect: { id: params.toolId } };
  } else {
    data.iml_tool_catalog = { disconnect: true };
  }

  if (params.impositionId != null) {
    data.iml_imposition_catalog = { connect: { id: params.impositionId } };
  } else {
    data.iml_imposition_catalog = { disconnect: true };
  }

  return data;
}

/** Kompletní update payload: relace + denormalizované skaláry. */
export async function buildProductUpdateFromShapeSelection(params: {
  shapeId: number | null;
  toolId: number | null;
  impositionId: number | null;
}): Promise<Prisma.iml_productsUpdateInput> {
  const scalars = await buildProductFieldsFromShapeSelection(params);
  return {
    ...shapeSelectionToUpdateRelations(params),
    ...scalars,
  };
}

/** První montáž nástroje (orderBy id asc) — stejné pravidlo jako bulk-assign. */
export async function resolveFirstImpositionForTool(
  toolId: number
): Promise<number | null> {
  const firstImp = await prisma.iml_imposition_catalog.findFirst({
    where: { tool_id: toolId },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  return firstImp?.id ?? null;
}

/** Výchozí PRIMARY nástroj a první montáž pro tvar. */
export async function resolveDefaultToolAndImposition(shapeId: number): Promise<{
  toolId: number | null;
  impositionId: number | null;
}> {
  const primary = await prisma.iml_shape_tool_assignment.findFirst({
    where: { shape_id: shapeId, priority: "PRIMARY" },
    select: { tool_id: true },
  });
  const toolId =
    primary?.tool_id ??
    (
      await prisma.iml_shape_tool_assignment.findFirst({
        where: { shape_id: shapeId },
        orderBy: { id: "asc" },
        select: { tool_id: true },
      })
    )?.tool_id ??
    null;
  if (toolId == null) return { toolId: null, impositionId: null };

  const impositionId = await resolveFirstImpositionForTool(toolId);
  return { toolId, impositionId };
}
