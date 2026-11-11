import { NextRequest, NextResponse } from "next/server";
import { getImageContentType } from "@/lib/iml-product-import-files";
import {
  findImlPreviewShareByRawToken,
  imlPreviewShareAccess,
  loadImlPreviewProductImage,
} from "@/lib/iml-product-preview-shares";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; productId: string }> }
) {
  const { token: rawToken, productId: productIdRaw } = await params;
  const productId = parseInt(productIdRaw, 10);
  if (!rawToken?.trim() || !Number.isFinite(productId) || productId < 1) {
    return new NextResponse("Nenalezeno", { status: 404 });
  }

  const share = await findImlPreviewShareByRawToken(rawToken);
  if (!share) {
    return new NextResponse("Odkaz nenalezen", { status: 404 });
  }
  if (imlPreviewShareAccess(share) !== "ok") {
    return new NextResponse("Platnost odkazu vypršela", { status: 410 });
  }

  const inShare = share.items.some((item) => item.product_id === productId);
  if (!inShare) {
    return new NextResponse("Produkt není v tomto náhledu", { status: 404 });
  }

  const image = await loadImlPreviewProductImage(share.id, productId);
  if (!image) {
    return new NextResponse("Obrázek nenalezen", { status: 404 });
  }

  const contentType = getImageContentType(image.buffer);
  return new NextResponse(new Uint8Array(image.buffer), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
