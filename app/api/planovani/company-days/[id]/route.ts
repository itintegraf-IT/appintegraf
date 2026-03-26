import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPlanovaniRole } from "@/lib/planovani-auth";

const VALID_MACHINES = ["XL_105", "XL_106"] as const;

function serializeDay(d: {
  startDate: Date;
  endDate: Date;
  createdAt: Date;
} & Record<string, unknown>) {
  return {
    ...d,
    startDate: d.startDate.toISOString(),
    endDate: d.endDate.toISOString(),
    createdAt: d.createdAt.toISOString(),
  };
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getPlanovaniRole(parseInt(session.user.id, 10));
  if (!["ADMIN", "PLANOVAT"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const { startDate, endDate, label, machine } = await req.json();
  if (!startDate || !endDate || !label) {
    return NextResponse.json({ error: "Chybí povinná pole" }, { status: 400 });
  }
  if (machine != null && !VALID_MACHINES.includes(machine)) {
    return NextResponse.json({ error: "Neplatná hodnota stroje" }, { status: 400 });
  }

  const parsedStart = new Date(startDate);
  const parsedEnd = new Date(endDate);
  if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
    return NextResponse.json({ error: "Neplatný formát datumu" }, { status: 400 });
  }

  try {
    const updated = await prisma.planovani_company_days.update({
      where: { id: numId },
      data: { startDate: parsedStart, endDate: parsedEnd, label, machine: machine ?? null },
    });
    return NextResponse.json(serializeDay(updated as Parameters<typeof serializeDay>[0]));
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") {
      return NextResponse.json({ error: "Záznam nenalezen" }, { status: 404 });
    }
    console.error("Company day update failed", err);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getPlanovaniRole(parseInt(session.user.id, 10));
  if (!["ADMIN", "PLANOVAT"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  try {
    await prisma.planovani_company_days.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") {
      return NextResponse.json({ error: "Záznam nenalezen" }, { status: 404 });
    }
    console.error("Company day delete failed", err);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
