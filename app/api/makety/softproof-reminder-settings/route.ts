import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canViewAllMaketyTypes } from "@/lib/makety-access";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import {
  loadSoftproofReminderSettings,
  saveSoftproofReminderSettings,
} from "@/lib/makety-softproof-reminder-settings";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessMaketyModule(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }
  const settings = await loadSoftproofReminderSettings();
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canViewAllMaketyTypes(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      enabled?: boolean;
      default_on_send?: boolean;
    };
    const saved = await saveSoftproofReminderSettings(
      {
        enabled: body.enabled === true,
        default_on_send: body.default_on_send !== false,
      },
      userId
    );
    return NextResponse.json({ success: true, settings: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba při ukládání";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
