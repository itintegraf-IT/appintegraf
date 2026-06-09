"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown, Ban } from "lucide-react";
import type { crm_deal_stage } from "@prisma/client";
import { STAGE_LABELS } from "@/lib/crm/deal-stages";
import { cn } from "@/lib/utils";
import type { StageSegment } from "@/lib/crm/deal-stage-history";

const PIPELINE_STAGES: crm_deal_stage[] = ["LEAD", "QUALIFIED", "NABIDKA", "JEDNANI"];

// Per-stage paleta — sladěná s STAGE_BADGE v listingu, ale chevron používá tři stavy:
// active (sytá barva + bílý text), completed (světlé bg + tmavý text), upcoming (muted).
const STAGE_CHEVRON_ACTIVE: Record<crm_deal_stage, string> = {
  LEAD: "bg-slate-500 text-white",
  QUALIFIED: "bg-sky-500 text-white",
  NABIDKA: "bg-amber-500 text-white",
  JEDNANI: "bg-purple-500 text-white",
  WON: "bg-emerald-500 text-white",
  LOST: "bg-rose-500 text-white",
  CANCELLED: "bg-zinc-400 text-white",
};

const STAGE_CHEVRON_COMPLETED: Record<crm_deal_stage, string> = {
  LEAD: "bg-slate-100 text-slate-800",
  QUALIFIED: "bg-sky-100 text-sky-900",
  NABIDKA: "bg-amber-100 text-amber-900",
  JEDNANI: "bg-purple-100 text-purple-900",
  WON: "bg-emerald-100 text-emerald-900",
  LOST: "bg-rose-100 text-rose-900",
  CANCELLED: "bg-zinc-100 text-zinc-700",
};

type Props = {
  dealId: string;
  currentStage: crm_deal_stage;
  history: StageSegment[];
  canEdit: boolean;
};

export function DealStageChevrons({ dealId, currentStage, history, canEdit }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<crm_deal_stage | null>(null);

  const isWon = currentStage === "WON";
  const isLost = currentStage === "LOST";
  const isCancelled = currentStage === "CANCELLED";
  const isTerminal = isWon || isLost || isCancelled;

  const daysFor = (stage: crm_deal_stage): number | null => {
    const segment = history.find((s) => s.stage === stage);
    return segment ? segment.days : null;
  };

  const stageState = (stage: crm_deal_stage): "completed" | "active" | "upcoming" => {
    if (isTerminal) return "completed";
    if (stage === currentStage) return "active";
    const currentIdx = PIPELINE_STAGES.indexOf(currentStage);
    const stageIdx = PIPELINE_STAGES.indexOf(stage);
    return stageIdx < currentIdx ? "completed" : "upcoming";
  };

  async function changeStage(target: crm_deal_stage) {
    if (!canEdit) return;
    if (target === currentStage) return;
    setPending(target);
    try {
      const res = await fetch(`/api/deals/${dealId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: target }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Nepodařilo se změnit fázi.");
      }
      toast.success(`Fáze: ${STAGE_LABELS[target]}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chyba při změně fáze.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-1 min-w-0">
        {PIPELINE_STAGES.map((stage, idx) => {
          const state = stageState(stage);
          const days = daysFor(stage);
          const isFirst = idx === 0;
          const isLast = idx === PIPELINE_STAGES.length - 1;

          // V terminálním stavu (WON/LOST/CANCELLED) všechny chevrony převezmou barvu
          // outcomu — vizuálně signalizuje, že pipeline je uzavřená.
          const colorStage: crm_deal_stage = isTerminal ? currentStage : stage;

          const baseClass = cn(
            "relative flex-1 px-4 py-3 text-xs font-semibold uppercase tracking-wide transition-colors text-center",
            !canEdit && "cursor-default",
            canEdit && "cursor-pointer hover:brightness-95",
            state === "active" && STAGE_CHEVRON_ACTIVE[colorStage],
            state === "completed" && STAGE_CHEVRON_COMPLETED[colorStage],
            state === "upcoming" && "bg-muted/40 text-muted-foreground",
          );

          const clipPath = isLast
            ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)"
            : isFirst
              ? "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)"
              : "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)";

          return (
            <div key={stage} className="relative flex-1 min-w-0">
              {days !== null ? (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {days} dní
                </div>
              ) : null}
              <button
                type="button"
                disabled={!canEdit || pending !== null}
                onClick={() => changeStage(stage)}
                className={baseClass}
                style={{ clipPath, marginLeft: isFirst ? 0 : "-10px" }}
                aria-pressed={state === "active"}
              >
                <span className="block truncate">{STAGE_LABELS[stage]}</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pl-2">
        <button
          type="button"
          disabled={!canEdit || pending !== null}
          onClick={() => changeStage("WON")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-all",
            isWon
              ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
              : "border-border bg-card text-muted-foreground hover:border-emerald-400 hover:text-emerald-700",
            "active:scale-95",
          )}
        >
          <ThumbsUp className="size-4" strokeWidth={2} />
          Výhra
        </button>
        <button
          type="button"
          disabled={!canEdit || pending !== null}
          onClick={() => changeStage("LOST")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-all",
            isLost
              ? "border-rose-500 bg-rose-500 text-white shadow-sm"
              : "border-border bg-card text-muted-foreground hover:border-rose-400 hover:text-rose-700",
            "active:scale-95",
          )}
        >
          <ThumbsDown className="size-4" strokeWidth={2} />
          Prohra
        </button>
        <button
          type="button"
          disabled={!canEdit || pending !== null}
          onClick={() => changeStage("CANCELLED")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-all",
            isCancelled
              ? "border-muted-foreground bg-muted-foreground text-white shadow-sm"
              : "border-border bg-card text-muted-foreground hover:border-muted-foreground hover:text-foreground",
            "active:scale-95",
          )}
        >
          <Ban className="size-4" strokeWidth={2} />
          Zrušeno
        </button>
      </div>
    </div>
  );
}
