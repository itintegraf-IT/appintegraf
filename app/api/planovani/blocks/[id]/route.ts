import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPlanovaniRole } from "@/lib/planovani-auth";

type RouteContext = { params: Promise<{ id: string }> };

function isPrismaNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2025"
  );
}

export async function GET(_: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  try {
    const block = await prisma.planovani_blocks.findUnique({ where: { id } });
    if (!block) return NextResponse.json({ error: "Blok nenalezen" }, { status: 404 });
    return NextResponse.json({
      ...block,
      startTime: block.startTime.toISOString(),
      endTime: block.endTime.toISOString(),
      deadlineExpedice: block.deadlineExpedice?.toISOString() ?? null,
      dataRequiredDate: block.dataRequiredDate?.toISOString() ?? null,
      materialRequiredDate: block.materialRequiredDate?.toISOString() ?? null,
      createdAt: block.createdAt.toISOString(),
      updatedAt: block.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error(`[GET /api/planovani/blocks/${id}]`, error);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getPlanovaniRole(parseInt(session.user.id, 10));

  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

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
      };
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);

    const block = await prisma.planovani_blocks.update({
      where: { id },
      data: {
        ...(allowed.orderNumber !== undefined && { orderNumber: String(allowed.orderNumber) }),
        ...(allowed.machine !== undefined && { machine: allowed.machine as string }),
        ...(allowed.startTime !== undefined && { startTime: new Date(allowed.startTime as string) }),
        ...(allowed.endTime !== undefined && { endTime: new Date(allowed.endTime as string) }),
        ...(allowed.type !== undefined && { type: allowed.type as string }),
        ...(allowed.description !== undefined && { description: allowed.description as string }),
        ...(allowed.locked !== undefined && { locked: allowed.locked as boolean }),
        ...(allowed.deadlineExpedice !== undefined && {
          deadlineExpedice: allowed.deadlineExpedice ? new Date(allowed.deadlineExpedice as string) : null,
        }),
        ...(allowed.dataStatusId !== undefined && { dataStatusId: allowed.dataStatusId as number }),
        ...(allowed.dataStatusLabel !== undefined && { dataStatusLabel: allowed.dataStatusLabel as string }),
        ...(allowed.dataRequiredDate !== undefined && {
          dataRequiredDate: allowed.dataRequiredDate ? new Date(allowed.dataRequiredDate as string) : null,
        }),
        ...(allowed.dataOk !== undefined && { dataOk: allowed.dataOk as boolean }),
        ...(allowed.materialStatusId !== undefined && { materialStatusId: allowed.materialStatusId as number }),
        ...(allowed.materialStatusLabel !== undefined && { materialStatusLabel: allowed.materialStatusLabel as string }),
        ...(allowed.materialRequiredDate !== undefined && {
          materialRequiredDate: allowed.materialRequiredDate ? new Date(allowed.materialRequiredDate as string) : null,
        }),
        ...(allowed.materialOk !== undefined && { materialOk: allowed.materialOk as boolean }),
        ...(allowed.barvyStatusId !== undefined && { barvyStatusId: allowed.barvyStatusId as number }),
        ...(allowed.barvyStatusLabel !== undefined && { barvyStatusLabel: allowed.barvyStatusLabel as string }),
        ...(allowed.lakStatusId !== undefined && { lakStatusId: allowed.lakStatusId as number }),
        ...(allowed.lakStatusLabel !== undefined && { lakStatusLabel: allowed.lakStatusLabel as string }),
        ...(allowed.specifikace !== undefined && { specifikace: allowed.specifikace as string }),
        ...(allowed.recurrenceType !== undefined && { recurrenceType: allowed.recurrenceType as string }),
      },
    });

    return NextResponse.json({
      ...block,
      startTime: block.startTime.toISOString(),
      endTime: block.endTime.toISOString(),
      deadlineExpedice: block.deadlineExpedice?.toISOString() ?? null,
      dataRequiredDate: block.dataRequiredDate?.toISOString() ?? null,
      materialRequiredDate: block.materialRequiredDate?.toISOString() ?? null,
      createdAt: block.createdAt.toISOString(),
      updatedAt: block.updatedAt.toISOString(),
    });
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

  try {
    await prisma.planovani_blocks.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (isPrismaNotFound(error)) return NextResponse.json({ error: "Blok nenalezen" }, { status: 404 });
    console.error(`[DELETE /api/planovani/blocks/${id}]`, error);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
