import { prisma } from "@/lib/db";
import { logger } from "@/lib/crm/logger";
import { isGraphSyncEnabled, GRAPH_PROVIDER } from "./config";
import { syncUser, type SyncUserResult } from "./sync-user";

export interface SyncAllResult {
  ranAt: string;
  enabled: boolean;
  users: SyncUserResult[];
  totalProcessed: number;
  totalSkipped: number;
  totalErrors: number;
}

export async function syncAllEnabledUsers(): Promise<SyncAllResult> {
  const enabled = isGraphSyncEnabled();
  const startedAt = new Date();

  if (!enabled) {
    logger.info("[crm-graph/sync-all] CRM_GRAPH_SYNC_ENABLED=false, skipuji");
    return {
      ranAt: startedAt.toISOString(),
      enabled: false,
      users: [],
      totalProcessed: 0,
      totalSkipped: 0,
      totalErrors: 0,
    };
  }

  const linkedUserIds = await prisma.crm_graph_accounts.findMany({
    where: { provider: GRAPH_PROVIDER, refresh_token: { not: null } },
    select: { user_id: true },
    distinct: ["user_id"],
  });
  const ids = linkedUserIds.map((r) => r.user_id);
  if (ids.length === 0) {
    return {
      ranAt: startedAt.toISOString(),
      enabled: true,
      users: [],
      totalProcessed: 0,
      totalSkipped: 0,
      totalErrors: 0,
    };
  }

  const now = new Date();
  const candidates = await prisma.users.findMany({
    where: {
      id: { in: ids },
      AND: [
        { OR: [{ is_active: true }, { is_active: null }] },
        {
          OR: [
            { crm_graph_sync_state: null },
            {
              crm_graph_sync_state: {
                enabled: true,
                OR: [{ backoff_until: null }, { backoff_until: { lt: now } }],
              },
            },
          ],
        },
      ],
    },
    select: { id: true, email: true },
  });

  logger.info("[crm-graph/sync-all] start", { candidates: candidates.length });

  const results: SyncUserResult[] = [];
  for (const u of candidates) {
    try {
      results.push(await syncUser(u.id));
    } catch (err) {
      logger.error("[crm-graph/sync-all] neočekávaná chyba", { userId: u.id, err: String(err) });
      results.push({ userId: u.id, processed: 0, skipped: 0, errors: [String(err)] });
    }
  }

  const totalProcessed = results.reduce((a, r) => a + r.processed, 0);
  const totalSkipped = results.reduce((a, r) => a + r.skipped, 0);
  const totalErrors = results.reduce((a, r) => a + r.errors.length, 0);

  return {
    ranAt: startedAt.toISOString(),
    enabled: true,
    users: results,
    totalProcessed,
    totalSkipped,
    totalErrors,
  };
}
