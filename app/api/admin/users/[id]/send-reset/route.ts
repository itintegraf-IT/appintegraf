import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";
import { createUserToken } from "@/lib/tokens";
import { sendPasswordResetEmail, sendAccountActivationEmail } from "@/lib/email";
import { logAuthAudit, getRequestIp } from "@/lib/auth-audit";

/**
 * POST /api/admin/users/{id}/send-reset
 * Body: { kind?: "reset" | "activation" }
 * - "reset" (default): pošle uživateli obnovu hesla (platnost 30 min).
 * - "activation": pošle aktivační link (platnost 7 dní) – pro nově zakládané účty bez hesla.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const adminId = parseInt(session.user.id, 10);
  if (!(await isAdmin(adminId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const kind = body.kind === "activation" ? "activation" : "reset";

  const user = await prisma.users.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "Uživatel nenalezen" }, { status: 404 });
  }
  if (!user.email) {
    return NextResponse.json(
      { error: "Uživatel nemá nastavený e-mail – odkaz nelze odeslat." },
      { status: 400 }
    );
  }

  const ip = await getRequestIp();
  const admin = await prisma.users.findUnique({
    where: { id: adminId },
    select: { first_name: true, last_name: true },
  });
  const invitedBy = admin ? `${admin.first_name} ${admin.last_name}`.trim() : null;

  if (kind === "activation") {
    const { token, expiresAt } = await createUserToken({
      userId: user.id,
      purpose: "account_activation",
      ip,
    });
    const sendResult = await sendAccountActivationEmail({
      toEmail: user.email,
      toName: `${user.first_name} ${user.last_name}`.trim() || user.username,
      username: user.username,
      token,
      expiresAt,
      invitedBy,
    });
    await logAuthAudit({
      userId: adminId,
      targetUserId: user.id,
      action: "account_activation_sent",
      details: { by_admin: true, emailed: sendResult.success },
    });
    if (!sendResult.success) {
      return NextResponse.json(
        { error: `Token vytvořen, ale e-mail se nepodařilo odeslat: ${sendResult.error}` },
        { status: 500 }
      );
    }
  } else {
    const { token, expiresAt } = await createUserToken({
      userId: user.id,
      purpose: "password_reset",
      ip,
    });
    const sendResult = await sendPasswordResetEmail({
      toEmail: user.email,
      toName: `${user.first_name} ${user.last_name}`.trim() || user.username,
      token,
      expiresAt,
    });
    await logAuthAudit({
      userId: adminId,
      targetUserId: user.id,
      action: "admin_sent_reset_link",
      details: { emailed: sendResult.success },
    });
    if (!sendResult.success) {
      return NextResponse.json(
        { error: `Token vytvořen, ale e-mail se nepodařilo odeslat: ${sendResult.error}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
