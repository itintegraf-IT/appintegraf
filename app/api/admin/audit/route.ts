import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const module = searchParams.get("module") ?? "";
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10) || 50);

  const where: Record<string, unknown> = {};
  if (module) where.module = module;

  const logs = await prisma.audit_log.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: limit,
    include: {
      users: { select: { first_name: true, last_name: true } },
    },
  });

  return NextResponse.json({ logs });
}
