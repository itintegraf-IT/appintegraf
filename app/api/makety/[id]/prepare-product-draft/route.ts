import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  userCanOperateGrafikaAutomation,
  userCanViewMaketa,
} from "@/lib/makety-access";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { buildMaketyProductDraft } from "@/lib/makety-product-draft";

export async function POST(
  _req: Request,
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
      { error: "Návrh produktu může připravit jen finální schvalovatel" },
      { status: 403 }
    );
  }

  const maketa = await prisma.makety.findFirst({
    where: { id: maketaId, work_type: "grafika" },
    include: {
      iml_products: {
        select: { ig_code: true, client_code: true, ig_short_name: true },
      },
      iml_customers: { select: { id: true, name: true } },
      iml_die_cuts: {
        select: {
          id: true,
          label_shape_code: true,
          die_cut_tool_code: true,
          internal_name: true,
        },
      },
    },
  });
  if (!maketa) {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }

  const draft = buildMaketyProductDraft({
    customer_id: maketa.customer_id,
    product_id: maketa.product_id,
    die_cut_id: maketa.die_cut_id,
    label_code: maketa.label_code,
    body: maketa.body,
    product: maketa.iml_products,
  });

  await prisma.makety.update({
    where: { id: maketaId },
    data: { product_draft: draft as unknown as Prisma.InputJsonValue },
  });

  return NextResponse.json({
    success: true,
    draft,
    customerName: maketa.iml_customers?.name ?? null,
    dieCutLabel: maketa.iml_die_cuts
      ? [
          maketa.iml_die_cuts.label_shape_code,
          maketa.iml_die_cuts.die_cut_tool_code,
          maketa.iml_die_cuts.internal_name,
        ]
          .filter(Boolean)
          .join(" · ")
      : null,
  });
}
