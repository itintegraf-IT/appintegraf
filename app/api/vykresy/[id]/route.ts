import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadVykresy, canWriteVykresy } from "@/lib/vykresy/access";
import { deleteVykresRecord } from "@/lib/vykresy/delete-record";
import {
  isVykresyDocumentKind,
  type VykresyDocumentKind,
} from "@/lib/vykresy/constants";

const detailInclude = {
  departments: { select: { id: true, name: true } },
  vykresy_machines: { select: { id: true, name: true } },
  users_created_by: { select: { id: true, first_name: true, last_name: true } },
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadVykresy(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const item = await prisma.vykresy.findUnique({
    where: { id },
    include: detailInclude,
  });
  if (!item) {
    return NextResponse.json({ error: "Záznam nenalezen" }, { status: 404 });
  }

  return NextResponse.json({ item });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteVykresy(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.vykresy.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Záznam nenalezen" }, { status: 404 });
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

    const item = await prisma.vykresy.update({
      where: { id },
      data: {
        name: name.slice(0, 255),
        document_kind,
        department_id,
        machine_id,
        description,
        updated_at: new Date(),
      },
      include: detailInclude,
    });

    return NextResponse.json({ item });
  } catch (e) {
    console.error("vykresy PUT:", e);
    return NextResponse.json({ error: "Chyba při ukládání" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteVykresy(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const result = await deleteVykresRecord(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true });
}
