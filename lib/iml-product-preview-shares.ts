import { createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const IML_PREVIEW_SHARE_TTL_DAYS_DEFAULT = 7;
export const IML_PREVIEW_SHARE_TTL_DAYS_MIN = 1;
export const IML_PREVIEW_SHARE_TTL_DAYS_MAX = 30;
export const IML_PREVIEW_SHARE_MAX_PRODUCTS = 50;

export type ImlPreviewShareAccess = "ok" | "expired" | "missing";

export function hashImlPreviewToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function createImlPreviewRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function clampImlPreviewExpiresDays(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return IML_PREVIEW_SHARE_TTL_DAYS_DEFAULT;
  return Math.min(
    IML_PREVIEW_SHARE_TTL_DAYS_MAX,
    Math.max(IML_PREVIEW_SHARE_TTL_DAYS_MIN, Math.round(n))
  );
}

export function imlPreviewShareAccess(share: {
  expires_at: Date;
  now?: Date;
}): ImlPreviewShareAccess {
  const now = share.now ?? new Date();
  if (share.expires_at.getTime() <= now.getTime()) return "expired";
  return "ok";
}

export async function createImlProductPreviewShare(params: {
  productIds: number[];
  createdBy: number;
  expiresDays?: number;
  title?: string | null;
  note?: string | null;
  sentToEmail?: string | null;
}): Promise<{ id: number; rawToken: string; expiresAt: Date }> {
  const expiresDays = clampImlPreviewExpiresDays(params.expiresDays);
  const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);
  const rawToken = createImlPreviewRawToken();
  const title = params.title?.trim().slice(0, 255) || null;
  const note = params.note?.trim().slice(0, 4000) || null;
  const sentToEmail = params.sentToEmail?.trim().slice(0, 190) || null;

  const row = await prisma.iml_product_preview_shares.create({
    data: {
      token_hash: hashImlPreviewToken(rawToken),
      title,
      note,
      sent_to_email: sentToEmail,
      expires_at: expiresAt,
      created_by: params.createdBy,
      items: {
        create: params.productIds.map((productId, index) => ({
          product_id: productId,
          sort_order: index,
        })),
      },
    },
  });

  return { id: row.id, rawToken, expiresAt };
}

export async function findImlPreviewShareByRawToken(raw: string) {
  const token_hash = hashImlPreviewToken(raw);
  return prisma.iml_product_preview_shares.findUnique({
    where: { token_hash },
    include: {
      items: {
        orderBy: { sort_order: "asc" },
        include: {
          product: {
            select: {
              id: true,
              ig_code: true,
              ig_short_name: true,
              client_name: true,
              client_code: true,
            },
          },
        },
      },
    },
  });
}

/** Bez načtení BLOB — jen příznak, zda produkt má softproof. */
export async function loadImlPreviewSoftproofFlags(
  productIds: number[]
): Promise<Map<number, boolean>> {
  const map = new Map<number, boolean>();
  if (productIds.length === 0) return map;

  const rows = await prisma.$queryRaw<Array<{ id: number; has_sp: number | bigint }>>`
    SELECT id,
           CASE
             WHEN image_data IS NOT NULL AND OCTET_LENGTH(image_data) > 0 THEN 1
             ELSE 0
           END AS has_sp
    FROM iml_products
    WHERE id IN (${Prisma.join(productIds)})
  `;

  for (const row of rows) {
    map.set(Number(row.id), Number(row.has_sp) === 1);
  }
  return map;
}

export async function loadImlPreviewProductImage(
  shareId: number,
  productId: number
): Promise<{ buffer: Buffer; ig_code: string | null } | null> {
  const item = await prisma.iml_product_preview_share_items.findFirst({
    where: { share_id: shareId, product_id: productId },
    select: {
      product: {
        select: { image_data: true, ig_code: true },
      },
    },
  });
  const data = item?.product?.image_data;
  if (data == null) return null;
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (buffer.length === 0) return null;
  return { buffer, ig_code: item.product.ig_code };
}
