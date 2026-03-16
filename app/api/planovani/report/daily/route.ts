import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "Chybí parametr date (YYYY-MM-DD)" }, { status: 400 });
  }

  const [year, month, day] = dateParam.split("-").map(Number);
  const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
  const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999);

  try {
    const blocks = await prisma.planovani_blocks.findMany({
      where: {
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
      },
      orderBy: { startTime: "asc" },
    });

    const serialized = blocks.map((b) => ({
      ...b,
      startTime: b.startTime.toISOString(),
      endTime: b.endTime.toISOString(),
      deadlineExpedice: b.deadlineExpedice?.toISOString() ?? null,
      dataRequiredDate: b.dataRequiredDate?.toISOString() ?? null,
      materialRequiredDate: b.materialRequiredDate?.toISOString() ?? null,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("[GET /api/planovani/report/daily]", error);
    return NextResponse.json({ error: "Chyba při načítání bloků" }, { status: 500 });
  }
}
