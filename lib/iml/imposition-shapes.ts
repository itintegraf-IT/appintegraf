import { prisma } from "@/lib/db";

export type ImpositionShapeInput = {
  shape_id: number;
  positions_on_sheet: number;
  is_primary?: boolean;
};

const CUT_DEVICE_NAMES = new Set(["řezačka", "rezacka", "řezání", "rezani"]);

export function isCutDeviceName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  return CUT_DEVICE_NAMES.has(name.trim().toLocaleLowerCase("cs"));
}

export function sumPositions(shapes: ImpositionShapeInput[]): number {
  return shapes.reduce((acc, s) => acc + Math.max(0, s.positions_on_sheet), 0);
}

export async function assertImpositionCodeAvailable(
  code: string,
  excludeId?: number | null
): Promise<string | null> {
  const trimmed = code.trim();
  const shapeClash = await prisma.iml_shape_catalog.findFirst({
    where: { shape_code: trimmed },
    select: { id: true },
  });
  if (shapeClash) {
    return `Kód montáže nesmí být totožný s kódem tvaru („${trimmed}“). Použijte prefix Montáž / MT.`;
  }

  const existing = await prisma.iml_imposition_catalog.findFirst({
    where: {
      imposition_code: trimmed,
      ...(excludeId != null ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) return `Kód montáže „${trimmed}“ už existuje.`;
  return null;
}

export async function resolveCutOnlyAllowed(params: {
  is_cut_only: boolean;
  die_cut_device_id: number | null;
  tool_id: number | null;
}): Promise<{ ok: true } | { error: string }> {
  let deviceIsCut = false;
  if (params.die_cut_device_id != null) {
    const device = await prisma.technologie_die_cut_devices.findUnique({
      where: { id: params.die_cut_device_id },
      select: { name: true },
    });
    deviceIsCut = isCutDeviceName(device?.name);
  }

  const cutMode = params.is_cut_only || deviceIsCut;
  if (!cutMode && params.tool_id == null) {
    return { error: "Chybí výsekový nástroj (povinný mimo režim řezání)." };
  }
  return { ok: true };
}

/** Nahradí řádky užitků a vynuluje cizí is_primary pro stejné tvary. */
export async function replaceImpositionShapes(
  impositionId: number,
  shapes: ImpositionShapeInput[]
): Promise<void> {
  const primaryShapeIds = shapes.filter((s) => s.is_primary).map((s) => s.shape_id);

  await prisma.$transaction(async (tx) => {
    if (primaryShapeIds.length > 0) {
      await tx.iml_imposition_shapes.updateMany({
        where: {
          shape_id: { in: primaryShapeIds },
          imposition_id: { not: impositionId },
          is_primary: true,
        },
        data: { is_primary: false },
      });
    }

    await tx.iml_imposition_shapes.deleteMany({ where: { imposition_id: impositionId } });

    if (shapes.length > 0) {
      await tx.iml_imposition_shapes.createMany({
        data: shapes.map((s) => ({
          imposition_id: impositionId,
          shape_id: s.shape_id,
          positions_on_sheet: s.positions_on_sheet,
          is_primary: !!s.is_primary,
        })),
      });
    }

    const total = sumPositions(shapes);
    if (total > 0) {
      await tx.iml_imposition_catalog.update({
        where: { id: impositionId },
        data: { positions_count: total },
      });
    }
  });
}

export const IMPOSITION_INCLUDE = {
  tool: {
    select: { id: true, tool_code_new: true, tool_code_orig: true, technology: true },
  },
  sheet_size: { select: { id: true, name: true } },
  print_machine: { select: { id: true, name: true } },
  die_cut_device: { select: { id: true, name: true } },
  shapes: {
    include: {
      shape: {
        select: { id: true, shape_code: true, shape_type: true, width_mm: true, height_mm: true },
      },
    },
    orderBy: { id: "asc" as const },
  },
} as const;

/**
 * Montáže s tool_id, které nemají žádný řádek užitku a nelze je jednoznačně
 * backfillnout (0 nebo >1 tvar s PRIMARY na stejném nástroji).
 */
export async function listAmbiguousImpositionsForBackfill(): Promise<
  Array<{
    id: number;
    imposition_code: string;
    tool_id: number;
    tool_code_new: string | null;
    primary_shape_count: number;
  }>
> {
  const withoutShapes = await prisma.iml_imposition_catalog.findMany({
    where: {
      tool_id: { not: null },
      shapes: { none: {} },
    },
    select: {
      id: true,
      imposition_code: true,
      tool_id: true,
      tool: { select: { tool_code_new: true } },
    },
    orderBy: { imposition_code: "asc" },
    take: 500,
  });

  const out: Array<{
    id: number;
    imposition_code: string;
    tool_id: number;
    tool_code_new: string | null;
    primary_shape_count: number;
  }> = [];

  for (const row of withoutShapes) {
    if (row.tool_id == null) continue;
    const primary_shape_count = await prisma.iml_shape_tool_assignment.count({
      where: { tool_id: row.tool_id, priority: "PRIMARY" },
    });
    if (primary_shape_count === 1) continue; // mělo by jít dojet backfillem
    out.push({
      id: row.id,
      imposition_code: row.imposition_code,
      tool_id: row.tool_id,
      tool_code_new: row.tool?.tool_code_new ?? null,
      primary_shape_count,
    });
  }

  return out;
}
