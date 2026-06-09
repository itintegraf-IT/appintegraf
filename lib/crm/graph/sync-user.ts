import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/crm/logger";
import { fetchInboxDelta, fetchSentDelta, type DeltaResult } from "./mail-delta";
import { parseMessageToActivity } from "./mail-parser";
import { matchParent } from "./mail-match";
import { GraphRateLimitError } from "./client";

export interface SyncUserResult {
  userId: number;
  processed: number;
  skipped: number;
  errors: string[];
}

const MAX_BACKOFF_MS = 60 * 60 * 1000;

export async function syncUser(userId: number): Promise<SyncUserResult> {
  const result: SyncUserResult = { userId, processed: 0, skipped: 0, errors: [] };

  const userRow = await prisma.users.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!userRow?.email) {
    result.errors.push("user bez emailu");
    return result;
  }
  const mailboxEmail = userRow.email;

  const state = await prisma.crm_graph_sync_state.upsert({
    where: { user_id: userId },
    update: {},
    create: { user_id: userId, enabled: true },
  });

  if (!state.enabled) {
    result.errors.push("sync disabled pro usera");
    return result;
  }

  if (state.backoff_until && state.backoff_until > new Date()) {
    result.errors.push(`backoff do ${state.backoff_until.toISOString()}`);
    return result;
  }

  let inbox: DeltaResult | null = null;
  let sent: DeltaResult | null = null;

  try {
    inbox = await fetchInboxDelta(userId, state.inbox_delta);
  } catch (err) {
    await recordError(userId, err, result);
    return result;
  }

  try {
    sent = await fetchSentDelta(userId, state.sent_delta);
  } catch (err) {
    logger.warn("[crm-graph/sync-user] sent delta selhal", { userId, err: String(err) });
    result.errors.push(`sent: ${String(err)}`);
  }

  let inboxFatal = false;
  let sentFatal = false;

  const processMessage = async (msg: Parameters<typeof parseMessageToActivity>[0]): Promise<"fatal" | "ok"> => {
    const parsed = parseMessageToActivity(msg, mailboxEmail);
    if (!parsed) {
      result.skipped++;
      return "ok";
    }
    const match = await matchParent(parsed);
    if (!match) {
      result.skipped++;
      return "ok";
    }
    try {
      await prisma.crm_activities.create({
        data: {
          parent_type: match.parentType,
          parent_id: match.parentId,
          type: "EMAIL",
          date: parsed.date,
          note: `${parsed.direction === "outgoing" ? "[→]" : "[←]"} ${parsed.subject}\n\n${parsed.preview ?? ""}`,
          outcome: parsed.direction === "outgoing" ? "sent" : "received",
          owner_id: userId,
          external_id: parsed.externalId,
          external_source: "ms-graph",
        },
      });
      result.processed++;
      return "ok";
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        result.skipped++;
        return "ok";
      }
      logger.error("[crm-graph/sync-user] activity create selhal", {
        userId,
        externalId: parsed.externalId,
        err: String(err),
      });
      result.errors.push(String(err));
      return "fatal";
    }
  };

  for (const msg of inbox.messages ?? []) {
    const outcome = await processMessage(msg);
    if (outcome === "fatal") inboxFatal = true;
  }

  for (const msg of sent?.messages ?? []) {
    const outcome = await processMessage(msg);
    if (outcome === "fatal") sentFatal = true;
  }

  await prisma.crm_graph_sync_state.update({
    where: { user_id: userId },
    data: {
      inbox_delta: inboxFatal ? state.inbox_delta : (inbox.newDeltaLink ?? state.inbox_delta),
      sent_delta: sentFatal ? state.sent_delta : (sent?.newDeltaLink ?? state.sent_delta),
      last_sync_at: new Date(),
      last_error_at: result.errors.length ? new Date() : null,
      last_error_msg: result.errors.length ? result.errors.join(" | ").slice(0, 1000) : null,
      error_count: result.errors.length ? (state.error_count ?? 0) + 1 : 0,
      backoff_until: null,
    },
  });

  logger.info("[crm-graph/sync-user] hotovo", { ...result });
  return result;
}

async function recordError(userId: number, err: unknown, result: SyncUserResult): Promise<void> {
  const state = await prisma.crm_graph_sync_state.findUnique({ where: { user_id: userId } });
  const errorCount = (state?.error_count ?? 0) + 1;

  let backoffMs = Math.min(Math.pow(2, errorCount) * 60_000, MAX_BACKOFF_MS);
  if (err instanceof GraphRateLimitError) backoffMs = err.retryAfterMs;

  await prisma.crm_graph_sync_state.update({
    where: { user_id: userId },
    data: {
      last_error_at: new Date(),
      last_error_msg: String(err).slice(0, 1000),
      error_count: errorCount,
      backoff_until: new Date(Date.now() + backoffMs),
    },
  });

  logger.error("[crm-graph/sync-user] sync selhal, backoff", { userId, backoffMs, err: String(err) });
  result.errors.push(String(err));
}
