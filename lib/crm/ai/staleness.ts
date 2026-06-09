import { prisma } from "@/lib/db";

export const SUMMARY_MAX_AGE_DAYS = 30;
const SUMMARY_MAX_AGE_MS = SUMMARY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

export async function computeIsStale(dealId: string, insightCreatedAt: Date): Promise<boolean> {
  if (Date.now() - insightCreatedAt.getTime() > SUMMARY_MAX_AGE_MS) return true;

  const [latestActivity, latestNote, latestAudit] = await Promise.all([
    prisma.crm_activities.findFirst({
      where: { parent_type: "DEAL", parent_id: dealId },
      orderBy: { created_at: "desc" },
      select: { created_at: true },
    }),
    prisma.crm_notes.findFirst({
      where: { parent_type: "DEAL", parent_id: dealId },
      orderBy: { created_at: "desc" },
      select: { created_at: true },
    }),
    prisma.crm_audit_log.findFirst({
      where: { entity_type: "Deal", entity_id: dealId, action: "UPDATE" },
      orderBy: { created_at: "desc" },
      select: { created_at: true },
    }),
  ]);

  const candidates = [latestActivity?.created_at, latestNote?.created_at, latestAudit?.created_at].filter(
    (d): d is Date => d instanceof Date
  );
  if (candidates.length === 0) return false;
  const latest = candidates.reduce<Date>((acc, d) => (d > acc ? d : acc), candidates[0]!);
  return latest.getTime() > insightCreatedAt.getTime();
}
