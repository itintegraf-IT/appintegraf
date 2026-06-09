"use client";

import { motion } from "framer-motion";
import { ThumbsUp, ThumbsDown, Ban } from "lucide-react";
import type { crm_deal_stage } from "@prisma/client";
import { STAGE_LABELS } from "@/lib/crm/deal-stages";
import { cn } from "@/lib/utils";

const SEGMENTS: crm_deal_stage[] = ["LEAD", "QUALIFIED", "NABIDKA", "JEDNANI"];

export function StageProgressPicker({
  value,
  onChange,
}: {
  value: crm_deal_stage;
  onChange: (stage: crm_deal_stage) => void;
}) {
  const isWon = value === "WON";
  const isLost = value === "LOST";
  const isCancelled = value === "CANCELLED";
  const inPipeline = !isWon && !isLost && !isCancelled;

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex flex-1 rounded-full bg-muted p-1">
        {SEGMENTS.map((s) => {
          const active = inPipeline && s === value;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              aria-pressed={active}
              className={cn(
                "relative z-10 flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="stage-pill"
                  className="absolute inset-0 rounded-full bg-background shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              ) : null}
              <span className="relative">{STAGE_LABELS[s]}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange("WON")}
          aria-label="Označit jako vyhraný"
          aria-pressed={isWon}
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-full border transition-all",
            isWon
              ? "border-success bg-success text-success-foreground"
              : "border-border bg-background text-muted-foreground hover:text-success",
            "hover:scale-105 active:scale-95",
          )}
        >
          <ThumbsUp className="size-5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => onChange("LOST")}
          aria-label="Označit jako prohraný"
          aria-pressed={isLost}
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-full border transition-all",
            isLost
              ? "border-destructive bg-destructive text-destructive-foreground"
              : "border-border bg-background text-muted-foreground hover:text-destructive",
            "hover:scale-105 active:scale-95",
          )}
        >
          <ThumbsDown className="size-5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => onChange("CANCELLED")}
          aria-label="Označit jako zrušený"
          aria-pressed={isCancelled}
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-full border transition-all",
            isCancelled
              ? "border-muted-foreground bg-muted-foreground text-background"
              : "border-border bg-background text-muted-foreground hover:text-foreground",
            "hover:scale-105 active:scale-95",
          )}
        >
          <Ban className="size-5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
