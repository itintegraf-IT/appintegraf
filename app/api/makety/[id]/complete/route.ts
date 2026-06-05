import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { userCanCompleteMaketa } from "@/lib/makety-access";
import { notifyMaketaDone } from "@/lib/makety-notify";
import { dismissNotificationsForLink } from "@/lib/notifications-dismiss";

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

  if (!(await userCanCompleteMaketa(userId, id))) {
    return NextResponse.json({ error: "Nemáte oprávnění potvrdit dokončení" }, { status: 403 });
  }

  const maketa = await prisma.makety.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      created_by: true,
      body: true,
      order_number: true,
    },
  });
  if (!maketa) {
    return NextResponse.json({ error: "Maketa nenalezena" }, { status: 404 });
  }
  if (maketa.status === "done") {
    return NextResponse.json({ success: true, alreadyDone: true });
  }
  if (maketa.status === "cancelled") {
    return NextResponse.json({ error: "Zrušenou maketu nelze dokončit" }, { status: 400 });
  }

  await prisma.makety.update({
    where: { id },
    data: { status: "done" },
  });

  await dismissNotificationsForLink(`/makety/${id}`);

  await notifyMaketaDone({
    maketaId: id,
    doneByUserId: userId,
    creatorUserId: maketa.created_by,
    bodyPreview: maketa.body,
    orderNumber: maketa.order_number,
  });

  return NextResponse.json({ success: true });
}
