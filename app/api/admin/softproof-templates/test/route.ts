import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canViewAllMaketyTypes } from "@/lib/makety-access";
import { sendMaketySoftproofEmail } from "@/lib/email";
import { getEmailSettings } from "@/lib/email-settings";
import { sanitizeSoftproofTemplate } from "@/lib/makety-softproof-templates";

export const runtime = "nodejs";

function getBaseUrl(req: NextRequest): string {
  const explicit =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return req.nextUrl.origin;
}

function testNote(locale: string): string {
  if (locale === "en") {
    return "This is a test e-mail of the softproof template. The preview link is not active.";
  }
  if (locale === "de") {
    return "Dies ist eine Test-E-Mail der Softproof-Vorlage. Der Vorschau-Link ist nicht aktiv.";
  }
  return "Toto je testovací e-mail šablony softproofu. Odkaz na náhled není aktivní.";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canViewAllMaketyTypes(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const settings = await getEmailSettings();
  if (!settings.enabled) {
    return NextResponse.json(
      { error: "Odesílání e-mailů je vypnuté. Zapněte SMTP v administraci." },
      { status: 400 }
    );
  }

  let body: { locale?: unknown; template?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  const template = sanitizeSoftproofTemplate(body.template);
  if (!template) {
    return NextResponse.json({ error: "Neplatná šablona" }, { status: 400 });
  }

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { email: true, first_name: true, last_name: true },
  });
  const toEmail = user?.email?.trim() ?? "";
  if (!toEmail) {
    return NextResponse.json(
      { error: "V účtu nemáte vyplněný e-mail." },
      { status: 400 }
    );
  }

  const toName = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || "Test";
  const pageUrl = `${getBaseUrl(req)}/public/softproof/ukazka`;

  const sent = await sendMaketySoftproofEmail({
    toEmail,
    toName,
    maketaId: 0,
    orderNumber: "TEST-001",
    labelCode: "00-00-000",
    pageUrl,
    fileName: "softproof-test.pdf",
    locale: template.locale,
    templateOverride: template,
    message: testNote(template.locale),
  });

  if (!sent.success) {
    return NextResponse.json(
      { error: sent.error ?? "Odeslání testovacího e-mailu selhalo" },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, toEmail });
}
