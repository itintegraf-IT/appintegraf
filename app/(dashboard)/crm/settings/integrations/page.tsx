import { prisma } from "@/lib/db";
import { GraphSyncTable } from "@/components/crm/integrations/GraphSyncTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, AlertTriangle } from "lucide-react";
import { getMicrosoftEntraConfig, isGraphSyncEnabled, GRAPH_PROVIDER } from "@/lib/crm/graph/config";
import { crmUserDisplayName } from "@/lib/crm/users";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ connected?: string; error?: string }> };

export default async function CrmIntegrationsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const entra = getMicrosoftEntraConfig();
  const syncEnabled = isGraphSyncEnabled();

  const activeUsers = await prisma.users.findMany({
    where: { OR: [{ is_active: true }, { is_active: null }] },
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      crm_graph_accounts: {
        where: { provider: GRAPH_PROVIDER },
        select: { id: true },
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
    graphSyncState: u.crm_graph_sync_state
      ? {
          ...u.crm_graph_sync_state,
          last_sync_at: u.crm_graph_sync_state.last_sync_at?.toISOString() ?? null,
          backoff_until: u.crm_graph_sync_state.backoff_until?.toISOString() ?? null,
        }
      : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Microsoft Graph integrace</h2>
        <p className="mt-1 text-sm text-gray-600">
          Synchronizace e-mailů z Outlook schránek do CRM aktivit. Propoj každého uživatele s jeho
          Microsoft 365 účtem, poté spusť sync ručně nebo přes cron.
        </p>
      </div>

      {sp.connected === "1" ? (
        <Alert className="border-emerald-200 bg-emerald-50">
          <Info className="h-4 w-4 text-emerald-700" />
          <AlertTitle className="text-emerald-900">Microsoft účet propojen</AlertTitle>
          <AlertDescription className="text-emerald-800">
            Můžeš spustit první synchronizaci e-mailů.
          </AlertDescription>
        </Alert>
      ) : null}

      {sp.error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Chyba propojení</AlertTitle>
          <AlertDescription>{decodeURIComponent(sp.error)}</AlertDescription>
        </Alert>
      ) : null}

      {!entra ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Microsoft Entra není nakonfigurováno</AlertTitle>
          <AlertDescription>
            Nastav v <code className="text-xs">.env</code>:{" "}
            <code className="text-xs">AUTH_MICROSOFT_ENTRA_ID_CLIENT_ID</code>,{" "}
            <code className="text-xs">AUTH_MICROSOFT_ENTRA_ID_CLIENT_SECRET</code>,{" "}
            <code className="text-xs">AUTH_MICROSOFT_ENTRA_ID_TENANT_ID</code>. V Azure AD
            zaregistruj redirect URI:{" "}
            <code className="text-xs">/api/crm/integrations/graph/callback</code>.
          </AlertDescription>
        </Alert>
      ) : null}

      {!syncEnabled ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Automatický cron sync je vypnutý</AlertTitle>
          <AlertDescription>
            Ruční sync z této stránky funguje. Pro periodický sync nastav{" "}
            <code className="text-xs">CRM_GRAPH_SYNC_ENABLED=true</code> a volání{" "}
            <code className="text-xs">POST /api/crm/cron/graph-sync</code> s hlavičkou{" "}
            <code className="text-xs">Authorization: Bearer CRM_CRON_SECRET</code>.
          </AlertDescription>
        </Alert>
      ) : null}

      {entra ? <GraphSyncTable initialUsers={users} /> : null}
    </div>
  );
}
