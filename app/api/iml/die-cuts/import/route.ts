import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { parseSpreadsheetFromBuffer } from "@/lib/iml-product-import-parse";
import { dieCutToProductFields, parseDieCutBody } from "@/lib/iml/die-cuts";
import {
  rowToDieCutBody,
  validateDieCutImportMapping,
  type DieCutColumnMapping,
} from "@/lib/iml/die-cuts-import";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění importovat výseky" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mappingStr = formData.get("mapping") as string | null;

    if (!file?.size) {
      return NextResponse.json({ error: "Žádný soubor" }, { status: 400 });
    }

    const mapping = mappingStr ? (JSON.parse(mappingStr) as DieCutColumnMapping) : null;
    const mappingError = validateDieCutImportMapping(mapping);
    if (mappingError) {
      return NextResponse.json({ error: mappingError }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const { dataRows } = parseSpreadsheetFromBuffer(buf, file.name);

    if (dataRows.length === 0) {
      return NextResponse.json({ error: "Soubor nemá žádná data k importu" }, { status: 400 });
    }

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i].map((c) => (c != null ? String(c) : ""));
      const body = rowToDieCutBody(row, mapping!);
      const parsed = parseDieCutBody(body);

      if ("error" in parsed) {
        errors.push(`Řádek ${i + 2}: ${parsed.error}`);
        continue;
      }

      const existing = await prisma.iml_die_cuts.findUnique({
        where: { label_shape_code: parsed.label_shape_code },
      });

      if (existing) {
        const productFields = dieCutToProductFields(parsed);
        const row = await prisma.$transaction(async (tx) => {
          const updatedRow = await tx.iml_die_cuts.update({
            where: { id: existing.id },
            data: parsed,
          });
          await tx.iml_products.updateMany({
            where: { die_cut_id: existing.id },
            data: productFields,
          });
          return updatedRow;
        });

        await logImlAudit({
          userId,
          action: "update",
          tableName: "iml_die_cuts",
          recordId: existing.id,
          oldValues: existing as unknown as Record<string, unknown>,
          newValues: row as unknown as Record<string, unknown>,
        });
        updated++;
      } else {
        const row = await prisma.iml_die_cuts.create({ data: parsed });
        await logImlAudit({
          userId,
          action: "create",
          tableName: "iml_die_cuts",
          recordId: row.id,
          newValues: { label_shape_code: row.label_shape_code },
        });
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      imported: created + updated,
      created,
      updated,
      errors: errors.slice(0, 20),
      totalErrors: errors.length,
    });
  } catch (e) {
    console.error("IML die-cuts import error:", e);
    return NextResponse.json({ error: "Chyba při importu" }, { status: 500 });
  }
}
