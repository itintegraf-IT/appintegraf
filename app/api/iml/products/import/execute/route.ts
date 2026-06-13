import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import {
  validateMapping,
  type ColumnMapping,
  type ImportResolutions,
} from "@/lib/iml-product-import-parse";
import { runProductImportExecuteOnDir } from "@/lib/iml-product-import-run";
import { takeImportSessionDir } from "@/lib/iml-product-import-session";
import { cleanupTempDir } from "@/lib/backup/zip-read";
import { withImportTempDir } from "@/lib/iml-product-import-upload";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění importovat produkty" }, { status: 403 });
  }

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { first_name: true, last_name: true },
  });
  const editorName = user ? `${user.first_name} ${user.last_name}` : `user_${userId}`;

  try {
    const formData = await req.formData();
    const mappingStr = formData.get("mapping") as string | null;
    const resolutionsStr = formData.get("resolutions") as string | null;

    const mapping = mappingStr ? (JSON.parse(mappingStr) as ColumnMapping) : null;
    const mappingError = validateMapping(mapping);
    if (mappingError) {
      return NextResponse.json({ error: mappingError }, { status: 400 });
    }

    const resolutions: ImportResolutions = resolutionsStr
      ? (JSON.parse(resolutionsStr) as ImportResolutions)
      : { default: "skip", byCode: {} };

    const sessionId = String(formData.get("sessionId") || "");
    let result;

    if (sessionId) {
      const tempDir = takeImportSessionDir(sessionId, userId);
      try {
        result = await runProductImportExecuteOnDir(
          tempDir,
          mapping!,
          resolutions,
          userId,
          editorName
        );
      } finally {
        await cleanupTempDir(tempDir);
      }
    } else {
      result = await withImportTempDir(formData, (tempDir) =>
        runProductImportExecuteOnDir(tempDir, mapping!, resolutions, userId, editorName)
      );
    }

    return NextResponse.json({
      success: true,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      imported: result.created + result.updated,
      errors: result.errors,
      totalErrors: result.totalErrors,
      files: result.files,
    });
  } catch (e) {
    console.error("IML product import execute error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chyba při importu" },
      { status: 500 }
    );
  }
}
