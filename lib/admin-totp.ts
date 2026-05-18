import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth-utils";

export async function requireAdminApi(): Promise<
  | { ok: true; adminId: number }
  | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Neautorizováno" }, { status: 401 }),
    };
  }
  const adminId = parseInt(session.user.id, 10);
  if (isNaN(adminId) || !(await isAdmin(adminId))) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 }),
    };
  }
  return { ok: true, adminId };
}

export function parseUserIdParam(id: string): number | null {
  const parsed = parseInt(id, 10);
  return isNaN(parsed) ? null : parsed;
}
