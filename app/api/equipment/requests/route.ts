import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

/** GET – seznam požadavků na techniku (pro uživatele s přístupem k modulu Majetek) */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "equipment", "read"))) {
    return NextResponse.json({ error: "Nemáte přístup k modulu Majetek" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") ?? "all";

  const where: Record<string, unknown> = {};
  if (statusFilter !== "all") {
    where.status = statusFilter;
  }

  const requests = await prisma.equipment_requests.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: 100,
    include: {
      users_it: { select: { id: true, first_name: true, last_name: true } },
      users_approval: { select: { id: true, first_name: true, last_name: true } },
    },
  });

  return NextResponse.json({ requests });
}
