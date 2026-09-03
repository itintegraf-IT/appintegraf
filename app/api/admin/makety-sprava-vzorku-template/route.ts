import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canViewAllMaketyTypes } from "@/lib/makety-access";
import {
  loadSpravaVzorkuNotifyTemplate,
  saveSpravaVzorkuNotifyTemplate,
} from "@/lib/makety-sprava-vzorku-template-db";
import { sanitizeSpravaVzorkuNotifyTemplate } from "@/lib/makety-sprava-vzorku-template";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canViewAllMaketyTypes(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }
  const template = await loadSpravaVzorkuNotifyTemplate();
  return NextResponse.json({ template });
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
    const body = await req.json();
    const sanitized = sanitizeSpravaVzorkuNotifyTemplate(body.template ?? body);
    if (!sanitized) {
      return NextResponse.json(
        { error: "Šablona musí obsahovat předmět, titulek a text zprávy" },
        { status: 400 }
      );
    }
    const saved = await saveSpravaVzorkuNotifyTemplate(sanitized, userId);
    return NextResponse.json({ success: true, template: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba při ukládání šablony";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
