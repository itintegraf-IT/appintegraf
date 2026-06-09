import type { crm_deal_stage } from "@prisma/client";

export const STAGE_LABELS: Record<crm_deal_stage, string> = {
  LEAD: "Začínáme",
  QUALIFIED: "Proběhlo jednání",
  NABIDKA: "Šla nabídka",
  JEDNANI: "Před uzavřením",
  WON: "Výhra",
  LOST: "Prohra",
  CANCELLED: "Zrušeno",
};

export const STAGE_ORDER: crm_deal_stage[] = [
  "LEAD",
  "QUALIFIED",
  "NABIDKA",
  "JEDNANI",
  "WON",
  "LOST",
  "CANCELLED",
];

export const ACTIVE_STAGES: crm_deal_stage[] = ["LEAD", "QUALIFIED", "NABIDKA", "JEDNANI"];
export const TERMINAL_STAGES: crm_deal_stage[] = ["WON", "LOST", "CANCELLED"];

export const STAGE_ACCENT: Record<crm_deal_stage, string> = {
  LEAD: "border-t-muted-foreground/40",
  QUALIFIED: "border-t-info/70",
  NABIDKA: "border-t-warning/70",
  JEDNANI: "border-t-[hsl(270,70%,55%)]/70",
  WON: "border-t-success/70",
  LOST: "border-t-destructive/70",
  CANCELLED: "border-t-muted-foreground/40",
};

export const STAGE_DOT: Record<crm_deal_stage, string> = {
  LEAD: "bg-muted-foreground/60",
  QUALIFIED: "bg-info",
  NABIDKA: "bg-warning",
  JEDNANI: "bg-[hsl(270,70%,55%)]",
  WON: "bg-success",
  LOST: "bg-destructive",
  CANCELLED: "bg-muted-foreground/60",
};

// Soft-pill styly: světlé pozadí + tmavý text pro čitelnost.
// Pro výpisy (DealsTable, DealRelations,…). Konkrétní Tailwind paleta — stejná logika
// jako Linear/Notion badges (bg-100 + text-800/900).
export const STAGE_BADGE: Record<crm_deal_stage, string> = {
  LEAD: "bg-slate-100 text-slate-800 border-slate-200",
  QUALIFIED: "bg-sky-100 text-sky-900 border-sky-200",
  NABIDKA: "bg-amber-100 text-amber-900 border-amber-200",
  JEDNANI: "bg-purple-100 text-purple-900 border-purple-200",
  WON: "bg-emerald-100 text-emerald-900 border-emerald-200",
  LOST: "bg-rose-100 text-rose-900 border-rose-200",
  CANCELLED: "bg-zinc-100 text-zinc-700 border-zinc-200 line-through",
};

// Tečka uvnitř pillu — sytější verze stejné palety.
export const STAGE_BADGE_DOT: Record<crm_deal_stage, string> = {
  LEAD: "bg-slate-500",
  QUALIFIED: "bg-sky-600",
  NABIDKA: "bg-amber-600",
  JEDNANI: "bg-purple-600",
  WON: "bg-emerald-600",
  LOST: "bg-rose-600",
  CANCELLED: "bg-zinc-400",
};

export const STAGE_DEFAULT_PROBABILITY: Record<crm_deal_stage, number> = {
  LEAD: 10,
  QUALIFIED: 30,
  NABIDKA: 50,
  JEDNANI: 70,
  WON: 100,
  LOST: 0,
  CANCELLED: 0,
};
