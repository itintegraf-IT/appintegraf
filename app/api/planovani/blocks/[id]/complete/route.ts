import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPlanovaniAssignedMachine, getPlanovaniRole } from "@/lib/planovani-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = parseInt(session.user.id, 10);
  const role = await getPlanovaniRole(userId);
  const username =
    (session.user as { username?: string }).username ?? session.user.name ?? session.user.email ?? "uživatel";

  const canConfirm = role === "TISKAR" || role === "ADMIN" || role === "PLANOVAT";
  if (!canConfirm) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const blockId = Number(id);
  if (isNaN(blockId)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  const { completed } = await req.json();
  if (typeof completed !== "boolean") {
    return NextResponse.json({ error: "Chybí pole completed (boolean)" }, { status: 400 });
  }

  const block = await prisma.planovani_blocks.findUnique({ where: { id: blockId } });
  if (!block) return NextResponse.json({ error: "Blok nenalezen" }, { status: 404 });

  if (block.type !== "ZAKAZKA") {
    return NextResponse.json({ error: "Potvrzení tisku je možné pouze u zakázek" }, { status: 400 });
  }

  if (role === "TISKAR") {
    const assigned = await getPlanovaniAssignedMachine(userId);
    if (block.machine !== assigned) {
      return NextResponse.json({ error: "Forbidden — cizí stroj" }, { status: 403 });
    }
  }

  const auditAction = completed ? "PRINT_COMPLETE" : "PRINT_UNDO";

  const [updatedBlock] = await prisma.$transaction([
    prisma.planovani_blocks.update({
      where: { id: blockId },
      data: completed
        ? {
            printCompletedAt: new Date(),
            printCompletedByUserId: userId,
            printCompletedByUsername: username,
          }
        : {
            printCompletedAt: null,
            printCompletedByUserId: null,
            printCompletedByUsername: null,
          },
    }),
    prisma.planovani_audit_log.create({
      data: {
        blockId,
        orderNumber: block.orderNumber,
        userId,
        username,
        action: auditAction,
      },
    }),
  ]);

  return NextResponse.json({
    ...updatedBlock,
    startTime: updatedBlock.startTime.toISOString(),
    endTime: updatedBlock.endTime.toISOString(),
    deadlineExpedice: updatedBlock.deadlineExpedice?.toISOString() ?? null,
    dataRequiredDate: updatedBlock.dataRequiredDate?.toISOString() ?? null,
    materialRequiredDate: updatedBlock.materialRequiredDate?.toISOString() ?? null,
    printCompletedAt: updatedBlock.printCompletedAt?.toISOString() ?? null,
    createdAt: updatedBlock.createdAt.toISOString(),
    updatedAt: updatedBlock.updatedAt.toISOString(),
  });
}
