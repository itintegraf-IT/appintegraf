import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { userCanViewMaketa } from "@/lib/makety-access";
import { notifyMaketaUsers } from "@/lib/makety-notify";
import {
  buildMaketyCommentParticipants,
  parseNotifyUserIds,
} from "@/lib/makety-comment-participants";
import type { MaketyWorkType } from "@/lib/makety-work-type";

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

  const maketaMeta = await prisma.makety.findUnique({
    where: { id: maketaId },
    select: {
      work_type: true,
      users_creator: { select: { id: true, first_name: true, last_name: true } },
      users_assignee: { select: { id: true, first_name: true, last_name: true } },
      users_prepress: { select: { id: true, first_name: true, last_name: true } },
      users_final_approver: {
        select: { id: true, first_name: true, last_name: true },
      },
    },
  });

  const workType = (
    maketaMeta?.work_type === "grafika" ? "grafika" : "maketa"
  ) as MaketyWorkType;
  const allParticipants = maketaMeta
    ? buildMaketyCommentParticipants({
        workType,
        creator: maketaMeta.users_creator,
        assignee: maketaMeta.users_assignee,
        prepress: maketaMeta.users_prepress,
        finalApprover: maketaMeta.users_final_approver,
      })
    : [];
  const roleByUserId = new Map(allParticipants.map((p) => [p.userId, p.roleLabel]));

  const notifyIds = new Set<number>();
  for (const c of comments) {
    for (const id of parseNotifyUserIds(c.notify_user_ids)) {
      notifyIds.add(id);
    }
  }

  const notifyUsers =
    notifyIds.size > 0
      ? await prisma.users.findMany({
          where: { id: { in: [...notifyIds] } },
          select: { id: true, first_name: true, last_name: true },
        })
      : [];
  const notifyNameById = new Map(
    notifyUsers.map((u) => [u.id, `${u.first_name} ${u.last_name}`.trim()])
  );

  return NextResponse.json({
    comments: comments.map((c) => {
      const ids = parseNotifyUserIds(c.notify_user_ids);
      return {
        ...c,
        notify_user_ids: ids,
        notify_users: ids.map((id) => ({
          id,
          name: notifyNameById.get(id) ?? `#${id}`,
          roleLabel: roleByUserId.get(id) ?? null,
        })),
      };
    }),
  });
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
      prepress_user_id: true,
      final_approver_user_id: true,
      work_type: true,
      users_creator: { select: { id: true, first_name: true, last_name: true } },
      users_assignee: { select: { id: true, first_name: true, last_name: true } },
      users_prepress: { select: { id: true, first_name: true, last_name: true } },
      users_final_approver: {
        select: { id: true, first_name: true, last_name: true },
      },
    },
  });
  if (!maketa) {
    return NextResponse.json({ error: "Maketa nenalezena" }, { status: 404 });
  }
  if (maketa.status === "cancelled") {
    return NextResponse.json(
      { error: "Ke zrušené maketě nelze přidat komentář" },
      { status: 400 }
    );
  }

  const json = await req.json().catch(() => ({}));
  const body = typeof json.body === "string" ? json.body.trim() : "";
  if (!body) {
    return NextResponse.json({ error: "Vyplňte text komentáře" }, { status: 400 });
  }

  const workType = (maketa.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
  const participants = buildMaketyCommentParticipants({
    workType,
    excludeUserId: userId,
    creator: maketa.users_creator,
    assignee: maketa.users_assignee,
    prepress: maketa.users_prepress,
    finalApprover: maketa.users_final_approver,
  });
  const allowedIds = new Set(participants.map((p) => p.userId));

  const requestedIds = parseNotifyUserIds(json.notifyUserIds);
  const invalid = requestedIds.filter((id) => !allowedIds.has(id));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: "Nelze upozornit uživatele mimo účastníky zakázky" },
      { status: 400 }
    );
  }

  const comment = await prisma.makety_comments.create({
    data: {
      maketa_id: maketaId,
      user_id: userId,
      body,
      notify_user_ids:
        requestedIds.length > 0
          ? (requestedIds as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
    },
    include: {
      users: { select: { id: true, first_name: true, last_name: true } },
    },
  });

  if (requestedIds.length > 0) {
    await notifyMaketaUsers({
      maketaId,
      userIds: requestedIds,
      bodyPreview: body,
      orderNumber: maketa.order_number,
      kind: "comment",
      excludeUserId: userId,
      workType: maketa.work_type,
    });
  }

  const roleById = new Map(participants.map((p) => [p.userId, p.roleLabel]));

  return NextResponse.json({
    comment: {
      ...comment,
      notify_user_ids: requestedIds,
      notify_users: requestedIds.map((id) => {
        const p = participants.find((x) => x.userId === id);
        return {
          id,
          name: p ? `${p.firstName} ${p.lastName}`.trim() : `#${id}`,
          roleLabel: roleById.get(id) ?? null,
        };
      }),
    },
  });
}
