import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

export const SOFTPROOF_LINK_TTL_HOURS = 7 * 24;
export const SOFTPROOF_DECISION_ACTIONS = ["approved", "rejected"] as const;
export type SoftproofDecisionAction = (typeof SOFTPROOF_DECISION_ACTIONS)[number];
export type SoftproofLinkAction = SoftproofDecisionAction | "revoked";

export type SoftproofLinkAccess = "ok" | "used" | "expired" | "revoked";

export function hashSoftproofToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function createSoftproofRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function softproofLinkAccess(link: {
  used_at: Date | null;
  used_action: string | null;
  expires_at: Date;
  now?: Date;
}): SoftproofLinkAccess {
  const now = link.now ?? new Date();
  if (link.used_action === "revoked") return "revoked";
  if (link.used_at || link.used_action === "approved" || link.used_action === "rejected") {
    return "used";
  }
  if (link.expires_at.getTime() <= now.getTime()) return "expired";
  return "ok";
}

export function validateSoftproofDecision(
  action: unknown,
  reason: unknown
): { ok: true; action: SoftproofDecisionAction; reason: string | null } | { ok: false; error: string } {
  if (action !== "approved" && action !== "rejected") {
    return { ok: false, error: "Neplatná akce" };
  }
  const reasonText = typeof reason === "string" ? reason.trim() : "";
  if (action === "rejected" && !reasonText) {
    return { ok: false, error: "U zamítnutí uveďte důvod" };
  }
  return {
    ok: true,
    action,
    reason: action === "rejected" ? reasonText.slice(0, 4000) : null,
  };
}

export async function revokeOpenSoftproofLinks(maketaId: number): Promise<void> {
  await prisma.makety_softproof_links.updateMany({
    where: { maketa_id: maketaId, used_at: null },
    data: { used_at: new Date(), used_action: "revoked" },
  });
}

export async function createSoftproofLink(params: {
  maketaId: number;
  fileId: number;
  locale: string;
  sentToEmail: string;
  createdBy: number;
}): Promise<{ rawToken: string; expiresAt: Date }> {
  await revokeOpenSoftproofLinks(params.maketaId);
  const rawToken = createSoftproofRawToken();
  const expiresAt = new Date(Date.now() + SOFTPROOF_LINK_TTL_HOURS * 60 * 60 * 1000);
  await prisma.makety_softproof_links.create({
    data: {
      token_hash: hashSoftproofToken(rawToken),
      maketa_id: params.maketaId,
      file_id: params.fileId,
      locale: params.locale,
      sent_to_email: params.sentToEmail.slice(0, 190),
      expires_at: expiresAt,
      created_by: params.createdBy,
    },
  });
  return { rawToken, expiresAt };
}

export async function findSoftproofLinkByRawToken(raw: string) {
  const token_hash = hashSoftproofToken(raw);
  return prisma.makety_softproof_links.findUnique({
    where: { token_hash },
  });
}

export async function consumeSoftproofLink(params: {
  id: number;
  action: SoftproofDecisionAction;
  reason: string | null;
}): Promise<boolean> {
  const result = await prisma.makety_softproof_links.updateMany({
    where: { id: params.id, used_at: null },
    data: {
      used_at: new Date(),
      used_action: params.action,
      reject_reason: params.reason,
    },
  });
  return result.count === 1;
}
