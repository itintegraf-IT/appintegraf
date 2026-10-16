import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageImlShapes } from "@/lib/iml-permissions";
import { parseSpreadsheetFromBuffer } from "@/lib/iml-product-import-parse";
import {
  autoMapShapeColumns,
  parseShapeImportRow,
  type ShapeColumnMapping,
} from "@/lib/iml/shapes-import";

async function findOrCreateTool(
  toolCode: string,
  technology: string
): Promise<{ id: number; created: boolean }> {
  const existing = await prisma.iml_tool_catalog.findFirst({
    where: {
      OR: [{ tool_code_new: toolCode }, { tool_code_orig: toolCode }],
    },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const created = await prisma.iml_tool_catalog.create({
    data: {
      tool_code_new: toolCode,
      tool_code_orig: toolCode,
      technology,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

async function ensureDefaultImposition(toolId: number, toolCode: string): Promise<void> {
  const count = await prisma.iml_imposition_catalog.count({
    where: { tool_id: toolId },
  });
  if (count > 0) return;
  await prisma.iml_imposition_catalog.create({
    data: {
      tool_id: toolId,
      imposition_code: `${toolCode}-SOLO`.slice(0, 30),
      positions_count: 1,
      layout_type: "SOLO",
      description: "Výchozí montáž z importu tvarů",
    },
  });
}

async function ensurePrimaryAssignment(shapeId: number, toolId: number): Promise<void> {
  const existingPrimary = await prisma.iml_shape_tool_assignment.findFirst({
    where: { shape_id: shapeId, priority: "PRIMARY" },
    select: { id: true, tool_id: true },
  });
  if (existingPrimary) {
    if (existingPrimary.tool_id !== toolId) {
      await prisma.iml_shape_tool_assignment.update({
        where: { id: existingPrimary.id },
        data: { tool_id: toolId },
      });
    }
    return;
  }
  const sameTool = await prisma.iml_shape_tool_assignment.findFirst({
    where: { shape_id: shapeId, tool_id: toolId },
    select: { id: true },
  });
  if (sameTool) {
    await prisma.iml_shape_tool_assignment.update({
      where: { id: sameTool.id },
      data: { priority: "PRIMARY" },
    });
    return;
  }
  await prisma.iml_shape_tool_assignment.create({
    data: { shape_id: shapeId, tool_id: toolId, priority: "PRIMARY" },
  });
}

async function matchCustomerIds(names: string[]): Promise<{
  ids: number[];
  unmatched: string[];
}> {
  if (names.length === 0) return { ids: [], unmatched: [] };
  const customers = await prisma.iml_customers.findMany({
    select: { id: true, name: true },
  });
  const byLower = new Map(
    customers.map((c) => [c.name.trim().toLocaleLowerCase("cs"), c.id])
  );
  const ids: number[] = [];
  const unmatched: string[] = [];
  for (const name of names) {
    const key = name.trim().toLocaleLowerCase("cs");
    const exact = byLower.get(key);
    if (exact != null) {
      ids.push(exact);
      continue;
    }
    const partial = customers.find((c) => {
      const n = c.name.trim().toLocaleLowerCase("cs");
      return n.includes(key) || key.includes(n);
    });
    if (partial) ids.push(partial.id);
    else unmatched.push(name);
  }
  return { ids: [...new Set(ids)], unmatched };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageImlShapes(userId))) {
    return NextResponse.json(
      { error: "Nemáte oprávnění importovat tvary" },
      { status: 403 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mappingStr = formData.get("mapping") as string | null;
    if (!file?.size) {
      return NextResponse.json({ error: "Žádný soubor" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const { headers, dataRows } = parseSpreadsheetFromBuffer(buf, file.name);
    const autoMapping = autoMapShapeColumns(headers);

    if (dataRows.length === 0) {
      return NextResponse.json(
        { error: "Soubor nemá žádná data", headers, autoMapping },
        { status: 400 }
      );
    }

    const mapping: ShapeColumnMapping =
      mappingStr && mappingStr !== "{}"
        ? (JSON.parse(mappingStr) as ShapeColumnMapping)
        : autoMapping;

    const previewOnly = formData.get("preview") === "1";
    if (previewOnly) {
      return NextResponse.json({ headers, autoMapping, rowCount: dataRows.length });
    }

    if (mapping.shape_code == null || mapping.tool_code == null) {
      return NextResponse.json(
        {
          error: "Mapování musí obsahovat kód tvaru a kód nástroje",
          headers,
          autoMapping,
        },
        { status: 400 }
      );
    }

    let created = 0;
    let updated = 0;
    let toolsCreated = 0;
    let assignmentsUpserted = 0;
    let customersLinked = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const rowNum = i + 2;
      const parsed = parseShapeImportRow(dataRows[i], mapping);
      if ("error" in parsed) {
        errors.push(`Řádek ${rowNum}: ${parsed.error}`);
        continue;
      }

      try {
        const tool = await findOrCreateTool(parsed.tool_code, parsed.technology);
        if (tool.created) toolsCreated++;
        await ensureDefaultImposition(tool.id, parsed.tool_code);

        const { ids: customerIds, unmatched } = await matchCustomerIds(
          parsed.customer_names
        );
        if (unmatched.length > 0) {
          warnings.push(
            `Řádek ${rowNum} (${parsed.shape_code}): zákazníci nenalezeni: ${unmatched.join(", ")}`
          );
        }

        let note = parsed.internal_note;
        if (unmatched.length > 0) {
          const extra = `Nenalezení klienti: ${unmatched.join(", ")}`;
          note = note ? `${note} | ${extra}`.slice(0, 255) : extra.slice(0, 255);
        }

        const shapeData = {
          shape_type: parsed.shape_type,
          width_mm: new Prisma.Decimal(parsed.width_mm),
          height_mm: new Prisma.Decimal(parsed.height_mm),
          internal_note: note,
        };

        const existing = await prisma.iml_shape_catalog.findUnique({
          where: { shape_code: parsed.shape_code },
          select: { id: true },
        });

        let shapeId: number;
        if (existing) {
          await prisma.iml_shape_catalog.update({
            where: { id: existing.id },
            data: shapeData,
          });
          shapeId = existing.id;
          updated++;
        } else {
          const createdShape = await prisma.iml_shape_catalog.create({
            data: {
              shape_code: parsed.shape_code,
              ...shapeData,
            },
            select: { id: true },
          });
          shapeId = createdShape.id;
          created++;
        }

        await ensurePrimaryAssignment(shapeId, tool.id);
        assignmentsUpserted++;

        for (const customerId of customerIds) {
          await prisma.iml_shape_customer_assignment.upsert({
            where: {
              shape_id_customer_id: { shape_id: shapeId, customer_id: customerId },
            },
            create: { shape_id: shapeId, customer_id: customerId },
            update: {},
          });
          customersLinked++;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Řádek ${rowNum}: ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      created,
      updated,
      toolsCreated,
      assignmentsUpserted,
      customersLinked,
      errors,
      warnings,
      headers,
      autoMapping: autoMapShapeColumns(headers),
    });
  } catch (e) {
    console.error("POST /api/iml/shapes/import", e);
    return NextResponse.json({ error: "Import selhal" }, { status: 500 });
  }
}
