import { NextRequest, NextResponse } from "next/server";
import { withApiError } from "@/lib/crm/api-utils";
import { requireCrmRead, requireCrmWrite } from "@/lib/crm/guards";
import { prisma } from "@/lib/db";
import { canEditDeal } from "@/lib/crm/rbac";
import { AppError } from "@/lib/crm/errors";
import { logger } from "@/lib/crm/logger";
import { crmUserDisplayName } from "@/lib/crm/users";
import { generateDealSummary } from "@/lib/crm/ai/claude";
import {
  buildContextMessage,
  parseAndValidate,
  SYSTEM_PROMPT,
  type DealForPrompt,
  type ActivityForPrompt,
  type NoteForPrompt,
  type AuditForPrompt,
} from "@/lib/crm/ai/deal-summary";
import { computeIsStale } from "@/lib/crm/ai/staleness";
import { assertSummaryRateLimit } from "@/lib/crm/ai/rate-limit";
import type { DealSummaryContent } from "@/lib/crm/ai/types";

type Ctx = { params: Promise<{ id: string }> };

async function loadDealForPrompt(id: string) {
  return prisma.crm_deals.findUnique({
    where: { id },
    include: {
      company: { select: { name: true, segment: true, tags: true } },
      owner: { select: { id: true, first_name: true, last_name: true, email: true } },
      deal_contacts: {
        include: {
          contact: {
            select: {
              first_name: true,
              last_name: true,
              role: true,
              is_decision_maker: true,
            },
          },
        },
      },
    },
  });
}

function toDealForPrompt(deal: NonNullable<Awaited<ReturnType<typeof loadDealForPrompt>>>): DealForPrompt {
  const tags = deal.company.tags;
  return {
    id: deal.id,
    title: deal.title,
    value: deal.value,
    stage: deal.stage,
    probability: deal.probability,
    closeDate: deal.close_date,
    company: {
      name: deal.company.name,
      segment: deal.company.segment,
      tags: Array.isArray(tags) ? (tags as string[]) : undefined,
    },
    contacts: deal.deal_contacts.map((dc) => ({
      firstName: dc.contact.first_name,
      lastName: dc.contact.last_name,
      position: dc.contact.role,
      isDecisionMaker: dc.contact.is_decision_maker,
    })),
    owner: { name: crmUserDisplayName(deal.owner) },
  };
}

export const POST = withApiError(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireCrmWrite();
  const { id } = await params;

  const deal = await loadDealForPrompt(id);
  if (!deal) throw new AppError("NOT_FOUND", "Deal nenalezen.");
  if (!canEditDeal(user, deal)) {
    throw new AppError("FORBIDDEN", "Nemáš oprávnění generovat shrnutí pro tento deal.");
  }

  await assertSummaryRateLimit(user.id);

  const [activitiesRaw, notesRaw, auditsRaw] = await Promise.all([
    prisma.crm_activities.findMany({
      where: { parent_type: "DEAL", parent_id: deal.id },
      orderBy: { date: "asc" },
      take: 50,
      select: { type: true, date: true, note: true, duration: true },
    }),
    prisma.crm_notes.findMany({
      where: { parent_type: "DEAL", parent_id: deal.id },
      orderBy: { created_at: "asc" },
      take: 50,
      select: { content: true, created_at: true },
    }),
    prisma.crm_audit_log.findMany({
      where: { entity_type: "Deal", entity_id: deal.id, action: "UPDATE" },
      orderBy: { created_at: "asc" },
      take: 50,
      select: { action: true, created_at: true, diff: true },
    }),
  ]);

  const activities: ActivityForPrompt[] = activitiesRaw.map((a) => ({
    type: a.type,
    date: a.date,
    subject: null,
    note: a.note,
    durationMin: a.duration,
  }));
  const notes: NoteForPrompt[] = notesRaw.map((n) => ({
    content: n.content,
    createdAt: n.created_at,
  }));
  const audits: AuditForPrompt[] = auditsRaw.map((a) => ({
    action: a.action,
    createdAt: a.created_at,
    diff: (a.diff as Record<string, unknown>) ?? {},
  }));

  const userMessage = buildContextMessage(toDealForPrompt(deal), activities, notes, audits);

  let raw;
  try {
    raw = await generateDealSummary(SYSTEM_PROMPT, userMessage);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error("[crm-ai/deal-summary] Anthropic API selhal", err);
    throw new AppError("INTERNAL", "AI služba je momentálně nedostupná. Zkus to za chvíli.");
  }

  const parsed: DealSummaryContent = parseAndValidate(raw.rawText);
  const totalTokens = raw.inputTokens + raw.outputTokens;

  const [, insight] = await prisma.$transaction([
    prisma.crm_ai_insights.updateMany({
      where: {
        entity_type: "DEAL",
        entity_id: deal.id,
        insight_type: "SUMMARY",
        invalidated_at: null,
      },
      data: { invalidated_at: new Date() },
    }),
    prisma.crm_ai_insights.create({
      data: {
        entity_type: "DEAL",
        entity_id: deal.id,
        insight_type: "SUMMARY",
        content: JSON.stringify(parsed),
        model: raw.model,
        tokens: totalTokens,
      },
    }),
    prisma.crm_ai_usage.create({
      data: {
        user_id: user.id,
        action: "deal_summary",
        tokens: totalTokens,
        model: raw.model,
      },
    }),
  ]);

  logger.info("[crm-ai/deal-summary] generated", {
    dealId: deal.id,
    userId: user.id,
    tokens: totalTokens,
    model: raw.model,
  });

  return NextResponse.json({
    id: insight.id,
    content: parsed,
    model: insight.model,
    tokens: insight.tokens,
    createdAt: insight.created_at.toISOString(),
    isStale: false,
  });
});

export const GET = withApiError(async (_req: NextRequest, { params }: Ctx) => {
  await requireCrmRead();
  const { id } = await params;

  const deal = await prisma.crm_deals.findUnique({
    where: { id },
    select: { id: true, owner_id: true },
  });
  if (!deal) throw new AppError("NOT_FOUND", "Deal nenalezen.");

  const insight = await prisma.crm_ai_insights.findFirst({
    where: {
      entity_type: "DEAL",
      entity_id: deal.id,
      insight_type: "SUMMARY",
      invalidated_at: null,
    },
    orderBy: { created_at: "desc" },
  });

  if (!insight) {
    throw new AppError("NOT_FOUND", "Žádné cached AI shrnutí.");
  }

  const isStale = await computeIsStale(deal.id, insight.created_at);
  const parsed = JSON.parse(insight.content) as DealSummaryContent;

  return NextResponse.json({
    id: insight.id,
    content: parsed,
    model: insight.model,
    tokens: insight.tokens,
    createdAt: insight.created_at.toISOString(),
    isStale,
  });
});
