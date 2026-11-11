import { NextRequest, NextResponse } from "next/server";
import {
  findImlPreviewShareByRawToken,
  imlPreviewShareAccess,
  loadImlPreviewSoftproofFlags,
} from "@/lib/iml-product-preview-shares";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const rawToken = (await params).token;
  if (!rawToken?.trim()) {
    return NextResponse.json(
      { status: "missing", message: "Odkaz nenalezen" },
      { status: 404 }
    );
  }

  const share = await findImlPreviewShareByRawToken(rawToken);
  if (!share) {
    return NextResponse.json(
      { status: "missing", message: "Odkaz nenalezen" },
      { status: 404 }
    );
  }

  const access = imlPreviewShareAccess(share);
  if (access === "expired") {
    return NextResponse.json(
      {
        status: "expired",
        message: "Platnost odkazu vypršela. Požádejte o nový náhled.",
      },
      { status: 410 }
    );
  }

  const productIds = share.items.filter((i) => i.product).map((i) => i.product.id);
  const flags = await loadImlPreviewSoftproofFlags(productIds);

  const products = share.items
    .filter((item) => item.product)
    .map((item) => {
      const p = item.product;
      return {
        id: p.id,
        ig_code: p.ig_code,
        ig_short_name: p.ig_short_name,
        client_name: p.client_name,
        client_code: p.client_code,
        has_softproof: flags.get(p.id) === true,
      };
    });

  return NextResponse.json({
    status: "ok",
    title: share.title,
    note: share.note,
    expires_at: share.expires_at.toISOString(),
    products,
  });
}
