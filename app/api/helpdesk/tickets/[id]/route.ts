import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageHelpdesk } from "@/lib/helpdesk/access";
import { HELPDESK_STATUSES } from "@/lib/helpdesk/labels";
import type { helpdesk_status } from "@prisma/client";

const ticketInclude = {
  users_requester: { select: { id: true, first_name: true, last_name: true, email: true } },
  users_assigned: { select: { id: true, first_name: true, last_name: true, email: true } },
  comments: {
    orderBy: { created_at: "asc" as const },
    include: {
      users: { select: { id: true, first_name: true, last_name: true } },
    },
  },
};

async function canViewTicket(
  userId: number,
  ticket: { requester_id: number }
): Promise<boolean> {
  if (ticket.requester_id === userId) return true;
  return canManageHelpdesk(userId);
}

/** GET – detail ticketu */
export async function GET(
  _req: NextRequest,
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

  const ticket = await prisma.helpdesk_tickets.findUnique({
    where: { id },
    include: ticketInclude,
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket nenalezen" }, { status: 404 });
  }

  if (!(await canViewTicket(userId, ticket))) {
    return NextResponse.json({ error: "Nemáte přístup" }, { status: 403 });
  }

  const isManager = await canManageHelpdesk(userId);
  const comments = isManager
    ? ticket.comments
    : ticket.comments.filter((c) => !c.is_internal);

  return NextResponse.json({ ticket: { ...ticket, comments } });
}

/** PATCH – změna stavu, přiřazení, vyřešení */
export async function PATCH(
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

  const body = await req.json();
  const { status, assigned_to_id, resolution_note, action } = body;

  const isManager = await canManageHelpdesk(userId);
  const isRequester = ticket.requester_id === userId;

  if (action === "close") {
    if (!isRequester && !isManager) {
      return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
    }
    if (ticket.status !== "vyreseno" && ticket.status !== "uzavreno") {
      return NextResponse.json({ error: "Uzavřít lze jen vyřešený ticket" }, { status: 400 });
    }
    const updated = await prisma.helpdesk_tickets.update({
      where: { id },
      data: { status: "uzavreno", closed_at: new Date() },
      include: ticketInclude,
    });
    return NextResponse.json({ ticket: updated });
  }

  if (!isManager) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const data: {
    status?: helpdesk_status;
    assigned_to_id?: number | null;
    resolution_note?: string | null;
    resolved_at?: Date | null;
    closed_at?: Date | null;
  } = {};

  if (status !== undefined) {
    if (!HELPDESK_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Neplatný stav" }, { status: 400 });
    }
    data.status = status as helpdesk_status;
    if (status === "vyreseno") {
      data.resolved_at = new Date();
      if (resolution_note !== undefined) {
        data.resolution_note = resolution_note ? String(resolution_note).trim() : null;
      }
    }
    if (status === "uzavreno") {
      data.closed_at = new Date();
    }
  }

  if (assigned_to_id !== undefined) {
    const assignId = assigned_to_id === null || assigned_to_id === "" ? null : parseInt(String(assigned_to_id), 10);
    if (assignId !== null && Number.isNaN(assignId)) {
      return NextResponse.json({ error: "Neplatné ID řešitele" }, { status: 400 });
    }
    data.assigned_to_id = assignId;
    if (assignId && !data.status) {
      data.status = ticket.status === "novy" ? "prirazeno" : ticket.status;
    }
  }

  if (resolution_note !== undefined && status === "vyreseno") {
    data.resolution_note = resolution_note ? String(resolution_note).trim() : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Žádná data k aktualizaci" }, { status: 400 });
  }

  const updated = await prisma.helpdesk_tickets.update({
    where: { id },
    data,
    include: ticketInclude,
  });

  if (updated.requester_id !== userId) {
    await prisma.notifications.create({
      data: {
        user_id: updated.requester_id,
        title: "Aktualizace helpdesk ticketu",
        message: `Ticket ${updated.ticket_number}: stav „${updated.status}“`,
        type: "helpdesk_update",
        link: `/pozadavky?tab=helpdesk&id=${updated.id}`,
      },
    });
  }

  return NextResponse.json({ ticket: updated });
}
