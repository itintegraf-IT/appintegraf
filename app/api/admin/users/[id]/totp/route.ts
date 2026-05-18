import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseUserIdParam, requireAdminApi } from "@/lib/admin-totp";

/** GET /api/admin/users/{id}/totp – stav 2FA uživatele */
export async function GET(
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
    select: {
      totp_enabled: true,
      totp_enrollment_required: true,
      totp_enabled_at: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Uživatel nenalezen" }, { status: 404 });
  }

  const waitingEnrollment =
    user.totp_enrollment_required === true && user.totp_enabled !== true;

  return NextResponse.json({
    enabled: user.totp_enabled === true,
    required: user.totp_enrollment_required === true,
    waitingEnrollment,
    enabledAt: user.totp_enabled_at,
  });
}
