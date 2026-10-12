/**
 * Best-effort bridge: z legacy `iml_die_cuts` vytvoří návrhy tvarů / nástrojů / montáží.
 * Nepřepisuje produkty (párování zůstává ruční dle §5.3).
 */

import { prisma } from "@/lib/db";
import {
  mapLegacyMachineToTechnology,
  type ImlToolTechnology,
} from "@/lib/iml/shape-tool-constants";

function parseDimsFromFormat(
  format: string | null | undefined
): { width: number; height: number } | null {
  if (!format?.trim()) return null;
  const m = format.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const width = parseFloat(m[1]);
  const height = parseFloat(m[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

export type BridgeReport = {
  shapesCreated: number;
  toolsCreated: number;
  impositionsCreated: number;
  assignmentsCreated: number;
  skipped: string[];
  errors: string[];
};

export async function bridgeDieCutsToCatalogs(options?: {
  dryRun?: boolean;
}): Promise<BridgeReport> {
  const dryRun = options?.dryRun === true;
  const report: BridgeReport = {
    shapesCreated: 0,
    toolsCreated: 0,
    impositionsCreated: 0,
    assignmentsCreated: 0,
    skipped: [],
    errors: [],
  };

  const dieCuts = await prisma.iml_die_cuts.findMany({
    where: { is_active: true },
    orderBy: { id: "asc" },
  });

  for (const dc of dieCuts) {
    const code = dc.label_shape_code?.trim();
    if (!code) {
      report.skipped.push(`die_cut #${dc.id}: prázdný kód tvaru`);
      continue;
    }

    const dims = parseDimsFromFormat(dc.die_cut_format);
    if (!dims) {
      report.skipped.push(
        `die_cut #${dc.id} (${code}): nelze parsovat rozměr z „${dc.die_cut_format ?? ""}“`
      );
      continue;
    }

    try {
      let shape = await prisma.iml_shape_catalog.findUnique({
        where: { shape_code: code.slice(0, 30) },
      });
      if (!shape) {
        if (!dryRun) {
          shape = await prisma.iml_shape_catalog.create({
            data: {
              shape_code: code.slice(0, 30),
              shape_type: "OTHER",
              width_mm: dims.width,
              height_mm: dims.height,
              internal_note: dc.internal_name,
            },
          });
        }
        report.shapesCreated++;
      }

      const origCode = (dc.die_cut_tool_code?.trim() || `LEGACY-${dc.id}`).slice(0, 30);
      let technology: ImlToolTechnology =
        mapLegacyMachineToTechnology(dc.primary_machine) ?? "MONTEX";
      const newCode = `IML${String(dc.id).padStart(4, "0")}`.slice(0, 30);

      let tool = await prisma.iml_tool_catalog.findFirst({
        where: {
          OR: [{ tool_code_orig: origCode }, { tool_code_new: newCode }],
        },
      });
      if (!tool) {
        if (!dryRun) {
          tool = await prisma.iml_tool_catalog.create({
            data: {
              tool_code_new: newCode,
              tool_code_orig: origCode,
              technology,
              note: dc.note,
              status: "ACTIVE",
            },
          });
        }
        report.toolsCreated++;
      }

      if (!dryRun && shape && tool) {
        const existingAssign = await prisma.iml_shape_tool_assignment.findFirst({
          where: { shape_id: shape.id, tool_id: tool.id },
        });
        if (!existingAssign) {
          const hasPrimary = await prisma.iml_shape_tool_assignment.findFirst({
            where: { shape_id: shape.id, priority: "PRIMARY" },
          });
          await prisma.iml_shape_tool_assignment.create({
            data: {
              shape_id: shape.id,
              tool_id: tool.id,
              priority: hasPrimary ? "ALT_1" : "PRIMARY",
            },
          });
          report.assignmentsCreated++;
        }

        const assembly = dc.assembly_code?.trim();
        if (assembly) {
          const existingImp = await prisma.iml_imposition_catalog.findFirst({
            where: { tool_id: tool.id, imposition_code: assembly.slice(0, 30) },
          });
          if (!existingImp) {
            await prisma.iml_imposition_catalog.create({
              data: {
                tool_id: tool.id,
                imposition_code: assembly.slice(0, 30),
                positions_count:
                  dc.positions_on_sheet ?? dc.labels_per_sheet ?? 1,
                layout_type: "SOLO",
                description: `Bridge z die_cut #${dc.id}`,
              },
            });
            report.impositionsCreated++;
          }
        }
      } else if (dryRun) {
        report.assignmentsCreated++;
        if (dc.assembly_code?.trim()) report.impositionsCreated++;
      }
    } catch (e) {
      report.errors.push(
        `die_cut #${dc.id}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  return report;
}
