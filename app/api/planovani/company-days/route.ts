import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPlanovaniRole } from "@/lib/planovani-auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const days = await prisma.planovani_company_days.findMany({
      orderBy: { startDate: "asc" },
    });
    type DayRow = (typeof days)[number];
    const serialized = days.map((d: DayRow) => ({
      ...d,
      startDate: d.startDate.toISOString(),
      endDate: d.endDate.toISOString(),
      createdAt: d.createdAt.toISOString(),
    }));
    return NextResponse.json(serialized);
  } catch (error) {
    console.error("[GET /api/planovani/company-days]", error);
    return NextResponse.json({ error: "Chyba při načítání" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getPlanovaniRole(parseInt(session.user.id, 10));
  if (!["ADMIN", "PLANOVAT"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { startDate, endDate, label } = await req.json();
  if (!startDate || !endDate || !label) {
    return NextResponse.json({ error: "Chybí povinná pole" }, { status: 400 });
  }

  try {
    const day = await prisma.planovani_company_days.create({
      data: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        label,
      },
    });
    return NextResponse.json({
      ...day,
      startDate: day.startDate.toISOString(),
      endDate: day.endDate.toISOString(),
      createdAt: day.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/planovani/company-days]", error);
    return NextResponse.json({ error: "Chyba při vytváření" }, { status: 500 });
  }
}
