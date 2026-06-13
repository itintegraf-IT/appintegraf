import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import {
  cancelImportSession,
  createImportSession,
} from "@/lib/iml-product-import-session";

async function requireImportWriteAccess() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Neautorizováno" }, { status: 401 }) };
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return { error: NextResponse.json({ error: "Nemáte oprávnění importovat produkty" }, { status: 403 }) };
  }
  return { userId };
}

export async function POST() {
  const access = await requireImportWriteAccess();
  if ("error" in access) return access.error;

  try {
    const sessionId = await createImportSession(access.userId);
    return NextResponse.json({ success: true, sessionId });
  } catch (e) {
    console.error("IML product import session create error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chyba při vytváření relace importu" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const access = await requireImportWriteAccess();
  if ("error" in access) return access.error;

  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "Chybí sessionId" }, { status: 400 });
  }

  try {
    await cancelImportSession(sessionId, access.userId);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("IML product import session cancel error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chyba při rušení relace importu" },
      { status: 500 }
    );
  }
}
