import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { userCanApproveMaketaQuote } from "@/lib/makety-access";
import { notifyMaketaRecipients } from "@/lib/makety-notify";
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

  if (!(await userCanApproveMaketaQuote(userId, id))) {
    return NextResponse.json({ error: "Nemáte oprávnění zamítnout nabídku" }, { status: 403 });
  }

  let body: { mode?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  const mode = String(body.mode ?? "").toLowerCase();
  if (mode !== "cancel" && mode !== "rework") {
    return NextResponse.json({ error: "Zvolte režim zamítnutí: cancel nebo rework" }, { status: 400 });
  }

  const reason = String(body.reason ?? "").trim() || null;

  const existing = await prisma.makety.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      work_type: true,
      assignee_user_id: true,
      order_number: true,
      quote_production_description: true,
      body: true,
    },
  });
  if (!existing || existing.work_type !== "maketa" || existing.status !== "quote_submitted") {
    return NextResponse.json({ error: "Maketa není připravena k zamítnutí" }, { status: 400 });
  }

  if (mode === "cancel") {
    await prisma.makety.update({
      where: { id },
      data: {
        status: "cancelled",
        rejection_reason: reason,
      },
    });
  } else {
    await prisma.makety.update({
      where: { id },
      data: {
        status: "awaiting_quote",
        quote_price: null,
        quote_production_description: null,
        quote_submitted_at: null,
        quote_submitted_by: null,
        rejection_reason: reason,
        queue_position: null,
      },
    });
  }

  await notifyMaketaRecipients({
    maketaId: id,
    bodyPreview: reason ?? existing.quote_production_description ?? existing.body,
    orderNumber: existing.order_number,
    kind: "quote_rejected",
    assigneeUserId: existing.assignee_user_id,
    excludeUserId: userId,
  });

  revalidateMaketyViews();
  return NextResponse.json({ success: true, mode });
}
