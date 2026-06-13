import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { appendImportSessionBatch } from "@/lib/iml-product-import-session";
import {
  getFolderFilesFromFormData,
  getFolderPathsFromFormData,
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
    const sessionId = String(formData.get("sessionId") || "");
    if (!sessionId) {
      return NextResponse.json({ error: "Chybí sessionId" }, { status: 400 });
    }

    const files = getFolderFilesFromFormData(formData);
    if (files.length === 0) {
      return NextResponse.json({ error: "Dávka neobsahuje žádné soubory" }, { status: 400 });
    }

    const paths = getFolderPathsFromFormData(formData, files);
    const result = await appendImportSessionBatch(sessionId, userId, files, paths);

    return NextResponse.json({
      success: true,
      fileCount: result.fileCount,
      totalBytes: result.totalBytes,
      batchBytes: result.batchBytes,
    });
  } catch (e) {
    console.error("IML product import batch error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chyba při nahrávání dávky" },
      { status: 500 }
    );
  }
}
