import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  userCanOperateGrafikaAutomation,
  userCanViewMaketa,
} from "@/lib/makety-access";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import {
  summarizeTransferForUser,
  transferMaketyFilesToImlProduct,
} from "@/lib/makety-transfer-product-files";

/** Znovu přenese softproof + tisková data z grafiky do navázaného IML produktu. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessMaketyModule(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const maketaId = parseInt((await params).id, 10);
  if (Number.isNaN(maketaId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanViewMaketa(userId, maketaId))) {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }
  if (!(await userCanOperateGrafikaAutomation(userId, maketaId)).allowed) {
    return NextResponse.json(
      { error: "Soubory může přenést jen finální schvalovatel" },
      { status: 403 }
    );
  }

  const maketa = await prisma.makety.findFirst({
    where: { id: maketaId, work_type: "grafika" },
    select: { id: true, product_id: true, iml_applied_at: true },
  });
  if (!maketa) {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }
  if (maketa.product_id == null) {
    return NextResponse.json(
      { error: "Zakázka není navázána na IML produkt" },
      { status: 400 }
    );
  }

  try {
    const files = await transferMaketyFilesToImlProduct(
      maketaId,
      maketa.product_id,
      userId
    );
    const transferSummary = summarizeTransferForUser(files);

    await prisma.makety_comments.create({
      data: {
        maketa_id: maketaId,
        user_id: userId,
        body: files.filesIncomplete
          ? `Opakovaný přenos do IML #${maketa.product_id}: soubory neúplné. ${transferSummary.summary}`
          : `Opakovaný přenos do IML #${maketa.product_id}: ${transferSummary.summary}`,
      },
    });

    return NextResponse.json({
      success: true,
      productId: maketa.product_id,
      files,
      filesIncomplete: files.filesIncomplete,
      transferSummary: transferSummary.summary,
    });
  } catch (e) {
    console.error("retransfer-product-files", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Přenos souborů selhal" },
      { status: 500 }
    );
  }
}
