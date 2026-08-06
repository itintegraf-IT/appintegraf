import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  userCanOperateGrafikaAutomation,
  userCanViewMaketa,
} from "@/lib/makety-access";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import {
  buildMaketyProductDraft,
  draftToProductCreateScalars,
  draftToProductUpdateScalars,
  type MaketyProductDraft,
} from "@/lib/makety-product-draft";

function isDraft(val: unknown): val is MaketyProductDraft {
  if (!val || typeof val !== "object") return false;
  const d = val as MaketyProductDraft;
  return d.mode === "create" || d.mode === "update";
}

export async function POST(
  req: NextRequest,
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
  if (!(await userCanOperateGrafikaAutomation(userId, maketaId))) {
    return NextResponse.json(
      { error: "Produkt může založit jen finální schvalovatel" },
      { status: 403 }
    );
  }

  let overrides: Partial<MaketyProductDraft> = {};
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body === "object") {
      overrides = body as Partial<MaketyProductDraft>;
    }
  } catch {
    /* empty */
  }

  const maketa = await prisma.makety.findFirst({
    where: { id: maketaId, work_type: "grafika" },
    include: {
      iml_products: {
        select: { ig_code: true, client_code: true, ig_short_name: true },
      },
      users_creator: { select: { first_name: true, last_name: true } },
    },
  });
  if (!maketa) {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }

  const base =
    isDraft(maketa.product_draft)
      ? maketa.product_draft
      : buildMaketyProductDraft({
          customer_id: maketa.customer_id,
          product_id: maketa.product_id,
          die_cut_id: maketa.die_cut_id,
          label_code: maketa.label_code,
          body: maketa.body,
          product: maketa.iml_products,
        });

  const draft: MaketyProductDraft = {
    ...base,
    ...overrides,
    mode: overrides.mode === "update" || overrides.mode === "create" ? overrides.mode : base.mode,
    missing_fields: [],
  };

  if (draft.customer_id == null) draft.missing_fields.push("customer_id");
  if (!draft.ig_code?.trim()) draft.missing_fields.push("ig_code");

  if (draft.missing_fields.length > 0) {
    return NextResponse.json(
      {
        error: "Doplňte povinná pole před uložením produktu",
        missing_fields: draft.missing_fields,
        draft,
      },
      { status: 400 }
    );
  }

  const editor = `${maketa.users_creator.first_name} ${maketa.users_creator.last_name}`.trim();

  try {
    if (draft.mode === "update" && draft.product_id != null) {
      await prisma.iml_products.update({
        where: { id: draft.product_id },
        data: {
          ...draftToProductUpdateScalars(draft),
          last_edited_by: editor || undefined,
        },
      });

      await prisma.makety.update({
        where: { id: maketaId },
        data: {
          product_id: draft.product_id,
          product_draft: Prisma.DbNull,
        },
      });

      await prisma.makety_comments.create({
        data: {
          maketa_id: maketaId,
          user_id: userId,
          body: `Aktualizován produkt IML #${draft.product_id} (${draft.ig_code})`,
        },
      });

      return NextResponse.json({
        success: true,
        mode: "update",
        productId: draft.product_id,
      });
    }

    const created = await prisma.iml_products.create({
      data: {
        ...draftToProductCreateScalars(draft),
        last_edited_by: editor || undefined,
      },
    });

    await prisma.makety.update({
      where: { id: maketaId },
      data: {
        product_id: created.id,
        label_code: draft.ig_code,
        product_draft: Prisma.DbNull,
      },
    });

    await prisma.makety_comments.create({
      data: {
        maketa_id: maketaId,
        user_id: userId,
        body: `Založen produkt IML #${created.id} (${draft.ig_code})`,
      },
    });

    return NextResponse.json({
      success: true,
      mode: "create",
      productId: created.id,
    });
  } catch (e) {
    console.error("apply-product-draft", e);
    return NextResponse.json({ error: "Uložení produktu selhalo" }, { status: 500 });
  }
}
