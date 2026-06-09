import { prisma } from "@/lib/db";
import { computeIsStale } from "@/lib/crm/ai/staleness";
import type { CachedDealSummary, DealSummaryContent } from "@/lib/crm/ai/types";
import { DealSummaryCardClient } from "./DealSummaryCard.client";

interface Props {
  dealId: string;
  canGenerate: boolean;
}

export async function DealSummaryCard({ dealId, canGenerate }: Props) {
  const insight = await prisma.crm_ai_insights.findFirst({
    where: {
      entity_type: "DEAL",
      entity_id: dealId,
      insight_type: "SUMMARY",
      invalidated_at: null,
    },
    orderBy: { created_at: "desc" },
  });

  let initial: CachedDealSummary | null = null;
  if (insight) {
    let content: DealSummaryContent | null = null;
    try {
      content = JSON.parse(insight.content) as DealSummaryContent;
    } catch {
      content = null;
    }
    if (content) {
      const isStale = await computeIsStale(dealId, insight.created_at);
      initial = {
        id: insight.id,
        content,
        model: insight.model,
        tokens: insight.tokens,
        createdAt: insight.created_at.toISOString(),
        isStale,
      };
    }
  }

  return <DealSummaryCardClient dealId={dealId} initial={initial} canGenerate={canGenerate} />;
}
