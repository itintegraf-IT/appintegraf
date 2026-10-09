import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadTechnologie, canWriteTechnologie } from "@/lib/technologie/access";
import {
  parseOptionalPrintMachineId,
  parseOptionalSheetSizeId,
  parseOptionalSheetTypeId,
} from "@/lib/technologie/parse-body";
import type { Prisma } from "@prisma/client";

const listInclude = {
  technologie_sheet_types: { select: { id: true, name: true } },
  technologie_sheet_sizes: { select: { id: true, name: true } },
  shared_machines: { select: { id: true, name: true, machine_group: true } },
  users_created_by: { select: { id: true, first_name: true, last_name: true } },
} as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadTechnologie(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const sheetTypeId = parseInt(req.nextUrl.searchParams.get("sheet_type_id") ?? "", 10);
  const sheetSizeId = parseInt(req.nextUrl.searchParams.get("sheet_size_id") ?? "", 10);
  const printMachineId = parseInt(req.nextUrl.searchParams.get("print_machine_id") ?? "", 10);

  const where: Prisma.technologieWhereInput = {};
  if (q) {
    where.OR = [
      { code: { contains: q } },
      { name: { contains: q } },
      { format_text: { contains: q } },
    ];
  }
  if (Number.isFinite(sheetTypeId) && sheetTypeId > 0) {
    where.sheet_type_id = sheetTypeId;
  }
  if (Number.isFinite(sheetSizeId) && sheetSizeId > 0) {
    where.sheet_size_id = sheetSizeId;
  }
  if (Number.isFinite(printMachineId) && printMachineId > 0) {
    where.print_machine_id = printMachineId;
  }

  try {
    const items = await prisma.technologie.findMany({
      where,
      orderBy: { updated_at: "desc" },
      take: 200,
      include: listInclude,
    });
    return NextResponse.json({ items });
  } catch (e) {
    console.error("technologie GET:", e);
    return NextResponse.json({ error: "Chyba při načítání" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteTechnologie(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám" }, { status: 403 });
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

    const existingCode = await prisma.technologie.findUnique({
      where: { code: code.slice(0, 32) },
      select: { id: true },
    });
    if (existingCode) {
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

    const item = await prisma.technologie.create({
      data: {
        code: code.slice(0, 32),
        name: name.slice(0, 255),
        sheet_type_id: sheetType.value,
        sheet_size_id: sheetSize.value,
        print_machine_id: printMachine.value,
        format_text,
        note,
        created_by: userId,
      },
      include: listInclude,
    });

    return NextResponse.json({ item });
  } catch (e) {
    console.error("technologie POST:", e);
    return NextResponse.json({ error: "Chyba při ukládání" }, { status: 500 });
  }
}
