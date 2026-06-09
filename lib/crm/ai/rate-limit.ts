import { prisma } from "@/lib/db";
import { AppError } from "@/lib/crm/errors";

export const SUMMARY_DAILY_LIMIT = 50;
export const SUMMARY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const SUMMARY_ACTION = "deal_summary";

export async function assertSummaryRateLimit(userId: number): Promise<void> {
  const since = new Date(Date.now() - SUMMARY_WINDOW_MS);
  const count = await prisma.crm_ai_usage.count({
    where: {
      user_id: userId,
      action: SUMMARY_ACTION,
      created_at: { gt: since },
    },
  });
  if (count >= SUMMARY_DAILY_LIMIT) {
    throw new AppError(
      "RATE_LIMITED",
      `Překročen denní limit AI shrnutí (${SUMMARY_DAILY_LIMIT}/24 h). Zkus to později.`
    );
  }
}
