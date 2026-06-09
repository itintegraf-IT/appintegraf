"use client";

import { useState, useTransition, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link2 } from "lucide-react";

interface GraphSyncState {
  last_sync_at: string | null;
  last_error_msg: string | null;
  error_count: number;
  backoff_until: string | null;
  enabled: boolean;
}

interface UserRow {
  id: number;
  email: string;
  name: string;
  connected: boolean;
  graphSyncState: GraphSyncState | null;
}

interface SyncResponse {
  processed?: number;
  skipped?: number;
  errors?: unknown[];
  error?: string;
}

interface StatusResponse {
  users: UserRow[];
}

export function GraphSyncTable({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<number | null>(null);

  async function runSync(userId: number) {
    setRunning(userId);
    try {
      const resp = await fetch("/api/crm/integrations/graph/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({ error: "Chyba" }))) as SyncResponse;
        toast.error(data.error ?? "Sync selhal");
        return;
      }
      const result = (await resp.json()) as SyncResponse;
      const processed = result.processed ?? 0;
      const skipped = result.skipped ?? 0;
      const errorsCount = Array.isArray(result.errors) ? result.errors.length : 0;
      toast.success(`Sync hotov: ${processed} nových, ${skipped} skip, ${errorsCount} chyb`);
      startTransition(() => {
        void refreshUsers(setUsers);
      });
    } catch {
      toast.error("Sync selhal");
    } finally {
      setRunning(null);
    }
  }

  function connect(userId: number) {
    window.location.href = `/api/crm/integrations/graph/connect?userId=${userId}`;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="p-2 text-left font-medium">Uživatel</th>
            <th className="p-2 text-left font-medium">Microsoft</th>
            <th className="p-2 text-left font-medium">Poslední sync</th>
            <th className="p-2 text-left font-medium">Stav</th>
            <th className="p-2 text-right font-medium">Akce</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-gray-100">
              <td className="p-2">
                <div className="font-medium text-gray-900">{u.name}</div>
                <div className="text-xs text-gray-500">{u.email}</div>
              </td>
              <td className="p-2">
                {u.connected ? (
                  <span className="text-green-700">propojeno</span>
                ) : (
                  <span className="text-gray-500">nepropojeno</span>
                )}
              </td>
              <td className="p-2">{formatDate(u.graphSyncState?.last_sync_at ?? null)}</td>
              <td className="p-2">{renderStatus(u)}</td>
              <td className="p-2 text-right">
                <div className="flex justify-end gap-2">
                  {!u.connected ? (
                    <Button size="sm" variant="outline" onClick={() => connect(u.id)}>
                      <Link2 className="mr-1 size-3.5" />
                      Propojit
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={running === u.id || pending}
                      onClick={() => runSync(u.id)}
                    >
                      {running === u.id ? "Běží…" : "Spustit sync"}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={5} className="p-4 text-center text-gray-500">
                Žádní aktivní uživatelé.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(d: Date | string | null): string {
  if (!d) return "nikdy";
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(d)
  );
}

function renderStatus(u: UserRow): ReactElement {
  if (!u.connected) return <span className="text-gray-500">—</span>;
  const s = u.graphSyncState;
  if (!s) return <span className="text-gray-500">neinicializováno</span>;
  if (s.backoff_until && new Date(s.backoff_until) > new Date()) {
    return <span className="text-amber-600">backoff do {formatDate(s.backoff_until)}</span>;
  }
  if (s.last_error_msg) {
    return (
      <span className="text-red-600" title={s.last_error_msg}>
        chyba (×{s.error_count})
      </span>
    );
  }
  return <span className="text-green-700">OK</span>;
}

async function refreshUsers(setUsers: (u: UserRow[]) => void) {
  const resp = await fetch("/api/crm/integrations/graph/status");
  if (!resp.ok) return;
  const data = (await resp.json()) as StatusResponse;
  setUsers(data.users);
}
