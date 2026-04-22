import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { isValidPantoneCode, normalizePantoneCode } from "@/lib/iml-pantone";

/**
 * Validace Pantone kódu:
 *   POST { code: "p485 c" } →
 *     200 { normalized: "P 485 C", exists: true,  id: 12 }
 *     200 { normalized: "P 485 C", exists: false, id: null }
 *     400 { error: "…", field: "code" }  (syntax)
 *
 * Používá se v editoru barev produktu: při onBlur na kód barvy.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const raw = typeof body.code === "string" ? body.code : "";
  const normalized = normalizePantoneCode(raw);
  if (!isValidPantoneCode(normalized)) {
    return NextResponse.json(
      {
        error: "Neplatný Pantone kód (A–Z, 0–9, mezera, pomlčka; max 32 znaků)",
        field: "code",
      },
      { status: 400 }
    );
  }

  const found = await prisma.iml_pantone_colors.findUnique({
    where: { code: normalized },
    select: { id: true, code: true, name: true, hex: true, is_active: true },
  });

  return NextResponse.json({
    normalized,
    exists: !!found,
    id: found?.id ?? null,
    color: found ?? null,
  });
}
