import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPlanovaniRole, getPlanovaniDtpMtzUsernames } from "@/lib/planovani-auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getPlanovaniRole(parseInt(session.user.id, 10));
  if (!["ADMIN", "PLANOVAT"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  threeDaysAgo.setHours(0, 0, 0, 0);

  try {
    const usernames = await getPlanovaniDtpMtzUsernames();

    const logs = await prisma.planovani_audit_log.findMany({
      where: {
        createdAt: { gte: threeDaysAgo },
        username: { in: usernames },
      },
      orderBy: { createdAt: "desc" },
    });
    const serialized = logs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    }));
    return NextResponse.json(serialized);
  } catch (error) {
    console.error("[GET /api/planovani/audit/today]", error);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
