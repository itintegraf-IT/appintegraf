import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canManageImlShapes } from "@/lib/iml-permissions";
import { bridgeDieCutsToCatalogs } from "@/lib/iml/die-cuts-bridge";

/** Jednorázový bridge legacy výseků → tvary/nástroje/montáže. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageImlShapes(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
  const report = await bridgeDieCutsToCatalogs({ dryRun: body.dryRun === true });
  return NextResponse.json({ success: true, report });
}
