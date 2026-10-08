import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageImlTools } from "@/lib/iml-permissions";
import { parseSpreadsheetFromBuffer } from "@/lib/iml-product-import-parse";
import {
  autoMapToolColumns,
  parseToolImportRow,
  type ToolColumnMapping,
} from "@/lib/iml/tools-import";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageImlTools(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění importovat nástroje" }, { status: 403 });
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
    const autoMapping = autoMapToolColumns(headers);

    if (dataRows.length === 0) {
      return NextResponse.json(
        { error: "Soubor nemá žádná data", headers, autoMapping },
        { status: 400 }
      );
    }

    const mapping: ToolColumnMapping =
      mappingStr && mappingStr !== "{}"
        ? (JSON.parse(mappingStr) as ToolColumnMapping)
        : autoMapping;

    const previewOnly = formData.get("preview") === "1";
    if (previewOnly) {
      return NextResponse.json({ headers, autoMapping, rowCount: dataRows.length });
    }

    if (mapping.tool_code_new == null || mapping.tool_code_orig == null) {
      return NextResponse.json(
        {
          error: "Mapování musí obsahovat tool_code_new a tool_code_orig",
          headers,
          autoMapping,
        },
        { status: 400 }
      );
    }

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const parsed = parseToolImportRow(dataRows[i], mapping);
      if ("error" in parsed) {
        errors.push(`Řádek ${i + 2}: ${parsed.error}`);
        continue;
      }

      const existing = await prisma.iml_tool_catalog.findUnique({
        where: { tool_code_new: parsed.tool_code_new },
        select: { id: true },
      });

      if (existing) {
        await prisma.iml_tool_catalog.update({
          where: { id: existing.id },
          data: parsed,
        });
        updated++;
      } else {
        await prisma.iml_tool_catalog.create({ data: parsed });
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      created,
      updated,
      errors,
      headers,
      autoMapping: autoMapToolColumns(headers),
    });
  } catch (e) {
    console.error("POST /api/iml/tools/import", e);
    return NextResponse.json({ error: "Import selhal" }, { status: 500 });
  }
}
