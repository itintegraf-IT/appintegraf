import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getUsersWithModuleAdmin } from "@/lib/auth-utils";
import { canManageHelpdesk } from "@/lib/helpdesk/access";
import { HELPDESK_CATEGORIES, HELPDESK_PRIORITIES } from "@/lib/helpdesk/labels";
import { generateHelpdeskTicketNumber } from "@/lib/helpdesk/ticket-number";
import type { helpdesk_category, helpdesk_priority } from "@prisma/client";

const ticketInclude = {
  users_requester: { select: { id: true, first_name: true, last_name: true, email: true } },
  users_assigned: { select: { id: true, first_name: true, last_name: true, email: true } },
};

/** GET – IT fronta (správci helpdesku) */
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

  const where: Record<string, unknown> = {};
  if (statusFilter === "open") {
    where.status = { not: "uzavreno" };
  } else if (statusFilter !== "all") {
    where.status = statusFilter;
  }

  const tickets = await prisma.helpdesk_tickets.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: 100,
    include: ticketInclude,
  });

  return NextResponse.json({ tickets });
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
          link: `/pozadavky?tab=helpdesk&view=queue&id=${ticket.id}`,
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
