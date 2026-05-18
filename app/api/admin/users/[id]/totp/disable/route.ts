import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseUserIdParam, requireAdminApi } from "@/lib/admin-totp";
import { disableTotpForUser } from "@/lib/totp-user";
import { logAuthAudit } from "@/lib/auth-audit";

/** POST /api/admin/users/{id}/totp/disable – vypne 2FA a invaliduje session uživatele */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const id = parseUserIdParam((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const user = await prisma.users.findUnique({
    where: { id },
    select: { id: true, username: true, totp_enabled: true, totp_secret_enc: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Uživatel nenalezen" }, { status: 404 });
  }

  if (!user.totp_enabled && !user.totp_secret_enc) {
    return NextResponse.json({ error: "2FA není aktivní." }, { status: 400 });
  }

  await disableTotpForUser(id, { invalidateSessions: true });

  await logAuthAudit({
    userId: admin.adminId,
    targetUserId: id,
    action: "totp_disabled_by_admin",
    details: { username: user.username },
  });

  return NextResponse.json({ ok: true });
}
