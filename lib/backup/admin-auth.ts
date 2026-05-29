import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

export async function requireAdminApi(): Promise<
  { ok: true; userId: number } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Neautorizováno" }, { status: 401 }),
    };
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 }),
    };
  }
  return { ok: true, userId };
}
