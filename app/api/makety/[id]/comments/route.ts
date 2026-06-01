import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { userCanViewMaketa } from "@/lib/makety-access";
import { notifyMaketaRecipients } from "@/lib/makety-notify";

export async function GET(
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

  const maketaId = parseInt((await params).id, 10);
  if (Number.isNaN(maketaId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanViewMaketa(userId, maketaId))) {
    return NextResponse.json({ error: "Maketa nenalezena" }, { status: 404 });
  }

  const comments = await prisma.makety_comments.findMany({
    where: { maketa_id: maketaId },
    orderBy: { created_at: "asc" },
    include: {
      users: { select: { id: true, first_name: true, last_name: true } },
    },
  });

  return NextResponse.json({ comments });
}

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

  const maketaId = parseInt((await params).id, 10);
  if (Number.isNaN(maketaId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanViewMaketa(userId, maketaId))) {
    return NextResponse.json({ error: "Maketa nenalezena" }, { status: 404 });
  }

  const maketa = await prisma.makety.findUnique({
    where: { id: maketaId },
    select: {
      id: true,
      status: true,
      order_number: true,
      assignee_user_id: true,
      created_by: true,
    },
  });
  if (!maketa) {
    return NextResponse.json({ error: "Maketa nenalezena" }, { status: 404 });
  }
  if (maketa.status === "cancelled") {
    return NextResponse.json({ error: "Ke zrušené maketě nelze přidat komentář" }, { status: 400 });
  }

  const json = await req.json().catch(() => ({}));
  const body = typeof json.body === "string" ? json.body.trim() : "";
  if (!body) {
    return NextResponse.json({ error: "Vyplňte text komentáře" }, { status: 400 });
  }

  const comment = await prisma.makety_comments.create({
    data: {
      maketa_id: maketaId,
      user_id: userId,
      body,
    },
    include: {
      users: { select: { id: true, first_name: true, last_name: true } },
    },
  });

  const notifyIds = new Set<number>();
  if (maketa.assignee_user_id != null && maketa.assignee_user_id !== userId) {
    notifyIds.add(maketa.assignee_user_id);
  }
  if (maketa.created_by !== userId) {
    notifyIds.add(maketa.created_by);
  }
  for (const uid of notifyIds) {
    await notifyMaketaRecipients({
      maketaId,
      bodyPreview: body,
      orderNumber: maketa.order_number,
      kind: "comment",
      assigneeUserId: uid,
      excludeUserId: userId,
    });
  }

  return NextResponse.json({ comment });
}
