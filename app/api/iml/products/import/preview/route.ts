import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import {
  autoMapHeaders,
  validateMapping,
  type ColumnMapping,
} from "@/lib/iml-product-import-parse";
import {
  runProductImportPreviewCore,
  runProductImportPreviewLight,
} from "@/lib/iml-product-import-run";
import { findCsvInExtractedDir, walkMediaFiles } from "@/lib/iml-product-import-zip";
import {
  isLightPreviewMode,
  parseLightPreviewFromFormData,
  withImportTempDir,
} from "@/lib/iml-product-import-upload";

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
    const mappingStr = formData.get("mapping") as string | null;
    const userMapping: ColumnMapping | null = mappingStr
      ? (JSON.parse(mappingStr) as ColumnMapping)
      : null;
    const checkConflicts = formData.get("checkConflicts") === "true";

    let preview;
    let suggestedMapping: ColumnMapping;

    if (isLightPreviewMode(formData)) {
      const parsed = await parseLightPreviewFromFormData(formData);
      suggestedMapping = autoMapHeaders(parsed.headers);
      const mapping: ColumnMapping = {
        ...suggestedMapping,
        ...(userMapping ?? {}),
      };
      const mappingError = validateMapping(mapping);
      if (checkConflicts && mappingError) {
        return NextResponse.json({ error: mappingError }, { status: 400 });
      }
      preview = await runProductImportPreviewLight(parsed, mapping);
    } else {
      preview = await withImportTempDir(formData, async (tempDir) => {
        const { headers, dataRows, csvRelativePath } = await findCsvInExtractedDir(tempDir);
        const mediaFiles = await walkMediaFiles(tempDir);
        const suggested = autoMapHeaders(headers);
        const mapping: ColumnMapping = {
          ...suggested,
          ...(userMapping ?? {}),
        };
        return runProductImportPreviewCore(
          { headers, dataRows, csvRelativePath, mediaFiles },
          mapping
        );
      });
      suggestedMapping = autoMapHeaders(preview.headers);
    }

    const mappingError = validateMapping({
      ...suggestedMapping,
      ...(userMapping ?? {}),
    });
    if (checkConflicts && mappingError) {
      return NextResponse.json({ error: mappingError }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      headers: preview.headers,
      csvRelativePath: preview.csvRelativePath,
      rowCount: preview.rowCount,
      previewRows: preview.previewRows,
      conflicts: checkConflicts ? preview.conflicts : [],
      newCount: checkConflicts ? preview.newCount : preview.rowCount,
      fileIndex: preview.fileIndex,
      suggestedMapping,
      mappingError: checkConflicts ? mappingError : null,
    });
  } catch (e) {
    console.error("IML product import preview error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chyba při náhledu importu" },
      { status: 500 }
    );
  }
}
