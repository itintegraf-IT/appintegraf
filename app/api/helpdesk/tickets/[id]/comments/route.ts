import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageHelpdesk } from "@/lib/helpdesk/access";

/** POST – komentář k ticketu */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const ticket = await prisma.helpdesk_tickets.findUnique({ where: { id } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket nenalezen" }, { status: 404 });
  }

  const isManager = await canManageHelpdesk(userId);
  const isRequester = ticket.requester_id === userId;
  if (!isRequester && !isManager) {
    return NextResponse.json({ error: "Nemáte přístup" }, { status: 403 });
  }

  const body = await req.json();
  const { body: commentBody, is_internal = false } = body;

  if (!commentBody?.trim()) {
    return NextResponse.json({ error: "Vyplňte text komentáře" }, { status: 400 });
  }

  if (is_internal && !isManager) {
    return NextResponse.json({ error: "Interní poznámky mohou psát pouze IT" }, { status: 403 });
  }

  const comment = await prisma.helpdesk_comments.create({
    data: {
      ticket_id: id,
      author_id: userId,
      body: String(commentBody).trim(),
      is_internal: Boolean(is_internal) && isManager,
    },
    include: {
      users: { select: { id: true, first_name: true, last_name: true } },
    },
  });

  if (!comment.is_internal) {
    if (isRequester && ticket.assigned_to_id) {
      await prisma.notifications.create({
        data: {
          user_id: ticket.assigned_to_id,
          title: "Nový komentář k ticketu",
          message: `Ticket ${ticket.ticket_number}: odpověď žadatele`,
          type: "helpdesk_comment",
          link: `/pozadavky?tab=helpdesk&view=queue&id=${ticket.id}`,
        },
      });
    } else if (isManager && ticket.requester_id !== userId) {
      await prisma.notifications.create({
        data: {
          user_id: ticket.requester_id,
          title: "Nový komentář k ticketu",
          message: `Ticket ${ticket.ticket_number}: nová zpráva od IT`,
          type: "helpdesk_comment",
          link: `/pozadavky?tab=helpdesk&id=${ticket.id}`,
        },
      });
    }
  }

  return NextResponse.json({ comment });
}
