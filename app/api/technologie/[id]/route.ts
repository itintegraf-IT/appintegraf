import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadTechnologie, canWriteTechnologie } from "@/lib/technologie/access";
import { deleteTechnologieRecord } from "@/lib/technologie/delete-record";
import {
  parseOptionalPrintMachineId,
  parseOptionalSheetSizeId,
  parseOptionalSheetTypeId,
} from "@/lib/technologie/parse-body";

const detailInclude = {
  technologie_sheet_types: { select: { id: true, name: true } },
  technologie_sheet_sizes: { select: { id: true, name: true } },
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

    const sheetType = await parseOptionalSheetTypeId(body.sheet_type_id);
    if (!sheetType.ok) {
      return NextResponse.json({ error: sheetType.error }, { status: 400 });
    }
    const sheetSize = await parseOptionalSheetSizeId(body.sheet_size_id);
    if (!sheetSize.ok) {
      return NextResponse.json({ error: sheetSize.error }, { status: 400 });
    }
    const printMachine = await parseOptionalPrintMachineId(body.print_machine_id);
    if (!printMachine.ok) {
      return NextResponse.json({ error: printMachine.error }, { status: 400 });
    }

    const format_text =
      typeof body.format_text === "string" ? body.format_text.trim().slice(0, 64) || null : null;
    const note = typeof body.note === "string" ? body.note.trim() || null : null;

    const item = await prisma.technologie.update({
      where: { id },
      data: {
        code: code.slice(0, 32),
        name: name.slice(0, 255),
        sheet_type_id: sheetType.value,
        sheet_size_id: sheetSize.value,
        print_machine_id: printMachine.value,
        format_text,
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
