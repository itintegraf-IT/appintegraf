import Link from "next/link";
import type { Role } from "@/lib/crm/rbac";

export function DealsEmptyState({ role }: { role: Role }) {
  const clearHref = role === "SALES" ? "/crm/deals/kanban?mine=1" : "/crm/deals/kanban";
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-md border bg-muted/30 p-8 text-center">
      <p className="text-base text-muted-foreground">Žádné dealy neodpovídají filtru.</p>
      <Link href={clearHref} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Vyčistit filtry
      </Link>
    </div>
  );
}
