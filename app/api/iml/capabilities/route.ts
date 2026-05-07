import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { hasImlSupervisorOverride } from "@/lib/iml-permissions";

/** Klient používá pro Smart UI objednávky (override neaktivních produktů). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k modulu IML" }, { status: 403 });
  }

  const supervisor_override = await hasImlSupervisorOverride(userId);
  return NextResponse.json({ supervisor_override });
}
