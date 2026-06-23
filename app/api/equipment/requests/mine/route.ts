import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** GET – požadavky na techniku aktuálního uživatele */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Uživatel nenalezen" }, { status: 404 });
  }

  const requests = await prisma.equipment_requests.findMany({
    where: {
      OR: [{ requester_user_id: userId }, { requester_user_id: null, requester_email: user.email }],
    },
    orderBy: { created_at: "desc" },
    take: 50,
    include: {
      users_it: { select: { id: true, first_name: true, last_name: true } },
      users_approval: { select: { id: true, first_name: true, last_name: true } },
    },
  });

  return NextResponse.json({ requests });
}
