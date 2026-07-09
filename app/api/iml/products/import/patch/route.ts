import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import {
  parseSpreadsheetFromBuffer,
  validatePatchMapping,
  type ColumnMapping,
} from "@/lib/iml-product-import-parse";
import { runProductPatchImport } from "@/lib/iml-product-import-patch";

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
    const file = formData.get("file") as File | null;
    const mappingStr = formData.get("mapping") as string | null;

    if (!file?.size) {
      return NextResponse.json({ error: "Žádný soubor" }, { status: 400 });
    }

    const mapping = mappingStr ? (JSON.parse(mappingStr) as ColumnMapping) : null;
    const mappingError = validatePatchMapping(mapping);
    if (mappingError) {
      return NextResponse.json({ error: mappingError }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const { dataRows } = parseSpreadsheetFromBuffer(buf, file.name);

    if (dataRows.length === 0) {
      return NextResponse.json({ error: "Soubor nemá žádná data k importu" }, { status: 400 });
    }

    const result = await runProductPatchImport(dataRows, mapping!, userId, editorName);

    return NextResponse.json({
      success: true,
      updated: result.updated,
      skipped: result.skipped,
      notFound: result.notFound,
      errors: result.errors,
      totalErrors: result.totalErrors,
    });
  } catch (e) {
    console.error("IML product patch import error:", e);
    return NextResponse.json({ error: "Chyba při doplnění produktů" }, { status: 500 });
  }
}
