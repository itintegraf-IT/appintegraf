import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPlanovaniRole } from "@/lib/planovani-auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getPlanovaniRole(parseInt(session.user.id, 10));
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

  try {
    const logs = await prisma.planovani_audit_log.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    const serialized = logs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    }));
    return NextResponse.json(serialized);
  } catch (error) {
    console.error("[GET /api/planovani/audit]", error);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
