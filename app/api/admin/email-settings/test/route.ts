import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { sendTestEmail } from "@/lib/email";

/** POST – odeslání testovacího e-mailu */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  let toEmail = session.user.email;
  let settingsOverride: Parameters<typeof sendTestEmail>[0]["settingsOverride"] | undefined;

  try {
    const body = await req.json().catch(() => ({}));
    if (body.toEmail && typeof body.toEmail === "string") {
      toEmail = body.toEmail.trim();
    }
    if (!toEmail) {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      toEmail = user?.email ?? "";
    }
    if (!toEmail) {
      return NextResponse.json(
        { error: "Není zadán e-mail příjemce a váš účet nemá e-mail." },
        { status: 400 }
      );
    }

    if (body.settingsOverride && typeof body.settingsOverride === "object") {
      const o = body.settingsOverride;
      settingsOverride = {
        host: typeof o.host === "string" ? o.host : undefined,
        port: typeof o.port === "number" ? o.port : undefined,
        secure: o.secure === true,
        user: typeof o.user === "string" ? o.user : undefined,
        password: typeof o.password === "string" ? o.password : undefined,
        from: typeof o.from === "string" ? o.from : undefined,
        fromName: typeof o.fromName === "string" ? o.fromName : undefined,
      };
    }

    const result = await sendTestEmail({
      toEmail,
      toName: session.user.name ?? undefined,
      settingsOverride,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Testovací e-mail byl odeslán." });
  } catch (e) {
    console.error("Test email error:", e);
    return NextResponse.json(
      { error: "Chyba při odesílání testovacího e-mailu" },
      { status: 500 }
    );
  }
}
