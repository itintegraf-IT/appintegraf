import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma, type PrismaTransactionClient } from "@/lib/db";
import { getPlanovaniRole } from "@/lib/planovani-auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const blocks = await prisma.planovani_blocks.findMany({
      orderBy: { startTime: "asc" },
    });
    type BlockRow = (typeof blocks)[number];
    const serialized = blocks.map((b: BlockRow) => ({
      ...b,
      startTime: b.startTime.toISOString(),
      endTime: b.endTime.toISOString(),
      deadlineExpedice: b.deadlineExpedice?.toISOString() ?? null,
      dataRequiredDate: b.dataRequiredDate?.toISOString() ?? null,
      materialRequiredDate: b.materialRequiredDate?.toISOString() ?? null,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    }));
    return NextResponse.json(serialized);
  } catch (error) {
    console.error("[GET /api/planovani/blocks]", error);
    return NextResponse.json({ error: "Chyba při načítání bloků" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getPlanovaniRole(parseInt(session.user.id, 10));
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

    const username = (session.user as { username?: string }).username ?? session.user.name ?? session.user.email ?? "uživatel";

    const block = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const newBlock = await tx.planovani_blocks.create({
        data: {
          orderNumber: String(body.orderNumber),
          machine: body.machine,
          startTime: new Date(body.startTime),
          endTime: new Date(body.endTime),
          type: body.type ?? "ZAKAZKA",
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
          recurrenceType: body.recurrenceType ?? "NONE",
          recurrenceParentId: body.recurrenceParentId ?? null,
        },
      });

      await tx.planovani_audit_log.create({
        data: {
          blockId: newBlock.id,
          orderNumber: newBlock.orderNumber,
          userId: parseInt(session.user.id, 10),
          username,
          action: "CREATE",
        },
      });

      return newBlock;
    });

    const serialized = {
      ...block,
      startTime: block.startTime.toISOString(),
      endTime: block.endTime.toISOString(),
      deadlineExpedice: block.deadlineExpedice?.toISOString() ?? null,
      dataRequiredDate: block.dataRequiredDate?.toISOString() ?? null,
      materialRequiredDate: block.materialRequiredDate?.toISOString() ?? null,
      createdAt: block.createdAt.toISOString(),
      updatedAt: block.updatedAt.toISOString(),
    };
    return NextResponse.json(serialized, { status: 201 });
  } catch (error) {
    console.error("[POST /api/planovani/blocks]", error);
    return NextResponse.json({ error: "Chyba při vytváření bloku" }, { status: 500 });
  }
}
