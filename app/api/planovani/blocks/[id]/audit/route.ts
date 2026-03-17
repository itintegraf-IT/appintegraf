import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPlanovaniRole } from "@/lib/planovani-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getPlanovaniRole(parseInt(session.user.id, 10));
  if (!["ADMIN", "PLANOVAT", "DTP", "MTZ"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  try {
    const logs = await prisma.planovani_audit_log.findMany({
      where: { blockId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    const serialized = logs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    }));
    return NextResponse.json(serialized);
  } catch (error) {
    console.error(`[GET /api/planovani/blocks/${id}/audit]`, error);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
