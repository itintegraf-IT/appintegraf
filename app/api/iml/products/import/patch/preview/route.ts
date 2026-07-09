import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import {
  autoMapHeaders,
  parseSpreadsheetFromBuffer,
  validatePatchMapping,
  type ColumnMapping,
} from "@/lib/iml-product-import-parse";
import { runProductPatchPreview } from "@/lib/iml-product-import-patch";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění importovat produkty" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mappingStr = formData.get("mapping") as string | null;

    if (!file?.size) {
      return NextResponse.json({ error: "Žádný soubor" }, { status: 400 });
    }

    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".csv") && !ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
      return NextResponse.json(
        { error: "Podporované formáty: CSV, XLSX, XLS" },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const { headers, dataRows } = parseSpreadsheetFromBuffer(buf, file.name);

    if (headers.length === 0 || dataRows.length === 0) {
      return NextResponse.json({ error: "Soubor nemá žádná data k importu" }, { status: 400 });
    }

    const suggestedMapping = autoMapHeaders(headers);
    const userMapping: ColumnMapping | null = mappingStr
      ? (JSON.parse(mappingStr) as ColumnMapping)
      : null;
    const mapping: ColumnMapping = { ...suggestedMapping, ...(userMapping ?? {}) };

    const mappingError = validatePatchMapping(mapping);
    if (mappingError && userMapping) {
      return NextResponse.json({ error: mappingError }, { status: 400 });
    }

    const preview = await runProductPatchPreview(headers, dataRows, mapping);

    return NextResponse.json({
      success: true,
      headers: preview.headers,
      previewRows: preview.previewRows,
      rowCount: preview.rowCount,
      suggestedMapping,
      foundCount: preview.foundCount,
      notFoundCodes: preview.notFoundCodes,
      rowSummaries: preview.rowSummaries,
      mappingError,
    });
  } catch (e) {
    console.error("IML product patch preview error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chyba při náhledu doplnění" },
      { status: 500 }
    );
  }
}
