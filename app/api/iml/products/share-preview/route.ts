import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { sendMaketyClientPlainEmail } from "@/lib/email";
import {
  createImlProductPreviewShare,
  IML_PREVIEW_SHARE_MAX_PRODUCTS,
} from "@/lib/iml-product-preview-shares";

export const runtime = "nodejs";

function getBaseUrl(req: NextRequest): string {
  const explicit =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    product_ids?: number[];
    expires_days?: number;
    title?: string;
    note?: string;
    email?: string;
  };

  const productIds = Array.isArray(body.product_ids)
    ? [...new Set(body.product_ids.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))]
    : [];

  if (productIds.length === 0) {
    return NextResponse.json({ error: "Vyberte alespoň jeden produkt" }, { status: 400 });
  }
  if (productIds.length > IML_PREVIEW_SHARE_MAX_PRODUCTS) {
    return NextResponse.json(
      { error: `Maximálně ${IML_PREVIEW_SHARE_MAX_PRODUCTS} produktů najednou.` },
      { status: 400 }
    );
  }

  const existing = await prisma.iml_products.findMany({
    where: { id: { in: productIds } },
    select: { id: true },
  });
  if (existing.length === 0) {
    return NextResponse.json({ error: "Žádné platné produkty" }, { status: 400 });
  }

  const idSet = new Set(existing.map((p) => p.id));
  const orderedIds = productIds.filter((id) => idSet.has(id));

  const email =
    typeof body.email === "string" && body.email.trim().includes("@")
      ? body.email.trim()
      : null;

  const share = await createImlProductPreviewShare({
    productIds: orderedIds,
    createdBy: userId,
    expiresDays: body.expires_days,
    title: typeof body.title === "string" ? body.title : null,
    note: typeof body.note === "string" ? body.note : null,
    sentToEmail: email,
  });

  const url = `${getBaseUrl(req)}/public/iml-preview/${encodeURIComponent(share.rawToken)}`;

  await logImlAudit({
    userId,
    action: "create",
    tableName: "iml_product_preview_shares",
    recordId: share.id,
    newValues: {
      product_count: orderedIds.length,
      expires_at: share.expiresAt.toISOString(),
      sent_to_email: email,
      title: typeof body.title === "string" ? body.title.trim().slice(0, 255) : null,
    },
  });

  let emailSent = false;
  let emailError: string | undefined;
  if (email) {
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Náhled etiket";
    const text = [
      `Dobrý den,`,
      ``,
      `zasíláme odkaz na náhled ${orderedIds.length} etiket:`,
      url,
      ``,
      `Odkaz platí do ${share.expiresAt.toLocaleString("cs-CZ")}.`,
      body.note?.trim() ? `\nPoznámka:\n${body.note.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const mail = await sendMaketyClientPlainEmail({
      toEmail: email,
      subject: title,
      text,
    });
    emailSent = mail.success;
    emailError = mail.error;
  }

  return NextResponse.json({
    id: share.id,
    url,
    expires_at: share.expiresAt.toISOString(),
    product_count: orderedIds.length,
    email_sent: emailSent,
    ...(emailError ? { email_error: emailError } : {}),
  });
}
