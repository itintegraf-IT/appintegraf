import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

export const IT_VENDOR_LINK_TTL_DAYS = 30;

export type ItVendorLinkAccess = "ok" | "expired" | "revoked" | "missing";

export function hashItVendorToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function createItVendorRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function itVendorLinkAccess(link: {
  expires_at: Date;
  revoked_at: Date | null;
  now?: Date;
}): ItVendorLinkAccess {
  const now = link.now ?? new Date();
  if (link.revoked_at) return "revoked";
  if (link.expires_at.getTime() <= now.getTime()) return "expired";
  return "ok";
}

export async function revokeOpenItVendorLinks(requestId: number): Promise<void> {
  await prisma.it_vendor_request_links.updateMany({
    where: { request_id: requestId, revoked_at: null },
    data: { revoked_at: new Date() },
  });
}

export async function createItVendorLink(params: {
  requestId: number;
  sentToEmail: string;
  createdBy: number;
  ttlDays?: number;
}): Promise<{ rawToken: string; expiresAt: Date; id: number }> {
  await revokeOpenItVendorLinks(params.requestId);
  const rawToken = createItVendorRawToken();
  const days = params.ttlDays ?? IT_VENDOR_LINK_TTL_DAYS;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const row = await prisma.it_vendor_request_links.create({
    data: {
      token_hash: hashItVendorToken(rawToken),
      request_id: params.requestId,
      sent_to_email: params.sentToEmail.trim().slice(0, 190),
      expires_at: expiresAt,
      created_by: params.createdBy,
    },
  });
  return { id: row.id, rawToken, expiresAt };
}

export async function findItVendorLinkByRawToken(raw: string) {
  const token_hash = hashItVendorToken(raw);
  return prisma.it_vendor_request_links.findUnique({
    where: { token_hash },
    include: {
      request: {
        include: {
          interfaces: { orderBy: { sort_order: "asc" } },
          ips: { orderBy: { sort_order: "asc" } },
          firewall_rules: { orderBy: { sort_order: "asc" } },
          contacts: { orderBy: { sort_order: "asc" } },
          protocols: true,
          security_answers: true,
          docs: true,
        },
      },
    },
  });
}
