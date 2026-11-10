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

/**
 * Přepočítá denormalizovaná výseková pole na produktech napojených na tvar.
 * Existující selected_tool_id / selected_imposition_id nepřepisuje — jen doplní null
 * z PRIMARY + první montáže.
 */
export async function resyncProductsForShape(shapeId: number): Promise<number> {
  const products = await prisma.iml_products.findMany({
    where: { shape_id: shapeId },
    select: {
      id: true,
      selected_tool_id: true,
      selected_imposition_id: true,
    },
  });
  if (products.length === 0) return 0;

  const defaults = await resolveDefaultToolAndImposition(shapeId);
  let updated = 0;

  for (const product of products) {
    const toolId = product.selected_tool_id ?? defaults.toolId;
    let impositionId = product.selected_imposition_id;
    if (impositionId == null && toolId != null) {
      impositionId =
        product.selected_tool_id != null
          ? await resolveFirstImpositionForTool(toolId)
          : defaults.impositionId;
    }

    const scalars = await buildProductFieldsFromShapeSelection({
      shapeId,
      toolId,
      impositionId,
    });

    const data: Prisma.iml_productsUpdateInput = { ...scalars };
    if (product.selected_tool_id == null && toolId != null) {
      data.iml_tool_catalog = { connect: { id: toolId } };
    }
    if (product.selected_imposition_id == null && impositionId != null) {
      data.iml_imposition_catalog = { connect: { id: impositionId } };
    }

    await prisma.iml_products.update({ where: { id: product.id }, data });
    updated++;
  }

  return updated;
}

/** Obnoví die_cut_tool_code u produktů s daným selected_tool_id. */
export async function resyncProductsForTool(toolId: number): Promise<number> {
  const tool = await prisma.iml_tool_catalog.findUnique({
    where: { id: toolId },
    select: { tool_code_orig: true, tool_code_new: true },
  });
  if (!tool) return 0;

  const code = tool.tool_code_orig || tool.tool_code_new;
  const result = await prisma.iml_products.updateMany({
    where: { selected_tool_id: toolId },
    data: { die_cut_tool_code: code },
  });
  return result.count;
}

/** Obnoví montážní skaláry u produktů s daným selected_imposition_id. */
export async function resyncProductsForImposition(
  impositionId: number
): Promise<number> {
  const imp = await prisma.iml_imposition_catalog.findUnique({
    where: { id: impositionId },
    select: { imposition_code: true, positions_count: true },
  });
  if (!imp) return 0;

  const result = await prisma.iml_products.updateMany({
    where: { selected_imposition_id: impositionId },
    data: {
      assembly_code: imp.imposition_code,
      positions_on_sheet: imp.positions_count,
      labels_per_sheet: imp.positions_count,
    },
  });
  return result.count;
}

/**
 * Přepočítá produkty pro jeden tvar, nebo pro všechny tvary s alespoň jedním produktem.
 */
export async function resyncProductsForShapes(
  shapeId?: number | null
): Promise<{ shapes: number; products: number }> {
  if (shapeId != null) {
    const products = await resyncProductsForShape(shapeId);
    return { shapes: products > 0 ? 1 : 0, products };
  }

  const linked = await prisma.iml_products.findMany({
    where: { shape_id: { not: null } },
    select: { shape_id: true },
    distinct: ["shape_id"],
  });
  const shapeIds = linked
    .map((r) => r.shape_id)
    .filter((id): id is number => id != null);

  let products = 0;
  for (const id of shapeIds) {
    products += await resyncProductsForShape(id);
  }
  return { shapes: shapeIds.length, products };
}
