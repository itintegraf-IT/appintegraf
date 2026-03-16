import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const [
    usersCount,
    contactsCount,
    equipmentCount,
    eventsCount,
    presentationsCount,
    testsCount,
  ] = await Promise.all([
    prisma.users.count(),
    prisma.users.count({
      where: {
        AND: [
          { OR: [{ display_in_list: true }, { display_in_list: null }] },
          { OR: [{ is_active: true }, { is_active: null }] },
        ],
      },
    }),
    prisma.equipment_items.count(),
    prisma.calendar_events.count(),
    prisma.presentations.count({ where: { is_active: true } }),
    prisma.tests.count({ where: { is_active: true } }),
  ]);

  return NextResponse.json({
    users: usersCount,
    contacts: contactsCount,
    equipment: equipmentCount,
    events: eventsCount,
    presentations: presentationsCount,
    tests: testsCount,
  });
}
