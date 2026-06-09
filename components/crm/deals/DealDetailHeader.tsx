import type { crm_deals } from "@prisma/client";
import { DealStageChevrons } from "./DealStageChevrons";
import { DealProbabilityCircle } from "./DealProbabilityCircle";
import { DealAddMenu } from "./DealAddMenu";
import { DealActionsMenu } from "./DealActionsMenu";
import { DealReminderButton } from "@/components/crm/reminders/DealReminderButton";
import type { StageSegment } from "@/lib/crm/deal-stage-history";

import type { CrmUserOption } from "@/lib/crm/users";

type Props = {
  deal: crm_deals & { company: { id: string; name: string } };
  history: StageSegment[];
  canEdit: boolean;
  canDelete: boolean;
  users: CrmUserOption[];
  aiSummarySlot?: React.ReactNode;
};

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
}

function formatCurrency(v: number | string | { toString(): string }): string {
  const n = typeof v === "number" ? v : Number(v.toString());
  return n.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function DealDetailHeader({ deal, history, canEdit, canDelete, users, aiSummarySlot }: Props) {
  return (
    <div className="space-y-6 rounded-3xl border border-border/40 bg-card px-8 py-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Obchodní případ <span className="ml-2 text-foreground/70">{deal.number}</span>
          </div>
          <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">{deal.title}</h1>
        </div>

        <div className="flex items-end gap-8">
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Konečná cena
            </div>
            <div className="mt-1 text-2xl font-medium tabular-nums">
              {formatCurrency(deal.value)} Kč
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pravděpodobnost výhry
            </div>
            <div className="mt-1 flex items-center justify-end gap-3">
              <span className="text-2xl font-medium tabular-nums">{deal.probability} %</span>
              <DealProbabilityCircle value={deal.probability} size={36} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {aiSummarySlot}
            {canEdit ? <DealReminderButton deal={{ id: deal.id, title: deal.title }} /> : null}
            <DealAddMenu dealId={deal.id} users={users} />
            <DealActionsMenu dealId={deal.id} canEdit={canEdit} canDelete={canDelete} />
          </div>
        </div>
      </div>

      <div className="pt-4">
        <DealStageChevrons
          dealId={deal.id}
          currentStage={deal.stage}
          history={history}
          canEdit={canEdit}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Otevřeno od
          </span>
          <span className="font-medium">{formatDate(deal.created_at)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Odhad uzavření
          </span>
          <span className="font-medium">{formatDate(deal.close_date)}</span>
        </div>
      </div>
    </div>
  );
}
