import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  userCanOperateGrafikaAutomation,
  userCanViewMaketa,
} from "@/lib/makety-access";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { logImlAudit } from "@/lib/iml-audit";
import {
  buildMaketyProductDraft,
  draftToProductCreateScalars,
  draftToProductUpdateScalars,
  requiresIgCodeReplaceConfirmation,
  supplementProductFromDraft,
  type ApplyProductDraftBody,
  type MaketyProductDraft,
} from "@/lib/makety-product-draft";
import {
  findImlProductByIgCode,
  toMaketyImlProductConflict,
} from "@/lib/makety-iml-product-lookup";
import { transferMaketyFilesToImlProduct } from "@/lib/makety-transfer-product-files";

function isDraft(val: unknown): val is MaketyProductDraft {
  if (!val || typeof val !== "object") return false;
  const d = val as MaketyProductDraft;
  return d.mode === "create" || d.mode === "update";
}

function parseApplyBody(body: unknown): ApplyProductDraftBody {
  if (!body || typeof body !== "object") return {};
  return body as ApplyProductDraftBody;
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
  if (!(await userCanOperateGrafikaAutomation(userId, maketaId)).allowed) {
    return NextResponse.json(
      { error: "Produkt může založit jen finální schvalovatel" },
      { status: 403 }
    );
  }

  let requestBody: ApplyProductDraftBody = {};
  try {
    requestBody = parseApplyBody(await req.json().catch(() => ({})));
  } catch {
    /* empty */
  }
  const confirmReplace = requestBody.confirmReplace === true;
  const { confirmReplace: _confirmReplace, ...overrides } = requestBody;

  const maketa = await prisma.makety.findFirst({
    where: { id: maketaId, work_type: "grafika" },
    include: {
      iml_products: {
        select: { ig_code: true, client_code: true, ig_short_name: true, client_name: true },
      },
      iml_customers: { select: { name: true } },
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
          product_name: maketa.product_name,
          body: maketa.body,
          customer_name: maketa.iml_customers?.name ?? null,
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

  if (!draft.client_name?.trim() && maketa.product_name?.trim()) {
    draft.client_name = maketa.product_name.trim();
  }
  if (!draft.client_name?.trim() && maketa.iml_customers?.name) {
    draft.client_name = maketa.iml_customers.name;
  }

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

  const igConflictProduct = draft.ig_code?.trim()
    ? await findImlProductByIgCode(draft.ig_code)
    : null;
  const conflict = igConflictProduct ? toMaketyImlProductConflict(igConflictProduct) : null;

  const isConflictReplace =
    confirmReplace &&
    conflict != null &&
    (draft.mode === "create" || draft.product_id !== conflict.product_id);

  if (
    requiresIgCodeReplaceConfirmation({
      draftMode: draft.mode,
      draftProductId: draft.product_id,
      conflict,
      confirmReplace,
    })
  ) {
    return NextResponse.json(
      {
        error: `Produkt s kódem IG ${draft.ig_code} již existuje. Potvrďte nahrazení souborů.`,
        conflict,
        draft,
      },
      { status: 409 }
    );
  }

  try {
    let productId: number;
    let mode: "create" | "update" | "replace";
    let replacedExisting = false;

    if (isConflictReplace && igConflictProduct) {
      productId = igConflictProduct.id;
      mode = "replace";
      replacedExisting = true;

      const supplementData = supplementProductFromDraft(igConflictProduct, draft);
      await prisma.iml_products.update({
        where: { id: productId },
        data: {
          ...supplementData,
          last_edited_by: editor || undefined,
        },
      });

      await prisma.makety.update({
        where: { id: maketaId },
        data: {
          product_id: productId,
          product_draft: Prisma.DbNull,
          iml_applied_at: new Date(),
        },
      });

      await prisma.makety_comments.create({
        data: {
          maketa_id: maketaId,
          user_id: userId,
          body: `Nahrazeny soubory (softproof, tisková data) u existujícího produktu IML #${productId} (${draft.ig_code}) z grafické zakázky. Metadata doplněna jen do prázdných polí.`,
        },
      });

      await logImlAudit({
        userId,
        action: "update",
        tableName: "iml_products",
        recordId: productId,
        oldValues: {
          ig_code: igConflictProduct.ig_code,
          client_name: igConflictProduct.client_name,
          source: "makety_grafika",
        },
        newValues: {
          ig_code: draft.ig_code,
          supplemented: true,
          replaced_files: true,
          maketa_id: maketaId,
          source: "makety_grafika",
        },
      });
    } else if (draft.mode === "update" && draft.product_id != null) {
      productId = draft.product_id;
      mode = "update";
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
          iml_applied_at: new Date(),
        },
      });

      await prisma.makety_comments.create({
        data: {
          maketa_id: maketaId,
          user_id: userId,
          body: `Aktualizován produkt IML #${draft.product_id} (${draft.ig_code})`,
        },
      });

      await logImlAudit({
        userId,
        action: "update",
        tableName: "iml_products",
        recordId: productId,
        newValues: {
          ig_code: draft.ig_code,
          client_name: draft.client_name,
          maketa_id: maketaId,
          source: "makety_grafika",
        },
      });
    } else {
      const created = await prisma.iml_products.create({
        data: {
          ...draftToProductCreateScalars(draft),
          last_edited_by: editor || undefined,
        },
      });
      productId = created.id;
      mode = "create";

      await prisma.makety.update({
        where: { id: maketaId },
        data: {
          product_id: created.id,
          label_code: draft.ig_code,
          product_draft: Prisma.DbNull,
          iml_applied_at: new Date(),
        },
      });

      await prisma.makety_comments.create({
        data: {
          maketa_id: maketaId,
          user_id: userId,
          body: `Založen produkt IML #${created.id} (${draft.ig_code})`,
        },
      });

      await logImlAudit({
        userId,
        action: "create",
        tableName: "iml_products",
        recordId: productId,
        newValues: {
          ig_code: draft.ig_code,
          client_name: draft.client_name,
          maketa_id: maketaId,
          source: "makety_grafika",
        },
      });
    }

    const files = await transferMaketyFilesToImlProduct(maketaId, productId, userId);

    const fileParts: string[] = [];
    if (files.softproofAttached) fileParts.push("softproof");
    if (files.printDataAttached) fileParts.push("tisková data");
    if (fileParts.length > 0) {
      await prisma.makety_comments.create({
        data: {
          maketa_id: maketaId,
          user_id: userId,
          body: `Do IML produktu #${productId} přeneseno: ${fileParts.join(", ")}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      mode,
      productId,
      replacedExisting,
      files,
    });
  } catch (e) {
    console.error("apply-product-draft", e);
    return NextResponse.json({ error: "Uložení produktu selhalo" }, { status: 500 });
  }
}
