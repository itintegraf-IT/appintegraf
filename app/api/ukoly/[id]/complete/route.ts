import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { userCanCompleteUkol } from "@/lib/ukoly-access";
import { notifyUkolDone } from "@/lib/ukoly-notify";
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
  if (!(await hasModuleAccess(userId, "ukoly", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanCompleteUkol(userId, id))) {
    return NextResponse.json({ error: "Nemáte oprávnění potvrdit splnění" }, { status: 403 });
  }

  const ukol = await prisma.ukoly.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      created_by: true,
      body: true,
      order_number: true,
    },
  });
  if (!ukol) {
    return NextResponse.json({ error: "Úkol nenalezen" }, { status: 404 });
  }
  if (ukol.status === "done") {
    return NextResponse.json({ success: true, alreadyDone: true });
  }
  if (ukol.status === "cancelled") {
    return NextResponse.json({ error: "Zrušený úkol nelze dokončit" }, { status: 400 });
  }

  await prisma.ukoly.update({
    where: { id },
    data: { status: "done" },
  });

  await dismissNotificationsForLink(`/ukoly/${id}`);

  await notifyUkolDone({
    ukolId: id,
    doneByUserId: userId,
    creatorUserId: ukol.created_by,
    bodyPreview: ukol.body,
    orderNumber: ukol.order_number,
  });

  return NextResponse.json({ success: true });
}
