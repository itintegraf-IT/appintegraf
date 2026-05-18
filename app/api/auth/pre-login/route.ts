import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createLoginChallenge } from "@/lib/login-challenge";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/auth-audit";

const GENERIC_ERROR = "Neplatné uživatelské jméno nebo heslo.";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const ip = await getRequestIp();
  const ipKey = ip ? `prelogin:ip:${ip}` : "prelogin:ip:unknown";
  const userKey = `prelogin:user:${username.toLowerCase()}`;

  const [ipLimit, userLimit] = await Promise.all([
    rateLimit({ key: ipKey, max: 20, windowMs: 15 * 60 * 1000 }),
    rateLimit({ key: userKey, max: 10, windowMs: 15 * 60 * 1000 }),
  ]);

  if (!ipLimit.allowed || !userLimit.allowed) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 429 });
  }

  let user;
  try {
    user = await prisma.users.findFirst({
      where: {
        username,
        OR: [{ is_active: true }, { is_active: null }],
      },
      select: {
        id: true,
        password_hash: true,
        password_version: true,
        totp_enabled: true,
        totp_enrollment_required: true,
        totp_secret_enc: true,
      },
    });
  } catch (e) {
    console.error("pre-login DB error:", e);
    return NextResponse.json(
      {
        error:
          "Chyba databáze při přihlášení. Spusťte: npm run migrate:totp-2fa a restartujte dev server.",
      },
      { status: 503 }
    );
  }

  if (!user?.password_hash) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const challenge = await createLoginChallenge({
    userId: user.id,
    passwordVersion: user.password_version ?? 1,
  });

  if (user.totp_enrollment_required && !user.totp_enabled) {
    return NextResponse.json({ next: "totp_enroll", challenge });
  }

  if (user.totp_enabled && user.totp_secret_enc) {
    return NextResponse.json({ next: "totp", challenge });
  }

  return NextResponse.json({ next: "session" });
}
