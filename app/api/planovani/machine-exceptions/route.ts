import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPlanovaniRole } from "@/lib/planovani-auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exceptions = await prisma.planovani_machine_schedule_exceptions.findMany({
    orderBy: [{ date: "asc" }, { machine: "asc" }],
  });

  const serialized = exceptions.map((e) => ({
    ...e,
    date: e.date.toISOString(),
    createdAt: e.createdAt.toISOString(),
  }));

  return NextResponse.json(serialized);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getPlanovaniRole(parseInt(session.user.id, 10));
  if (!["ADMIN", "PLANOVAT"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { machine, date, startHour, endHour, isActive, label } = body;

  if (!machine || !date) {
    return NextResponse.json({ error: "machine a date jsou povinné" }, { status: 400 });
  }
  if (typeof startHour !== "number" || startHour < 0 || startHour > 23) {
    return NextResponse.json({ error: "startHour musí být 0–23" }, { status: 400 });
  }
  if (typeof endHour !== "number" || endHour < 1 || endHour > 24) {
    return NextResponse.json({ error: "endHour musí být 1–24" }, { status: 400 });
  }
  if (isActive !== false && startHour >= endHour) {
    return NextResponse.json({ error: "startHour musí být menší než endHour" }, { status: 400 });
  }

  const datePart = String(date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return NextResponse.json({ error: "date musí být ve formátu YYYY-MM-DD" }, { status: 400 });
  }
  const utcMidnight = new Date(`${datePart}T00:00:00.000Z`);

  const exception = await prisma.planovani_machine_schedule_exceptions.upsert({
    where: { machine_date: { machine, date: utcMidnight } },
    update: { startHour, endHour, isActive: isActive ?? true, label: label ?? null },
    create: {
      machine,
      date: utcMidnight,
      startHour,
      endHour,
      isActive: isActive ?? true,
      label: label ?? null,
    },
  });

  return NextResponse.json({
    ...exception,
    date: exception.date.toISOString(),
    createdAt: exception.createdAt.toISOString(),
  });
}
