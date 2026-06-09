import { NextResponse } from "next/server";
import { withApiError } from "@/lib/crm/api-utils";
import { requireCrmAdmin } from "@/lib/crm/guards";
import { prisma } from "@/lib/db";
import { GRAPH_PROVIDER } from "@/lib/crm/graph/config";
import { crmUserDisplayName } from "@/lib/crm/users";

export const GET = withApiError(async () => {
  await requireCrmAdmin();

  const activeUsers = await prisma.users.findMany({
    where: { OR: [{ is_active: true }, { is_active: null }] },
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      crm_graph_accounts: {
        where: { provider: GRAPH_PROVIDER },
        select: { id: true, provider_account_id: true, updated_at: true },
        take: 1,
      },
      crm_graph_sync_state: {
        select: {
          last_sync_at: true,
          last_error_msg: true,
          error_count: true,
          backoff_until: true,
          enabled: true,
        },
      },
    },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
  });

  const users = activeUsers.map((u) => ({
    id: u.id,
    email: u.email,
    name: crmUserDisplayName(u),
    connected: u.crm_graph_accounts.length > 0,
    graphSyncState: u.crm_graph_sync_state,
  }));

  return NextResponse.json({ users });
});
