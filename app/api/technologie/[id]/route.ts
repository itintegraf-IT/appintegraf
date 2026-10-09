import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadTechnologie, canWriteTechnologie } from "@/lib/technologie/access";
import { deleteTechnologieRecord } from "@/lib/technologie/delete-record";

const detailInclude = {
  technologie_sheet_types: { select: { id: true, name: true } },
  shared_machines: { select: { id: true, name: true, machine_group: true } },
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
  if (!(await canReadTechnologie(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const item = await prisma.technologie.findUnique({
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
  if (!(await canWriteTechnologie(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.technologie.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Záznam nenalezen" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!code) {
      return NextResponse.json({ error: "Vyplňte kód." }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Vyplňte název." }, { status: 400 });
    }

    const duplicate = await prisma.technologie.findFirst({
      where: { code: code.slice(0, 32), NOT: { id } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: "Kód už existuje." }, { status: 400 });
    }

    let sheet_type_id: number | null = null;
    if (body.sheet_type_id != null && body.sheet_type_id !== "") {
      const d = parseInt(String(body.sheet_type_id), 10);
      if (!Number.isFinite(d) || d <= 0) {
        return NextResponse.json({ error: "Neplatný typ archu." }, { status: 400 });
      }
      const row = await prisma.technologie_sheet_types.findUnique({
        where: { id: d },
        select: { id: true },
      });
      if (!row) {
        return NextResponse.json({ error: "Typ archu nenalezen." }, { status: 400 });
      }
      sheet_type_id = d;
    }

    let print_machine_id: number | null = null;
    if (body.print_machine_id != null && body.print_machine_id !== "") {
      const m = parseInt(String(body.print_machine_id), 10);
      if (!Number.isFinite(m) || m <= 0) {
        return NextResponse.json({ error: "Neplatný tiskový stroj." }, { status: 400 });
      }
      const machine = await prisma.shared_machines.findUnique({
        where: { id: m },
        select: { id: true },
      });
      if (!machine) {
        return NextResponse.json({ error: "Tiskový stroj nenalezen." }, { status: 400 });
      }
      print_machine_id = m;
    }

    const format_text =
      typeof body.format_text === "string" ? body.format_text.trim().slice(0, 64) || null : null;
    const sheet_size_text =
      typeof body.sheet_size_text === "string"
        ? body.sheet_size_text.trim().slice(0, 64) || null
        : null;
    const note = typeof body.note === "string" ? body.note.trim() || null : null;

    const item = await prisma.technologie.update({
      where: { id },
      data: {
        code: code.slice(0, 32),
        name: name.slice(0, 255),
        sheet_type_id,
        print_machine_id,
        format_text,
        sheet_size_text,
        note,
        updated_at: new Date(),
      },
      include: detailInclude,
    });

    return NextResponse.json({ item });
  } catch (e) {
    console.error("technologie PUT:", e);
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
  if (!(await canWriteTechnologie(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const result = await deleteTechnologieRecord(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true });
}
