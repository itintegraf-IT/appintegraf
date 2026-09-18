import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadVykresy, canWriteVykresy } from "@/lib/vykresy/access";
import {
  isVykresyDocumentKind,
  type VykresyDocumentKind,
} from "@/lib/vykresy/constants";
import type { Prisma } from "@prisma/client";

const listInclude = {
  departments: { select: { id: true, name: true } },
  vykresy_machines: { select: { id: true, name: true } },
  users_created_by: { select: { id: true, first_name: true, last_name: true } },
} as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadVykresy(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const documentKind = (req.nextUrl.searchParams.get("document_kind") ?? "").trim();
  const departmentId = parseInt(req.nextUrl.searchParams.get("department_id") ?? "", 10);
  const machineId = parseInt(req.nextUrl.searchParams.get("machine_id") ?? "", 10);

  const where: Prisma.vykresyWhereInput = {};
  if (q) {
    where.name = { contains: q };
  }
  if (documentKind && isVykresyDocumentKind(documentKind)) {
    where.document_kind = documentKind;
  }
  if (Number.isFinite(departmentId) && departmentId > 0) {
    where.department_id = departmentId;
  }
  if (Number.isFinite(machineId) && machineId > 0) {
    where.machine_id = machineId;
  }

  try {
    const items = await prisma.vykresy.findMany({
      where,
      orderBy: { updated_at: "desc" },
      take: 200,
      include: listInclude,
    });
    return NextResponse.json({ items });
  } catch (e) {
    console.error("vykresy GET:", e);
    return NextResponse.json({ error: "Chyba při načítání" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteVykresy(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Vyplňte název." }, { status: 400 });
    }

    const kindRaw = typeof body.document_kind === "string" ? body.document_kind.trim() : "";
    if (!isVykresyDocumentKind(kindRaw)) {
      return NextResponse.json({ error: "Neplatný typ dokumentu." }, { status: 400 });
    }
    const document_kind: VykresyDocumentKind = kindRaw;

    let department_id: number | null = null;
    if (body.department_id != null && body.department_id !== "") {
      const d = parseInt(String(body.department_id), 10);
      if (!Number.isFinite(d) || d <= 0) {
        return NextResponse.json({ error: "Neplatné oddělení." }, { status: 400 });
      }
      const dep = await prisma.departments.findUnique({ where: { id: d }, select: { id: true } });
      if (!dep) {
        return NextResponse.json({ error: "Oddělení nenalezeno." }, { status: 400 });
      }
      department_id = d;
    }

    let machine_id: number | null = null;
    if (body.machine_id != null && body.machine_id !== "") {
      const m = parseInt(String(body.machine_id), 10);
      if (!Number.isFinite(m) || m <= 0) {
        return NextResponse.json({ error: "Neplatný stroj." }, { status: 400 });
      }
      const machine = await prisma.vykresy_machines.findUnique({
        where: { id: m },
        select: { id: true },
      });
      if (!machine) {
        return NextResponse.json({ error: "Stroj nenalezen." }, { status: 400 });
      }
      machine_id = m;
    }

    const description =
      typeof body.description === "string" ? body.description.trim() || null : null;

    const item = await prisma.vykresy.create({
      data: {
        name: name.slice(0, 255),
        document_kind,
        department_id,
        machine_id,
        description,
        created_by: userId,
      },
      include: listInclude,
    });

    return NextResponse.json({ item });
  } catch (e) {
    console.error("vykresy POST:", e);
    return NextResponse.json({ error: "Chyba při ukládání" }, { status: 500 });
  }
}
