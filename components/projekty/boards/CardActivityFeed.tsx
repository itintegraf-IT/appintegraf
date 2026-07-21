"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { Activity } from "lucide-react";

type AuditEntry = {
  id: string;
  userId: number | null;
  user: { name: string | null; email: string | null } | null;
  action: "CREATE" | "UPDATE" | "DELETE";
  entityType: string;
  entityId: string;
  diff: unknown;
  createdAt: string;
};

const ACTION_LABEL: Record<AuditEntry["action"], string> = {
  CREATE: "vytvořil",
  UPDATE: "upravil",
  DELETE: "smazal",
};

export function CardActivityFeed({ cardId }: { cardId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    fetch(`/api/projekty/audit?cardId=${cardId}`)
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("fetch failed")),
      )
      .then((data: { entries: AuditEntry[] }) => setEntries(data.entries))
      .catch(() => undefined);
  }, [cardId]);

  if (entries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        <Activity className="mr-2 inline size-4" />
        Žádná aktivita
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-tight text-foreground">
        <Activity className="size-4" /> Aktivita
      </h3>
      <ol className="space-y-1.5 border-l-2 border-muted pl-3">
        {entries.map((e) => (
          <li key={e.id} className="text-xs">
            <span className="font-medium">
              {e.user?.name ?? e.user?.email ?? "—"}
            </span>{" "}
            {ACTION_LABEL[e.action]} {e.entityType}{" "}
            <span className="text-muted-foreground">
              · {format(new Date(e.createdAt), "d. M. yyyy HH:mm", { locale: cs })}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
