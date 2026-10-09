import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadVykresy, canWriteVykresy } from "@/lib/vykresy/access";
import {
  isSharedMachineGroup,
  type SharedMachineGroup,
} from "@/lib/shared-machines/constants";

/** Kompatibilní alias → společný číselník shared_machines. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadVykresy(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const activeOnly = req.nextUrl.searchParams.get("active") !== "false";
  const groupRaw = (req.nextUrl.searchParams.get("group") ?? "").trim();
  const group = isSharedMachineGroup(groupRaw) ? groupRaw : undefined;

  const machines = await prisma.shared_machines.findMany({
    where: {
      ...(activeOnly ? { is_active: true } : {}),
      ...(group ? { machine_group: group } : {}),
    },
    orderBy: [{ machine_group: "asc" }, { sort_order: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { vykresy: true, technologie: true } },
    },
  });

  return NextResponse.json({ machines });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteVykresy(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Vyplňte název stroje." }, { status: 400 });
    }

    const groupRaw =
      typeof body.machine_group === "string" ? body.machine_group.trim() : "postpress";
    const machine_group: SharedMachineGroup = isSharedMachineGroup(groupRaw)
      ? groupRaw
      : "postpress";

    const sortOrder = Number(body.sort_order);
    const sort_order = Number.isFinite(sortOrder) ? Math.floor(sortOrder) : 0;
    const is_active = body.is_active !== false;

    const machine = await prisma.shared_machines.create({
      data: {
        name: name.slice(0, 150),
        machine_group,
        sort_order,
        is_active,
      },
      include: {
        _count: { select: { vykresy: true, technologie: true } },
      },
    });

    return NextResponse.json({ machine });
  } catch (e) {
    console.error("vykresy machines POST:", e);
    return NextResponse.json({ error: "Chyba při ukládání" }, { status: 500 });
  }
}
