import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { listAmbiguousImpositionsForBackfill } from "@/lib/iml/imposition-shapes";

/** Montáže bez užitků, které nešly jednoznačně backfillnout (ruční doplnění). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const items = await listAmbiguousImpositionsForBackfill();
  return NextResponse.json({ count: items.length, items });
}
