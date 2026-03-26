import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma, type PrismaTransactionClient } from "@/lib/db";
import { getPlanovaniAssignedMachine, getPlanovaniRole } from "@/lib/planovani-auth";
import { checkPlanovaniScheduleViolation } from "@/lib/planovani-schedule";
import { normalizeBlockVariant } from "@/lib/blockVariants";

function serializeBlock<T extends Record<string, unknown>>(b: T) {
  const row = b as unknown as {
    startTime: Date;
    endTime: Date;
    deadlineExpedice?: Date | null;
    dataRequiredDate?: Date | null;
    materialRequiredDate?: Date | null;
    printCompletedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  return {
    ...b,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime.toISOString(),
    deadlineExpedice: row.deadlineExpedice?.toISOString() ?? null,
    dataRequiredDate: row.dataRequiredDate?.toISOString() ?? null,
    materialRequiredDate: row.materialRequiredDate?.toISOString() ?? null,
    printCompletedAt: row.printCompletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const machineParam = url.searchParams.get("machine");
    const role = await getPlanovaniRole(parseInt(session.user.id, 10));

    let machineFilter: string | undefined;
    if (role === "TISKAR") {
      const assigned = await getPlanovaniAssignedMachine(parseInt(session.user.id, 10));
      if (!assigned) {
        return NextResponse.json({ error: "Tiskař nemá přiřazený stroj" }, { status: 400 });
      }
      if (machineParam && machineParam !== assigned) {
        return NextResponse.json({ error: "Forbidden — cizí stroj" }, { status: 403 });
      }
      machineFilter = assigned;
    } else if (machineParam) {
      machineFilter = machineParam;
    }

    const blocks = await prisma.planovani_blocks.findMany({
      where: machineFilter ? { machine: machineFilter } : undefined,
      orderBy: { startTime: "asc" },
    });
    return NextResponse.json(blocks.map((b) => serializeBlock(b as unknown as Record<string, unknown>)));
  } catch (error) {
    console.error("[GET /api/planovani/blocks]", error);
    return NextResponse.json({ error: "Chyba při načítání bloků" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = parseInt(session.user.id, 10);
  const role = await getPlanovaniRole(userId);
  if (!["ADMIN", "PLANOVAT"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();

    if (!body.orderNumber || !body.machine || !body.startTime || !body.endTime) {
      return NextResponse.json(
        { error: "Chybí povinné pole: orderNumber, machine, startTime, endTime" },
        { status: 400 }
      );
    }

    const blockType = body.type ?? "ZAKAZKA";
    const blockVariant = normalizeBlockVariant(body.blockVariant, blockType);
    if (blockType === "ZAKAZKA") {
      const violation = await checkPlanovaniScheduleViolation(
        body.machine,
        new Date(body.startTime),
        new Date(body.endTime)
      );
      if (violation) return NextResponse.json({ error: violation }, { status: 422 });
    }

    const username =
      (session.user as { username?: string }).username ?? session.user.name ?? session.user.email ?? "uživatel";

    const block = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const newBlock = await tx.planovani_blocks.create({
        data: {
          orderNumber: String(body.orderNumber),
          machine: body.machine,
          startTime: new Date(body.startTime),
          endTime: new Date(body.endTime),
          type: blockType,
          blockVariant,
          description: body.description ?? null,
          locked: body.locked ?? false,
          deadlineExpedice: body.deadlineExpedice ? new Date(body.deadlineExpedice) : null,
          dataStatusId: body.dataStatusId ?? null,
          dataStatusLabel: body.dataStatusLabel ?? null,
          dataRequiredDate: body.dataRequiredDate ? new Date(body.dataRequiredDate) : null,
          dataOk: body.dataOk ?? false,
          materialStatusId: body.materialStatusId ?? null,
          materialStatusLabel: body.materialStatusLabel ?? null,
          materialRequiredDate: body.materialRequiredDate ? new Date(body.materialRequiredDate) : null,
          materialOk: body.materialOk ?? false,
          barvyStatusId: body.barvyStatusId ?? null,
          barvyStatusLabel: body.barvyStatusLabel ?? null,
          lakStatusId: body.lakStatusId ?? null,
          lakStatusLabel: body.lakStatusLabel ?? null,
          specifikace: body.specifikace ?? null,
          materialNote: body.materialNote ?? null,
          recurrenceType: body.recurrenceType ?? "NONE",
          recurrenceParentId: body.recurrenceParentId ?? null,
        },
      });

      await tx.planovani_audit_log.create({
        data: {
          blockId: newBlock.id,
          orderNumber: newBlock.orderNumber,
          userId,
          username,
          action: "CREATE",
        },
      });

      return newBlock;
    });

    return NextResponse.json(serializeBlock(block as unknown as Record<string, unknown>), { status: 201 });
  } catch (error) {
    console.error("[POST /api/planovani/blocks]", error);
    return NextResponse.json({ error: "Chyba při vytváření bloku" }, { status: 500 });
  }
}
