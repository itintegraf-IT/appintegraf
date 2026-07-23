import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAdministerEquipment } from "@/lib/equipment/access";
import { generateQrPoolBatch, voidQrPoolCode, assignQrFromPool } from "@/lib/equipment/qr-pool";
import { buildPoolLabelsBulkPdf } from "@/lib/equipment/label-pdf";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const batchId = req.nextUrl.searchParams.get("batch_id");

  const rows = await prisma.equipment_qr_pool.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(batchId ? { batch_id: batchId } : {}),
    },
    orderBy: { id: "desc" },
    take: 1000,
    include: {
      equipment_items: { select: { id: true, name: true } },
    },
  });

  const batches = await prisma.equipment_qr_pool.groupBy({
    by: ["batch_id"],
    _count: { id: true },
    _min: { created_at: true },
    orderBy: { _min: { created_at: "desc" } },
    take: 50,
  });

  return NextResponse.json({ rows, batches });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "generate");

  if (action === "generate") {
    const count = parseInt(String(body.count ?? "10"), 10);
    const result = await generateQrPoolBatch({
      count,
      userId,
      notes: body.notes ? String(body.notes) : null,
    });
    return NextResponse.json(result, { status: 201 });
  }

  if (action === "assign") {
    const qrCode = String(body.qr_code ?? "").trim();
    const equipmentId = parseInt(String(body.equipment_id ?? ""), 10);
    if (!qrCode || !Number.isFinite(equipmentId)) {
      return NextResponse.json({ error: "Chybí qr_code nebo equipment_id" }, { status: 400 });
    }
    try {
      const result = await assignQrFromPool({ qrCode, equipmentId, userId });
      return NextResponse.json({ ok: true, ...result });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Chyba přiřazení" },
        { status: 400 }
      );
    }
  }

  if (action === "void") {
    const id = parseInt(String(body.id ?? ""), 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Chybí id" }, { status: 400 });
    }
    try {
      await voidQrPoolCode({ id, userId });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Chyba" },
        { status: 400 }
      );
    }
  }

  if (action === "print_batch") {
    const batchId = String(body.batch_id ?? "").trim();
    if (!batchId) {
      return NextResponse.json({ error: "Chybí batch_id" }, { status: 400 });
    }
    const codes = await prisma.equipment_qr_pool.findMany({
      where: { batch_id: batchId },
      select: { qr_code: true, asset_tag: true },
      orderBy: { id: "asc" },
    });
    if (codes.length === 0) {
      return NextResponse.json({ error: "Dávka je prázdná" }, { status: 404 });
    }
    const pdf = await buildPoolLabelsBulkPdf(codes);
    await prisma.equipment_qr_pool.updateMany({
      where: { batch_id: batchId, printed_at: null },
      data: { printed_at: new Date() },
    });
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="qr-davka-${batchId}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "Neznámá akce" }, { status: 400 });
}
