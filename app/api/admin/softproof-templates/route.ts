import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth-utils";
import {
  loadSoftproofTemplates,
  saveSoftproofTemplates,
} from "@/lib/makety-softproof-templates-db";
import { sanitizeSoftproofTemplate, type SoftproofTemplate } from "@/lib/makety-softproof-templates";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }
  const templates = await loadSoftproofTemplates();
  return NextResponse.json({ templates });
}

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
    const raw = Array.isArray(body.templates) ? body.templates : [];
    const templates: SoftproofTemplate[] = [];
    for (const item of raw) {
      const t = sanitizeSoftproofTemplate(item);
      if (t) templates.push(t);
    }
    const saved = await saveSoftproofTemplates(templates, userId);
    return NextResponse.json({ success: true, templates: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba při ukládání šablon";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
