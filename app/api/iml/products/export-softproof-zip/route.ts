import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { collectProductExportAssets } from "@/lib/iml-export-products-assets";
import { buildAssetsOnlyZip } from "@/lib/iml-export-products-zip";
import { IML_PREVIEW_SHARE_MAX_PRODUCTS } from "@/lib/iml-product-preview-shares";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { product_ids?: number[] };
  const productIds = Array.isArray(body.product_ids)
    ? [...new Set(body.product_ids.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))]
    : [];

  if (productIds.length === 0) {
    return NextResponse.json({ error: "Vyberte alespoň jeden produkt" }, { status: 400 });
  }
  if (productIds.length > IML_PREVIEW_SHARE_MAX_PRODUCTS) {
    return NextResponse.json(
      { error: `Maximálně ${IML_PREVIEW_SHARE_MAX_PRODUCTS} produktů najednou.` },
      { status: 400 }
    );
  }

  const products = await prisma.iml_products.findMany({
    where: { id: { in: productIds } },
    select: { id: true, ig_code: true, image_data: true },
  });
  if (products.length === 0) {
    return NextResponse.json({ error: "Žádné platné produkty" }, { status: 400 });
  }

  const byId = new Map(products.map((p) => [p.id, p]));
  const ordered = productIds.map((id) => byId.get(id)).filter(Boolean) as typeof products;

  const { files } = await collectProductExportAssets(ordered, {
    includePrint: false,
    includeSoftproof: true,
  });

  if (files.length === 0) {
    return NextResponse.json(
      { error: "U vybraných produktů není žádný softproof k stažení." },
      { status: 400 }
    );
  }

  const withSoftproof = new Set(files.map((f) => f.productId));
  const skipped = ordered.filter((p) => !withSoftproof.has(p.id)).map((p) => ({
    id: p.id,
    ig_code: p.ig_code,
  }));

  const zip = await buildAssetsOnlyZip({
    assets: files,
    zipFilename: `iml-softproofy-${new Date().toISOString().slice(0, 10)}.zip`,
  });

  await logImlAudit({
    userId,
    action: "update",
    tableName: "iml_products",
    recordId: ordered[0]?.id ?? 0,
    newValues: {
      export_softproof_zip: true,
      product_count: ordered.length,
      file_count: files.length,
      skipped_count: skipped.length,
    },
  });

  return new NextResponse(new Uint8Array(zip.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zip.filename}"`,
      "X-Skipped-Count": String(skipped.length),
      "Cache-Control": "no-store",
    },
  });
}
