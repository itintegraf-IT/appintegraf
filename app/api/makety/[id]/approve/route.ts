import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { userCanApproveMaketaQuote } from "@/lib/makety-access";
import { nextQueuePositionForAssignee } from "@/lib/makety-queue";
import { notifyMaketaRecipients } from "@/lib/makety-notify";
import { revalidateMaketyViews } from "@/lib/makety-revalidate";

export async function POST(
  _req: NextRequest,
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
    return NextResponse.json({ error: "Nemáte oprávnění schválit nabídku" }, { status: 403 });
  }

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
    return NextResponse.json({ error: "Maketa není připravena ke schválení" }, { status: 400 });
  }
  if (existing.assignee_user_id == null) {
    return NextResponse.json({ error: "Maketa nemá přiřazeného výrobce" }, { status: 400 });
  }

  const queue_position = await nextQueuePositionForAssignee("maketa", existing.assignee_user_id);

  await prisma.makety.update({
    where: { id },
    data: {
      status: "open",
      queue_position,
    },
  });

  await notifyMaketaRecipients({
    maketaId: id,
    bodyPreview: existing.quote_production_description ?? existing.body,
    orderNumber: existing.order_number,
    kind: "quote_approved",
    assigneeUserId: existing.assignee_user_id,
    excludeUserId: userId,
  });

  revalidateMaketyViews();
  return NextResponse.json({ success: true });
}
