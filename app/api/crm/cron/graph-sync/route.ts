import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { withApiError } from "@/lib/crm/api-utils";
import { AppError } from "@/lib/crm/errors";
import { logger } from "@/lib/crm/logger";
import { getCrmCronSecret, isGraphSyncEnabled } from "@/lib/crm/graph/config";
import { syncAllEnabledUsers } from "@/lib/crm/graph/sync-all";

export const POST = withApiError(async (req: NextRequest) => {
  if (!isGraphSyncEnabled()) {
    return NextResponse.json({ skipped: true, reason: "CRM_GRAPH_SYNC_ENABLED=false" }, { status: 503 });
  }

  const secret = getCrmCronSecret();
  if (!secret) {
    throw new AppError("INTERNAL", "CRM_CRON_SECRET není nastaven.");
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !equalsConstant(token, secret)) {
    logger.warn("[crm-cron/graph-sync] neplatný bearer");
    throw new AppError("FORBIDDEN", "Neplatný cron token.");
  }

  const report = await syncAllEnabledUsers();
  return NextResponse.json(report);
});

function equalsConstant(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
