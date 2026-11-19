import { beforeEach, describe, expect, it, vi } from "vitest";

const findShapeTool = vi.fn();
const findShapeToolPrimary = vi.fn();
const findShapeToolAny = vi.fn();
const findImpositionForTool = vi.fn();
const findImpositionFirst = vi.fn();
const findShape = vi.fn();
const findTool = vi.fn();
const findImposition = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    iml_shape_tool_assignment: {
      findFirst: (...args: unknown[]) => {
        const where = (args[0] as { where?: Record<string, unknown> })?.where ?? {};
        if (where.tool_id != null && where.shape_id != null && where.priority == null) {
          return findShapeTool(...args);
        }
        if (where.priority === "PRIMARY") return findShapeToolPrimary(...args);
        return findShapeToolAny(...args);
      },
    },
    iml_imposition_catalog: {
      findFirst: (...args: unknown[]) => {
        const where = (args[0] as { where?: Record<string, unknown> })?.where ?? {};
        if (where.id != null) return findImpositionForTool(...args);
        return findImpositionFirst(...args);
      },
      findUnique: (...args: unknown[]) => findImposition(...args),
    },
    iml_shape_catalog: {
      findUnique: (...args: unknown[]) => findShape(...args),
    },
    iml_tool_catalog: {
      findUnique: (...args: unknown[]) => findTool(...args),
    },
  },
}));

import {
  buildProductFieldsFromShapeSelection,
  resolveValidatedShapeSelection,
} from "./product-shape-sync";

describe("resolveValidatedShapeSelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("při stale montáži z jiného nástroje vezme první montáž nástroje tvaru", async () => {
    // Nástroj 10 patří k tvaru 1
    findShapeTool.mockResolvedValue({ tool_id: 10 });
    // Montáž 99 nepatří k nástroji 10
    findImpositionForTool.mockResolvedValue(null);
    // Výchozí montáž nástroje 10
    findImpositionFirst.mockResolvedValue({ id: 20 });

    const result = await resolveValidatedShapeSelection({
      shapeId: 1,
      toolId: 10,
      impositionId: 99, // stale z předchozího tvaru
    });

    expect(result).toEqual({ toolId: 10, impositionId: 20 });
    expect(findImpositionFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tool_id: 10 } })
    );
  });

  it("při nástroji nepatřícím k tvaru resetuje na PRIMARY + první montáž", async () => {
    findShapeTool.mockResolvedValue(null);
    findShapeToolPrimary.mockResolvedValue({ tool_id: 5 });
    findImpositionFirst.mockResolvedValue({ id: 7 });

    const result = await resolveValidatedShapeSelection({
      shapeId: 2,
      toolId: 99, // stale tool
      impositionId: 88,
    });

    expect(result).toEqual({ toolId: 5, impositionId: 7 });
  });
});

describe("buildProductFieldsFromShapeSelection po validaci", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skaláry berou nový tvar a validovanou montáž, ne stará client data", async () => {
    findShape.mockResolvedValue({
      shape_code: "014-IML-LID",
      width_mm: 114.2,
      height_mm: 114.2,
    });
    findTool.mockResolvedValue({
      tool_code_orig: "0009A",
      tool_code_new: "0009A",
    });
    findImposition.mockResolvedValue({
      imposition_code: "0009A-48",
      positions_count: 48,
    });

    const synced = await buildProductFieldsFromShapeSelection({
      shapeId: 1,
      toolId: 10,
      impositionId: 20,
    });

    expect(synced.label_shape_code).toBe("014-IML-LID");
    expect(synced.die_cut_tool_code).toBe("0009A");
    expect(synced.assembly_code).toBe("0009A-48");
    expect(synced.positions_on_sheet).toBe(48);
    expect(synced.labels_per_sheet).toBe(48);
    expect(synced.product_format).toBe("114.2×114.2");
  });
});
