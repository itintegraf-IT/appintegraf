import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { loadSoftproofTemplates } from "@/lib/makety-softproof-templates-db";

/** Aktivní jazyky šablon pro dialog odeslání softproofu. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessMaketyModule(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }
  const templates = await loadSoftproofTemplates();
  const locales = templates
    .filter((t) => t.isActive)
    .map((t) => ({ locale: t.locale, label: t.label }));
  return NextResponse.json({
    locales: locales.length > 0 ? locales : [{ locale: "cs", label: "Čeština" }],
  });
}
