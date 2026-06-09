import type { crm_deal_stage } from "@prisma/client";
import { prisma } from "@/lib/db";

export type StageTransition = {
  from: crm_deal_stage;
  to: crm_deal_stage;
  at: Date;
};

export type StageSegment = {
  stage: crm_deal_stage;
  days: number;
  isCurrent: boolean;
  enteredAt: Date;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function diffDays(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY));
}

/**
 * Pure funkce — segmenty z dat.
 */
export function computeStageSegments(input: {
  currentStage: crm_deal_stage;
  created_at: Date;
  transitions: StageTransition[];
}): StageSegment[] {
  const sorted = [...input.transitions].sort((a, b) => a.at.getTime() - b.at.getTime());
  const now = new Date();

  const first = sorted[0];
  if (!first) {
    return [
      {
        stage: input.currentStage,
        days: diffDays(input.created_at, now),
        isCurrent: true,
        enteredAt: input.created_at,
      },
    ];
  }

  const segments: StageSegment[] = [];
  segments.push({
    stage: first.from,
    days: diffDays(input.created_at, first.at),
    isCurrent: false,
    enteredAt: input.created_at,
  });

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    if (!current) continue;
    const next = sorted[i + 1];
    const enteredAt = current.at;
    const endAt = next ? next.at : now;
    const isLast = i === sorted.length - 1;
    segments.push({
      stage: current.to,
      days: diffDays(enteredAt, endAt),
      isCurrent: isLast,
      enteredAt,
    });
  }

  return segments;
}

/**
 * DB version — fetches deal + audit logs, builds segments.
 */
export async function getStageHistory(dealId: string): Promise<StageSegment[]> {
  const deal = await prisma.crm_deals.findUnique({
    where: { id: dealId },
    select: { stage: true, created_at: true },
  });
  if (!deal) return [];

  const auditLogs = await prisma.crm_audit_log.findMany({
    where: { entity_type: "Deal", entity_id: dealId, action: "UPDATE" },
    orderBy: { created_at: "asc" },
    select: { diff: true, created_at: true },
  });

  const transitions: StageTransition[] = [];
  for (const log of auditLogs) {
    const diff = log.diff as Record<string, { before: unknown; after: unknown }> | null;
    const stageDiff = diff?.stage;
    if (stageDiff && typeof stageDiff.before === "string" && typeof stageDiff.after === "string") {
      transitions.push({
        from: stageDiff.before as crm_deal_stage,
        to: stageDiff.after as crm_deal_stage,
        at: log.created_at,
      });
    }
  }

  return computeStageSegments({
    currentStage: deal.stage,
    created_at: deal.created_at,
    transitions,
  });
}
