import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import {
  backfillProductThumbnailsFromPdf,
  countProductsNeedingThumbnail,
  isPdfThumbnailGenerationAvailable,
} from "@/lib/iml-product-thumbnail";

export const maxDuration = 300;

async function requireImlAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Neautorizováno" }, { status: 401 }) };
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "admin"))) {
    return {
      error: NextResponse.json(
        { error: "Vyžadováno oprávnění IML administrátor" },
        { status: 403 }
      ),
    };
  }
  return { userId };
}

export async function GET() {
  const access = await requireImlAdmin();
  if ("error" in access) return access.error;

  try {
    const [remaining, canvasAvailable] = await Promise.all([
      countProductsNeedingThumbnail(),
      isPdfThumbnailGenerationAvailable(),
    ]);
    return NextResponse.json({
      success: true,
      remaining,
      canvasAvailable,
    });
  } catch (e) {
    console.error("IML thumbnail backfill status error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chyba při načtení stavu" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const access = await requireImlAdmin();
  if ("error" in access) return access.error;

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(200, Math.max(1, parseInt(limitParam, 10) || 50)) : 50;

  try {
    const result = await backfillProductThumbnailsFromPdf(access.userId, limit);
    const remaining = await countProductsNeedingThumbnail();

    return NextResponse.json({
      success: true,
      ...result,
      remaining,
    });
  } catch (e) {
    console.error("IML thumbnail backfill error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chyba při backfill miniatur" },
      { status: 500 }
    );
  }
}
