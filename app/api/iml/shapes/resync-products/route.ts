import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canManageImlShapes } from "@/lib/iml-permissions";
import { resyncProductsForShapes } from "@/lib/iml/product-shape-sync";

/**
 * Přepočítá denormalizovaná výseková pole na produktech z katalogu tvarů.
 * Body: { shape_id?: number } — bez shape_id = všechny tvary s alespoň jedním produktem.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageImlShapes(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { shape_id?: unknown };
  let shapeId: number | null = null;
  if (body.shape_id != null && body.shape_id !== "") {
    const n = Number(body.shape_id);
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json({ error: "Neplatné shape_id" }, { status: 400 });
    }
    shapeId = n;
  }

  try {
    const result = await resyncProductsForShapes(shapeId);
    return NextResponse.json({
      success: true,
      shapes: result.shapes,
      products: result.products,
    });
  } catch (e) {
    console.error("POST /api/iml/shapes/resync-products", e);
    return NextResponse.json({ error: "Přepočet selhal" }, { status: 500 });
  }
}
