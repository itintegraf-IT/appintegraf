import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** GET – seznam notifikací přihlášeného uživatele */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  const where: { user_id: number; read_at?: null } = { user_id: userId };
  if (unreadOnly) {
    where.read_at = null;
  }

  const notifications = await prisma.notifications.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: 50,
  });

  const unreadCount = await prisma.notifications.count({
    where: { user_id: userId, read_at: null },
  });

  return NextResponse.json({ notifications, unreadCount });
}
