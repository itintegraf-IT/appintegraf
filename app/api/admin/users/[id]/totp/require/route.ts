import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseUserIdParam, requireAdminApi } from "@/lib/admin-totp";
import { requireTotpForUser } from "@/lib/totp-user";
import { logAuthAudit } from "@/lib/auth-audit";

/** POST /api/admin/users/{id}/totp/require – admin zapne povinnost 2FA (nastavení dokončí uživatel při přihlášení). */
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
    select: { id: true, username: true, totp_enabled: true, totp_enrollment_required: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Uživatel nenalezen" }, { status: 404 });
  }

  if (user.totp_enabled) {
    return NextResponse.json({ error: "2FA je již aktivní u tohoto uživatele." }, { status: 400 });
  }

  if (user.totp_enrollment_required) {
    return NextResponse.json({
      ok: true,
      message: "2FA je již vyžadována – uživatel ji dokončí při přihlášení.",
    });
  }

  await requireTotpForUser(id);

  await logAuthAudit({
    userId: admin.adminId,
    targetUserId: id,
    action: "totp_required_by_admin",
    details: { username: user.username },
  });

  return NextResponse.json({
    ok: true,
    message:
      "2FA byla zapnuta. Uživatel dokončí nastavení (QR kód) při příštím přihlášení jménem a heslem.",
  });
}
