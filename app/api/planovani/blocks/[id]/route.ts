import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma, type PrismaTransactionClient } from "@/lib/db";
import { getPlanovaniAssignedMachine, getPlanovaniRole } from "@/lib/planovani-auth";
import { checkPlanovaniScheduleViolation } from "@/lib/planovani-schedule";
import { normalizeBlockVariant } from "@/lib/blockVariants";

type RouteContext = { params: Promise<{ id: string }> };

function isPrismaNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2025"
  );
}

function serializeBlock(b: {
  startTime: Date;
  endTime: Date;
  deadlineExpedice: Date | null;
  dataRequiredDate: Date | null;
  materialRequiredDate: Date | null;
  printCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
} & Record<string, unknown>) {
  return {
    ...b,
    startTime: b.startTime.toISOString(),
    endTime: b.endTime.toISOString(),
    deadlineExpedice: b.deadlineExpedice?.toISOString() ?? null,
    dataRequiredDate: b.dataRequiredDate?.toISOString() ?? null,
    materialRequiredDate: b.materialRequiredDate?.toISOString() ?? null,
    printCompletedAt: b.printCompletedAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

export async function GET(_: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  const userId = parseInt(session.user.id, 10);
  const role = await getPlanovaniRole(userId);

  try {
    const block = await prisma.planovani_blocks.findUnique({ where: { id } });
    if (!block) return NextResponse.json({ error: "Blok nenalezen" }, { status: 404 });

    if (role === "TISKAR") {
      const assigned = await getPlanovaniAssignedMachine(userId);
      if (block.machine !== assigned) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(serializeBlock(block as Parameters<typeof serializeBlock>[0]));
  } catch (error) {
    console.error(`[GET /api/planovani/blocks/${id}]`, error);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = parseInt(session.user.id, 10);
  const role = await getPlanovaniRole(userId);

  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  const username =
    (session.user as { username?: string }).username ?? session.user.name ?? session.user.email ?? "uživatel";

  try {
    const body = await request.json();

    let allowed: Record<string, unknown>;
    if (["ADMIN", "PLANOVAT"].includes(role)) {
      allowed = body;
    } else if (role === "DTP") {
      allowed = {
        dataStatusId: body.dataStatusId,
        dataStatusLabel: body.dataStatusLabel,
        dataRequiredDate: body.dataRequiredDate,
        dataOk: body.dataOk,
      };
    } else if (role === "MTZ") {
      allowed = {
        materialStatusId: body.materialStatusId,
        materialStatusLabel: body.materialStatusLabel,
        materialRequiredDate: body.materialRequiredDate,
        materialOk: body.materialOk,
        materialNote: body.materialNote,
      };
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);

    const timingChanged =
      allowed.startTime !== undefined || allowed.endTime !== undefined || allowed.machine !== undefined;
    const typeChangingToZakazka = (allowed.type as string | undefined) === "ZAKAZKA";
    if (timingChanged || typeChangingToZakazka) {
      const existing = await prisma.planovani_blocks.findUnique({
        where: { id },
        select: { startTime: true, endTime: true, machine: true, type: true },
      });
      if (existing) {
        const checkType = (allowed.type as string | undefined) ?? existing.type;
        if (checkType === "ZAKAZKA") {
          const checkMachine = (allowed.machine as string | undefined) ?? existing.machine;
          const checkStart = allowed.startTime ? new Date(allowed.startTime as string) : existing.startTime;
          const checkEnd = allowed.endTime ? new Date(allowed.endTime as string) : existing.endTime;
          const violation = await checkPlanovaniScheduleViolation(checkMachine, checkStart, checkEnd);
          if (violation) return NextResponse.json({ error: violation }, { status: 422 });
        }
      }
    }

    const AUDITED_FIELDS = [
      "dataStatusLabel",
      "dataRequiredDate",
      "dataOk",
      "materialStatusLabel",
      "materialRequiredDate",
      "materialOk",
      "materialNote",
      "deadlineExpedice",
      "blockVariant",
    ] as const;
    type AuditedField = (typeof AUDITED_FIELDS)[number];

    const block = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const oldBlock = await tx.planovani_blocks.findUnique({ where: { id } });

      const resultingType = (allowed.type as string | undefined) ?? oldBlock?.type ?? "ZAKAZKA";
      const blockVariant = normalizeBlockVariant(
        (allowed.blockVariant as string | undefined) ?? (oldBlock?.blockVariant as string | undefined),
        resultingType
      );

      const timingActuallyChanged =
        oldBlock != null &&
        ((allowed.startTime !== undefined &&
          new Date(allowed.startTime as string).getTime() !== oldBlock.startTime.getTime()) ||
          (allowed.endTime !== undefined &&
            new Date(allowed.endTime as string).getTime() !== oldBlock.endTime.getTime()) ||
          (allowed.machine !== undefined && allowed.machine !== oldBlock.machine));

      const needsPrintReset =
        timingActuallyChanged &&
        oldBlock?.printCompletedAt != null &&
        ["ADMIN", "PLANOVAT"].includes(role);

      const updated = await tx.planovani_blocks.update({
        where: { id },
        data: {
          ...(allowed.orderNumber !== undefined && { orderNumber: String(allowed.orderNumber) }),
          ...(allowed.machine !== undefined && { machine: allowed.machine as string }),
          ...(allowed.startTime !== undefined && { startTime: new Date(allowed.startTime as string) }),
          ...(allowed.endTime !== undefined && { endTime: new Date(allowed.endTime as string) }),
          ...(needsPrintReset && {
            printCompletedAt: null,
            printCompletedByUserId: null,
            printCompletedByUsername: null,
          }),
          ...(allowed.type !== undefined && { type: allowed.type as string }),
          ...((allowed.blockVariant !== undefined || allowed.type !== undefined) && { blockVariant }),
          ...(allowed.description !== undefined && { description: allowed.description as string | null }),
          ...(allowed.locked !== undefined && { locked: allowed.locked as boolean }),
          ...(allowed.deadlineExpedice !== undefined && {
            deadlineExpedice: allowed.deadlineExpedice
              ? new Date(allowed.deadlineExpedice as string)
              : null,
          }),
          ...(allowed.dataStatusId !== undefined && { dataStatusId: allowed.dataStatusId as number | null }),
          ...(allowed.dataStatusLabel !== undefined && { dataStatusLabel: allowed.dataStatusLabel as string | null }),
          ...(allowed.dataRequiredDate !== undefined && {
            dataRequiredDate: allowed.dataRequiredDate
              ? new Date(allowed.dataRequiredDate as string)
              : null,
          }),
          ...(allowed.dataOk !== undefined && { dataOk: allowed.dataOk as boolean }),
          ...(allowed.materialStatusId !== undefined && {
            materialStatusId: allowed.materialStatusId as number | null,
          }),
          ...(allowed.materialStatusLabel !== undefined && {
            materialStatusLabel: allowed.materialStatusLabel as string | null,
          }),
          ...(allowed.materialRequiredDate !== undefined && {
            materialRequiredDate: allowed.materialRequiredDate
              ? new Date(allowed.materialRequiredDate as string)
              : null,
          }),
          ...(allowed.materialOk !== undefined && { materialOk: allowed.materialOk as boolean }),
          ...(allowed.materialNote !== undefined && {
            materialNote: allowed.materialNote as string | null,
            materialNoteByUsername: allowed.materialNote ? username : null,
          }),
          ...(allowed.barvyStatusId !== undefined && { barvyStatusId: allowed.barvyStatusId as number | null }),
          ...(allowed.barvyStatusLabel !== undefined && {
            barvyStatusLabel: allowed.barvyStatusLabel as string | null,
          }),
          ...(allowed.lakStatusId !== undefined && { lakStatusId: allowed.lakStatusId as number | null }),
          ...(allowed.lakStatusLabel !== undefined && {
            lakStatusLabel: allowed.lakStatusLabel as string | null,
          }),
          ...(allowed.specifikace !== undefined && { specifikace: allowed.specifikace as string | null }),
          ...(allowed.recurrenceType !== undefined && { recurrenceType: allowed.recurrenceType as string }),
        },
      });

      if (oldBlock) {
        const changes: {
          blockId: number;
          orderNumber: string | null;
          userId: number;
          username: string;
          action: string;
          field?: string;
          oldValue?: string;
          newValue?: string;
        }[] = AUDITED_FIELDS.filter(
          (field) => String(oldBlock[field as AuditedField] ?? "") !== String(updated[field as AuditedField] ?? "")
        ).map((field) => ({
          blockId: id,
          orderNumber: oldBlock.orderNumber,
          userId,
          username,
          action: "UPDATE",
          field,
          oldValue: String(oldBlock[field as AuditedField] ?? ""),
          newValue: String(updated[field as AuditedField] ?? ""),
        }));

        if (needsPrintReset) {
          changes.push({
            blockId: id,
            orderNumber: oldBlock.orderNumber,
            userId,
            username,
            action: "PRINT_RESET",
            field: "printCompletedAt",
            oldValue: String(oldBlock.printCompletedByUsername ?? ""),
            newValue: "",
          });
        }

        if (changes.length > 0) {
          await tx.planovani_audit_log.createMany({ data: changes });
        }
      }

      return updated;
    });

    return NextResponse.json(serializeBlock(block as Parameters<typeof serializeBlock>[0]));
  } catch (error: unknown) {
    if (isPrismaNotFound(error)) return NextResponse.json({ error: "Blok nenalezen" }, { status: 404 });
    console.error(`[PUT /api/planovani/blocks/${id}]`, error);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getPlanovaniRole(parseInt(session.user.id, 10));
  if (!["ADMIN", "PLANOVAT"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  const userId = parseInt(session.user.id, 10);
  const username =
    (session.user as { username?: string }).username ?? session.user.name ?? session.user.email ?? "uživatel";

  try {
    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const blockToDelete = await tx.planovani_blocks.findUnique({
        where: { id },
        select: { orderNumber: true },
      });

      await tx.planovani_audit_log.create({
        data: {
          blockId: id,
          orderNumber: blockToDelete?.orderNumber ?? null,
          userId,
          username,
          action: "DELETE",
        },
      });

      await tx.planovani_blocks.delete({ where: { id } });
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (isPrismaNotFound(error)) return NextResponse.json({ error: "Blok nenalezen" }, { status: 404 });
    console.error(`[DELETE /api/planovani/blocks/${id}]`, error);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
