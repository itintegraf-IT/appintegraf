import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPlanovaniRole } from "@/lib/planovani-auth";
import { checkSlotAgainstSchedule } from "@/lib/planovani-schedule";

type BatchUpdate = {
  id: number;
  startTime: string;
  endTime: string;
  machine: string;
};

function isPrismaNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2025"
  );
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getPlanovaniRole(parseInt(session.user.id, 10));
  if (!["ADMIN", "PLANOVAT"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let updates: BatchUpdate[];
  try {
    const body = await request.json();
    if (!Array.isArray(body.updates) || body.updates.length === 0) {
      return NextResponse.json({ error: "updates musí být neprázdné pole" }, { status: 400 });
    }
    updates = body.updates;
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  for (const u of updates) {
    const start = new Date(u.startTime);
    const end = new Date(u.endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return NextResponse.json({ error: `Neplatné časy pro blok ${u.id}` }, { status: 400 });
    }
  }

  const userId = parseInt(session.user.id, 10);
  const username =
    (session.user as { username?: string }).username ?? session.user.name ?? session.user.email ?? "uživatel";

  const existingBlocks = await prisma.planovani_blocks.findMany({
    where: { id: { in: updates.map((u) => u.id) } },
    select: {
      id: true,
      type: true,
      machine: true,
      startTime: true,
      endTime: true,
      printCompletedAt: true,
      printCompletedByUserId: true,
      printCompletedByUsername: true,
      orderNumber: true,
    },
  });

  const zakazkaUpdates = updates.filter((u) => {
    const existing = existingBlocks.find((b) => b.id === u.id);
    return existing?.type === "ZAKAZKA";
  });

  if (zakazkaUpdates.length > 0) {
    const [schedule, allExceptions] = await Promise.all([
      prisma.planovani_machine_work_hours.findMany(),
      prisma.planovani_machine_schedule_exceptions.findMany({
        where: {
          date: {
            gte: new Date(
              Math.min(...zakazkaUpdates.map((u) => new Date(u.startTime).getTime())) - 24 * 60 * 60 * 1000
            ),
            lte: new Date(
              Math.max(...zakazkaUpdates.map((u) => new Date(u.endTime).getTime())) + 24 * 60 * 60 * 1000
            ),
          },
        },
      }),
    ]);

    for (const u of zakazkaUpdates) {
      const start = new Date(u.startTime);
      const end = new Date(u.endTime);
      const violation = checkSlotAgainstSchedule(start, end, u.machine, schedule, allExceptions);
      if (violation) {
        return NextResponse.json({ error: violation }, { status: 422 });
      }
    }
  }

  try {
    const results = await prisma.$transaction(async (tx) => {
      const updated = await Promise.all(
        updates.map((u) => {
          const old = existingBlocks.find((b) => b.id === u.id);
          const timingActuallyChanged =
            old != null &&
            (new Date(u.startTime).getTime() !== old.startTime.getTime() ||
              new Date(u.endTime).getTime() !== old.endTime.getTime() ||
              u.machine !== old.machine);
          const needsPrintReset = timingActuallyChanged && old?.printCompletedAt != null;

          return tx.planovani_blocks.update({
            where: { id: u.id },
            data: {
              startTime: new Date(u.startTime),
              endTime: new Date(u.endTime),
              machine: u.machine,
              ...(needsPrintReset && {
                printCompletedAt: null,
                printCompletedByUserId: null,
                printCompletedByUsername: null,
              }),
            },
          });
        })
      );

      const auditRows: {
        blockId: number;
        orderNumber: string | null;
        userId: number;
        username: string;
        action: string;
        field?: string;
        oldValue?: string;
        newValue?: string;
      }[] = [];

      for (const u of updates) {
        const old = existingBlocks.find((b) => b.id === u.id);
        const updatedBlock = updated.find((b) => b.id === u.id);
        const orderNumber = updatedBlock?.orderNumber ?? old?.orderNumber ?? null;

        auditRows.push({
          blockId: u.id,
          orderNumber,
          userId,
          username,
          action: "UPDATE",
          field: "startTime/endTime/machine",
          newValue: `${u.machine} ${u.startTime}–${u.endTime}`,
        });

        const needsPrintReset =
          old != null &&
          old.printCompletedAt != null &&
          (new Date(u.startTime).getTime() !== old.startTime.getTime() ||
            new Date(u.endTime).getTime() !== old.endTime.getTime() ||
            u.machine !== old.machine);

        if (needsPrintReset) {
          auditRows.push({
            blockId: u.id,
            orderNumber,
            userId,
            username,
            action: "PRINT_RESET",
            field: "printCompletedAt",
            oldValue: String(old.printCompletedByUsername ?? ""),
            newValue: "",
          });
        }
      }

      await tx.planovani_audit_log.createMany({ data: auditRows });

      return updated;
    });

    return NextResponse.json(
      results.map((b) => ({
        ...b,
        startTime: b.startTime.toISOString(),
        endTime: b.endTime.toISOString(),
        deadlineExpedice: b.deadlineExpedice?.toISOString() ?? null,
        dataRequiredDate: b.dataRequiredDate?.toISOString() ?? null,
        materialRequiredDate: b.materialRequiredDate?.toISOString() ?? null,
        printCompletedAt: b.printCompletedAt?.toISOString() ?? null,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      }))
    );
  } catch (error: unknown) {
    if (isPrismaNotFound(error)) {
      return NextResponse.json({ error: "Jeden nebo více bloků nenalezeno" }, { status: 404 });
    }
    console.error("[POST /api/planovani/blocks/batch]", error);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
