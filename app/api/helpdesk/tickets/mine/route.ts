import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const ticketInclude = {
  users_requester: { select: { id: true, first_name: true, last_name: true, email: true } },
  users_assigned: { select: { id: true, first_name: true, last_name: true, email: true } },
};

/** GET – tickety aktuálního uživatele */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);

  const tickets = await prisma.helpdesk_tickets.findMany({
    where: { requester_id: userId },
    orderBy: { created_at: "desc" },
    take: 50,
    include: ticketInclude,
  });

  return NextResponse.json({ tickets });
}
