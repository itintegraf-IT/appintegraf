import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadTechnologieRecord, canWriteTechnologie } from "@/lib/technologie/access";
import { deleteTechnologieRecord } from "@/lib/technologie/delete-record";
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

const detailInclude = {
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);

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
  if (!(await canReadTechnologieRecord(userId, item))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  return NextResponse.json({ item: serializeItem(item) });
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
    const body = (await req.json()) as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) {
      return NextResponse.json({ error: "Vyplňte kód." }, { status: 400 });
    }

    const productsParsed = parseTechnologieProducts(body);
    if (!productsParsed.ok) {
      return NextResponse.json({ error: productsParsed.error }, { status: 400 });
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
    const dieCutDevice = await parseOptionalDieCutDeviceId(body.die_cut_device_id);
    if (!dieCutDevice.ok) {
      return NextResponse.json({ error: dieCutDevice.error }, { status: 400 });
    }

    const is_iml = body.is_iml === true || body.is_iml === 1 || body.is_iml === "1";

    const item = await prisma.$transaction(async (tx) => {
      await tx.technologie_products.deleteMany({ where: { technologie_id: id } });
      return tx.technologie.update({
        where: { id },
        data: {
          code: code.slice(0, 32),
          sheet_type_id: sheetType.value,
          sheet_size_id: sheetSize.value,
          print_machine_id: printMachine.value,
          die_cut_device_id: dieCutDevice.value,
          is_iml,
          updated_at: new Date(),
          technologie_products: {
            create: productsParsed.products.map((p) => ({
              name: p.name,
              format_text: p.format_text,
              note: p.note,
              sort_order: p.sort_order,
            })),
          },
        },
        include: detailInclude,
      });
    });

    return NextResponse.json({ item: serializeItem(item) });
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
