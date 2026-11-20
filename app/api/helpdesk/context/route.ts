import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageHelpdesk } from "@/lib/helpdesk/access";
import { getDepartmentMembers } from "@/lib/equipment-departments";

/** GET – kontext pro helpdesk UI */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const canManage = await canManageHelpdesk(userId);
  const itMembers = await getDepartmentMembers("IT");

  let requesters: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  }[] = [];

  if (canManage) {
    const idRows = await prisma.helpdesk_tickets.findMany({
      select: { requester_id: true },
      distinct: ["requester_id"],
    });
    const ids = idRows.map((r) => r.requester_id);
    if (ids.length > 0) {
      requesters = await prisma.users.findMany({
        where: { id: { in: ids } },
        select: { id: true, first_name: true, last_name: true, email: true },
        orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
      });
    }
  }

  return NextResponse.json({
    userId,
    canManageHelpdesk: canManage,
    itMembers,
    requesters,
  });
}
