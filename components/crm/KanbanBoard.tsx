"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { ThumbsDown, Ban, ThumbsUp } from "lucide-react";
import type { crm_deal_stage } from "@prisma/client";

import {
  STAGE_LABELS,
  STAGE_ACCENT,
  STAGE_DOT,
  ACTIVE_STAGES,
  TERMINAL_STAGES,
} from "@/lib/crm/deal-stages";
import { cn } from "@/lib/utils";
import { KanbanCard, type KanbanDeal } from "@/components/crm/KanbanCard";
import { QuickAddButton } from "@/components/crm/deals/QuickAddButton";
import {
  DealQuickAddDialog,
  type CreatedDeal,
} from "@/components/crm/deals/DealQuickAddDialog";
import type { CategoryOption } from "@/components/crm/deals/CategoryPicker";

type DealWithStage = KanbanDeal & { stage: crm_deal_stage };

function Column({
  stage,
  deals,
  onAdd,
  canCreate,
}: {
  stage: crm_deal_stage;
  deals: DealWithStage[];
  onAdd: (stage: crm_deal_stage) => void;
  canCreate: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const sum = deals.reduce((acc, d) => acc + d.value, 0);
  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-lg border border-border border-t-2 bg-muted/30 p-3 ${STAGE_ACCENT[stage]} ${isOver ? "ring-2 ring-ring" : ""}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className={`size-2 rounded-full ${STAGE_DOT[stage]}`} aria-hidden />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">{STAGE_LABELS[stage]}</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {deals.length} · {sum.toLocaleString("cs-CZ")} Kč
        </span>
        {canCreate ? (
          <QuickAddButton size="sm" onClick={() => onAdd(stage)} label={`Přidat deal do ${STAGE_LABELS[stage]}`} />
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        {deals.map((d) => (
          <KanbanCard key={d.id} deal={d} />
        ))}
      </div>
    </div>
  );
}

const TERMINAL_DROPS: {
  stage: crm_deal_stage;
  label: string;
  Icon: typeof ThumbsUp;
  base: string;
  active: string;
}[] = [
  {
    stage: "LOST",
    label: "Prohra",
    Icon: ThumbsDown,
    base: "border-rose-200 text-rose-700 bg-rose-50/40",
    active: "border-rose-500 bg-rose-500 text-white shadow-md",
  },
  {
    stage: "CANCELLED",
    label: "Zrušeno",
    Icon: Ban,
    base: "border-border text-muted-foreground bg-muted/30",
    active: "border-muted-foreground bg-muted-foreground text-white shadow-md",
  },
  {
    stage: "WON",
    label: "Výhra",
    Icon: ThumbsUp,
    base: "border-emerald-200 text-emerald-700 bg-emerald-50/40",
    active: "border-emerald-500 bg-emerald-500 text-white shadow-md",
  },
];

function TerminalDropZone({
  stage,
  label,
  Icon,
  base,
  active,
}: (typeof TERMINAL_DROPS)[number]) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-sm font-semibold uppercase tracking-wide transition-all",
        isOver ? active : base,
      )}
    >
      <Icon className="size-5" strokeWidth={2} />
      {label}
    </div>
  );
}

export function KanbanBoard({
  initialDeals,
  categories,
  lost_reasons,
  canCreate,
}: {
  initialDeals: DealWithStage[];
  categories: CategoryOption[];
  lost_reasons: { code: string; label: string }[];
  canCreate: boolean;
}) {
  const [deals, setDeals] = useState<DealWithStage[]>(initialDeals);
  const [activeDeal, setActiveDeal] = useState<DealWithStage | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addStage, setAddStage] = useState<crm_deal_stage>("LEAD");

  // Resync local state když parent dodá nový initialDeals (po změně filtru
  // se server-side změní filtrovaná množina; bez tohoto effectu by lokální
  // state držel data ze startu a filtr by neměl viditelný efekt).
  useEffect(() => {
    setDeals(initialDeals);
  }, [initialDeals]);

  function openAdd(stage: crm_deal_stage) {
    setAddStage(stage);
    setAddOpen(true);
  }

  function onCreated(deal: CreatedDeal) {
    if (TERMINAL_STAGES.includes(deal.stage)) return;
    setDeals((prev) => [
      {
        id: deal.id,
        number: deal.number,
        title: deal.title,
        value: 0,
        probability: 0,
        stage: deal.stage,
        company: { name: "(načítám…)" },
        owner: { id: 0, name: null, email: "", image: null },
      },
      ...prev,
    ]);
  }

  function onDragStart(event: DragStartEvent) {
    const deal = deals.find((d) => d.id === event.active.id);
    setActiveDeal(deal ?? null);
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDeal(null);
    if (!over) return;
    const dealId = String(active.id);
    const newStage = String(over.id) as crm_deal_stage;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === newStage) return;

    const previous = deals;
    const isTerminal = TERMINAL_STAGES.includes(newStage);
    setDeals((prev) =>
      isTerminal
        ? prev.filter((d) => d.id !== dealId)
        : prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d)),
    );

    try {
      const res = await fetch(`/api/deals/${dealId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) {
        const j: { error?: string } = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Stage se nepodařilo změnit");
      }
      toast.success(`Přesunuto do ${STAGE_LABELS[newStage]}`);
    } catch (err) {
      setDeals(previous);
      toast.error(err instanceof Error ? err.message : "Chyba");
    }
  }

  const isDragging = activeDeal !== null;

  return (
    <>
      {canCreate ? (
        <div className="flex justify-end">
          <QuickAddButton onClick={() => openAdd("LEAD")} label="Nový deal" />
        </div>
      ) : null}
      <DndContext collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory md:snap-none scroll-px-4">
          {ACTIVE_STAGES.map((stage) => (
            <div key={stage} className="snap-start md:snap-align-none">
              <Column
                stage={stage}
                deals={deals.filter((d) => d.stage === stage)}
                onAdd={openAdd}
                canCreate={canCreate}
              />
            </div>
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeDeal ? (
            <div className="rotate-2 scale-105">
              <KanbanCard deal={activeDeal} isOverlay />
            </div>
          ) : null}
        </DragOverlay>
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 px-4 pb-4 transition-all duration-200",
            isDragging ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
          )}
        >
          <div className="mx-auto flex max-w-6xl items-stretch gap-3 rounded-2xl bg-background/90 p-3 shadow-lg backdrop-blur">
            {TERMINAL_DROPS.map((d) => (
              <TerminalDropZone key={d.stage} {...d} />
            ))}
          </div>
        </div>
      </DndContext>
      <DealQuickAddDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        categories={categories}
        lost_reasons={lost_reasons}
        defaultStage={addStage}
        onCreated={onCreated}
      />
    </>
  );
}
