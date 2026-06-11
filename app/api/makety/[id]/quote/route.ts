import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { userCanSubmitMaketaQuote } from "@/lib/makety-access";
import { notifyMaketaQuoteSubmitted } from "@/lib/makety-notify";
import { revalidateMaketyViews } from "@/lib/makety-revalidate";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessMaketyModule(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanSubmitMaketaQuote(userId, id))) {
    return NextResponse.json({ error: "Nemáte oprávnění odeslat nabídku" }, { status: 403 });
  }

  let body: { quote_price?: unknown; quote_production_description?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  const priceRaw = String(body.quote_price ?? "").trim().replace(",", ".");
  const price = parseFloat(priceRaw);
  if (!priceRaw || Number.isNaN(price) || price < 0) {
    return NextResponse.json({ error: "Vyplňte platnou cenu v Kč" }, { status: 400 });
  }

  const quoteProductionDescription = String(body.quote_production_description ?? "").trim();
  if (!quoteProductionDescription) {
    return NextResponse.json({ error: "Vyplňte popis výroby" }, { status: 400 });
  }

  const existing = await prisma.makety.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      work_type: true,
      created_by: true,
      order_number: true,
      body: true,
    },
  });
  if (!existing || existing.work_type !== "maketa" || existing.status !== "awaiting_quote") {
    return NextResponse.json({ error: "Maketa není ve stavu pro odeslání nabídky" }, { status: 400 });
  }

  await prisma.makety.update({
    where: { id },
    data: {
      status: "quote_submitted",
      quote_price: new Prisma.Decimal(price.toFixed(2)),
      quote_production_description: quoteProductionDescription,
      quote_submitted_at: new Date(),
      quote_submitted_by: userId,
      rejection_reason: null,
    },
  });

  await notifyMaketaQuoteSubmitted({
    maketaId: id,
    creatorUserId: existing.created_by,
    orderNumber: existing.order_number,
    bodyPreview: quoteProductionDescription,
  });

  revalidateMaketyViews();
  return NextResponse.json({ success: true });
}
