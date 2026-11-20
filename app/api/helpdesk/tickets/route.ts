import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getUsersWithModuleAdmin } from "@/lib/auth-utils";
import { canManageHelpdesk } from "@/lib/helpdesk/access";
import {
  HELPDESK_CATEGORIES,
  HELPDESK_PRIORITIES,
  HELPDESK_STATUSES,
} from "@/lib/helpdesk/labels";
import { generateHelpdeskTicketNumber } from "@/lib/helpdesk/ticket-number";
import type {
  helpdesk_category,
  helpdesk_priority,
  helpdesk_status,
  Prisma,
} from "@prisma/client";

const ticketInclude = {
  users_requester: { select: { id: true, first_name: true, last_name: true, email: true } },
  users_assigned: { select: { id: true, first_name: true, last_name: true, email: true } },
};

/** GET – IT fronta / správa (správci helpdesku) */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canManageHelpdesk(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") ?? "open";
  const priority = searchParams.get("priority");
  const category = searchParams.get("category");
  const assignedTo = searchParams.get("assigned_to");
  const requesterIdRaw = searchParams.get("requester_id");
  const q = (searchParams.get("q") ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));

  const where: Prisma.helpdesk_ticketsWhereInput = {};

  if (statusFilter === "open") {
    where.status = { not: "uzavreno" };
  } else if (statusFilter !== "all" && (HELPDESK_STATUSES as readonly string[]).includes(statusFilter)) {
    where.status = statusFilter as helpdesk_status;
  }

  if (priority && (HELPDESK_PRIORITIES as readonly string[]).includes(priority)) {
    where.priority = priority as helpdesk_priority;
  }
  if (category && (HELPDESK_CATEGORIES as readonly string[]).includes(category)) {
    where.category = category as helpdesk_category;
  }

  if (assignedTo === "unassigned") {
    where.assigned_to_id = null;
  } else if (assignedTo === "me") {
    where.assigned_to_id = userId;
  } else if (assignedTo) {
    const n = parseInt(assignedTo, 10);
    if (Number.isFinite(n) && n > 0) where.assigned_to_id = n;
  }

  if (requesterIdRaw) {
    const rid = parseInt(requesterIdRaw, 10);
    if (Number.isFinite(rid) && rid > 0) where.requester_id = rid;
  }

  if (q) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { ticket_number: { contains: q } },
          { subject: { contains: q } },
          { description: { contains: q } },
          { users_requester: { first_name: { contains: q } } },
          { users_requester: { last_name: { contains: q } } },
          { users_requester: { email: { contains: q } } },
        ],
      },
    ];
  }

  const [total, tickets] = await Promise.all([
    prisma.helpdesk_tickets.count({ where }),
    prisma.helpdesk_tickets.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: ticketInclude,
    }),
  ]);

  return NextResponse.json({ tickets, total, page, limit });
}

/** POST – vytvoření ticketu přihlášeným uživatelem */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);

  try {
    const body = await req.json();
    const { subject, description, category = "jine", priority = "stredni" } = body;

    if (!subject?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "Vyplňte předmět a popis" }, { status: 400 });
    }

    const validCategory = HELPDESK_CATEGORIES.includes(category) ? category : "jine";
    const validPriority = HELPDESK_PRIORITIES.includes(priority) ? priority : "stredni";

    const ticketNumber = await generateHelpdeskTicketNumber();

    const ticket = await prisma.helpdesk_tickets.create({
      data: {
        ticket_number: ticketNumber,
        subject: String(subject).trim(),
        description: String(description).trim(),
        category: validCategory as helpdesk_category,
        priority: validPriority as helpdesk_priority,
        status: "novy",
        requester_id: userId,
      },
      include: ticketInclude,
    });

    const adminUserIds = await getUsersWithModuleAdmin("equipment");
    if (adminUserIds.length > 0) {
      await prisma.notifications.createMany({
        data: adminUserIds.map((uid) => ({
          user_id: uid,
          title: "Nový helpdesk ticket",
          message: `${ticket.users_requester.first_name} ${ticket.users_requester.last_name}: ${ticket.subject} (${ticket.ticket_number})`,
          type: "helpdesk_ticket",
          link: `/pozadavky/helpdesk?id=${ticket.id}`,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      ticket,
      message: `Ticket ${ticket.ticket_number} byl vytvořen.`,
    });
  } catch (e) {
    console.error("Helpdesk ticket POST error:", e);
    return NextResponse.json({ error: "Chyba systému" }, { status: 500 });
  }
}
