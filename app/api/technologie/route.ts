import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  canWriteTechnologie,
  getTechnologieListAccess,
} from "@/lib/technologie/access";
import {
  parseOptionalDieCutDeviceId,
  parseOptionalPrintMachineId,
  parseOptionalSheetSizeId,
  parseOptionalSheetTypeId,
} from "@/lib/technologie/parse-body";
import {
  parseTechnologieProducts,
  primaryProductFields,
  technologieProductsInclude,
} from "@/lib/technologie/products";
import type { Prisma } from "@prisma/client";

const listInclude = {
  technologie_sheet_types: { select: { id: true, name: true } },
  technologie_sheet_sizes: { select: { id: true, name: true } },
  shared_machines: { select: { id: true, name: true, machine_group: true } },
  technologie_die_cut_devices: { select: { id: true, name: true } },
  users_created_by: { select: { id: true, first_name: true, last_name: true } },
  technologie_products: technologieProductsInclude,
};

function serializeItem<T extends { technologie_products: Array<{ name: string; format_text: string | null; note: string | null }> }>(
  item: T
) {
  const primary = primaryProductFields(item.technologie_products);
  return {
    ...item,
    name: primary.name,
    format_text: primary.format_text,
    note: primary.note,
    products: item.technologie_products,
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const listAccess = await getTechnologieListAccess(userId);
  if (!listAccess.ok) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const sheetTypeId = parseInt(req.nextUrl.searchParams.get("sheet_type_id") ?? "", 10);
  const sheetSizeId = parseInt(req.nextUrl.searchParams.get("sheet_size_id") ?? "", 10);
  const printMachineId = parseInt(req.nextUrl.searchParams.get("print_machine_id") ?? "", 10);
  const isImlRaw = (req.nextUrl.searchParams.get("is_iml") ?? "").trim().toLowerCase();

  const where: Prisma.technologieWhereInput = {};
  if (q) {
    where.OR = [
      { code: { contains: q } },
      { technologie_products: { some: { name: { contains: q } } } },
      { technologie_products: { some: { format_text: { contains: q } } } },
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
  if (listAccess.forceImlOnly) {
    where.is_iml = true;
  } else if (isImlRaw === "1" || isImlRaw === "true") {
    where.is_iml = true;
  } else if (isImlRaw === "0" || isImlRaw === "false") {
    where.is_iml = false;
  }

  try {
    const rows = await prisma.technologie.findMany({
      where,
      orderBy: { updated_at: "desc" },
      take: 200,
      include: listInclude,
    });
    return NextResponse.json({ items: rows.map(serializeItem) });
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
    const body = (await req.json()) as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) {
      return NextResponse.json({ error: "Vyplňte kód." }, { status: 400 });
    }

    const productsParsed = parseTechnologieProducts(body);
    if (!productsParsed.ok) {
      return NextResponse.json({ error: productsParsed.error }, { status: 400 });
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
    const dieCutDevice = await parseOptionalDieCutDeviceId(body.die_cut_device_id);
    if (!dieCutDevice.ok) {
      return NextResponse.json({ error: dieCutDevice.error }, { status: 400 });
    }

    const is_iml = body.is_iml === true || body.is_iml === 1 || body.is_iml === "1";

    const item = await prisma.technologie.create({
      data: {
        code: code.slice(0, 32),
        sheet_type_id: sheetType.value,
        sheet_size_id: sheetSize.value,
        print_machine_id: printMachine.value,
        die_cut_device_id: dieCutDevice.value,
        is_iml,
        created_by: userId,
        technologie_products: {
          create: productsParsed.products.map((p) => ({
            name: p.name,
            format_text: p.format_text,
            note: p.note,
            sort_order: p.sort_order,
          })),
        },
      },
      include: listInclude,
    });

    return NextResponse.json({ item: serializeItem(item) });
  } catch (e) {
    console.error("technologie POST:", e);
    return NextResponse.json({ error: "Chyba při ukládání" }, { status: 500 });
  }
}
