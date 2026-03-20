import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth-utils";
import { getEmailSettingsSafe, saveEmailSettings } from "@/lib/email-settings";

/** GET – načtení nastavení e-mailu (bez hesla) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const settings = await getEmailSettingsSafe();
  return NextResponse.json(settings);
}

/** PUT – uložení nastavení e-mailu */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      enabled,
      host,
      port,
      secure,
      user,
      password,
      from,
      fromName,
    } = body;

    await saveEmailSettings(
      {
        enabled: enabled === true || enabled === "true",
        host: typeof host === "string" ? host.trim() : undefined,
        port: port !== undefined ? parseInt(String(port), 10) : undefined,
        secure: secure === true || secure === "true",
        user: typeof user === "string" ? user.trim() : undefined,
        password: typeof password === "string" ? password : undefined,
        from: typeof from === "string" ? from.trim() : undefined,
        fromName: typeof fromName === "string" ? fromName.trim() : undefined,
      },
      userId
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Email settings save error:", e);
    return NextResponse.json(
      { error: "Chyba při ukládání nastavení" },
      { status: 500 }
    );
  }
}
