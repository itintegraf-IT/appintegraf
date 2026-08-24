import type { MaketyWorkType } from "@/lib/makety-work-type";

/** Stavy prepress workflow pro work_type=grafika. */
export type GrafikaStatus =
  | "open"
  | "in_progress"
  | "data_problem"
  | "done"
  | "prepress_approved"
  | "sent_for_approval"
  | "approved"
  | "cancelled";

export const GRAFIKA_STATUSES = [
  "open",
  "in_progress",
  "data_problem",
  "done",
  "prepress_approved",
  "sent_for_approval",
  "approved",
  "cancelled",
] as const;

/** Aktivní stavy ve frontě grafika (grafik pracuje nebo čeká). Pozastavené (data_problem) sem nepatří. */
export const GRAFIKA_QUEUE_STATUSES = ["open", "in_progress"] as const;

/** Stavy po dokončení grafikem – kontrola a schvalování. */
export const GRAFIKA_REVIEW_STATUSES = [
  "done",
  "prepress_approved",
  "sent_for_approval",
] as const;

const GRAFIKA_ONLY = new Set<string>([
  "data_problem",
  "prepress_approved",
  "sent_for_approval",
  "approved",
]);

export function isGrafikaOnlyStatus(status: string): boolean {
  return GRAFIKA_ONLY.has(status);
}

export function parseGrafikaStatus(raw: string): GrafikaStatus | null {
  return (GRAFIKA_STATUSES as readonly string[]).includes(raw) ? (raw as GrafikaStatus) : null;
}

export function isMaketaTerminalStatus(status: string, workType: MaketyWorkType): boolean {
  if (status === "cancelled") return true;
  if (workType === "grafika") return status === "approved";
  return status === "done";
}

/** Grafika je v archivu až po potvrzení zápisu do IML. */
export function isGrafikaImlArchived(
  status: string,
  imlAppliedAt: Date | null | undefined
): boolean {
  return status === "approved" && imlAppliedAt != null;
}

/** Prisma where pro aktivní (nearxivní) zakázky v přehledu. */
export function maketyActiveWhereClause() {
  return {
    NOT: {
      OR: [
        { status: "cancelled" },
        { work_type: "maketa", status: "done" },
        {
          AND: [
            { work_type: "grafika" },
            { status: "approved" },
            { iml_applied_at: { not: null } },
          ],
        },
      ],
    },
  };
}

/** Prisma where pro archiv. */
export function maketyArchiveWhereClause() {
  return {
    OR: [
      { status: "cancelled" },
      { work_type: "maketa", status: "done" },
      {
        AND: [
          { work_type: "grafika" },
          { status: "approved" },
          { iml_applied_at: { not: null } },
        ],
      },
    ],
  };
}

export function grafikaStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Přijato";
    case "in_progress":
      return "U grafika";
    case "data_problem":
      return "Pozastaveno";
    case "done":
      return "Hotovo grafikem";
    case "prepress_approved":
      return "Schváleno prepressem";
    case "sent_for_approval":
      return "Odesláno ke schválení";
    case "approved":
      return "Schváleno klientem";
    case "cancelled":
      return "Zrušená";
    default:
      return status;
  }
}

/** Semaforové barvy badge stavů grafiky. */
export function grafikaStatusBadgeClass(status: string): string {
  switch (status) {
    case "open":
      return "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-100";
    case "in_progress":
      return "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100";
    case "data_problem":
      return "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-100";
    case "done":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100";
    case "prepress_approved":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100";
    case "sent_for_approval":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100";
    case "approved":
      return "bg-green-200 text-green-900 dark:bg-green-800/60 dark:text-green-50";
    case "cancelled":
      return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200";
  }
}

/** Třídy tlačítek akcí workflow (semafor). */
export function grafikaTransitionButtonClass(toStatus: string, selected: boolean): string {
  const base = "rounded-lg border px-3 py-2 text-sm font-medium transition-colors";
  if (selected) {
    switch (toStatus) {
      case "open":
        return `${base} border-yellow-600 bg-yellow-500 text-white`;
      case "in_progress":
        return `${base} border-orange-600 bg-orange-500 text-white`;
      case "data_problem":
        return `${base} border-red-700 bg-red-600 text-white`;
      case "done":
      case "approved":
      case "prepress_approved":
        return `${base} border-green-700 bg-green-600 text-white`;
      case "sent_for_approval":
        return `${base} border-blue-700 bg-blue-600 text-white`;
      default:
        return `${base} border-gray-700 bg-gray-700 text-white`;
    }
  }
  switch (toStatus) {
    case "open":
      return `${base} border-yellow-300 bg-yellow-50 text-yellow-900 hover:bg-yellow-100`;
    case "in_progress":
      return `${base} border-orange-300 bg-orange-50 text-orange-900 hover:bg-orange-100`;
    case "data_problem":
      return `${base} border-red-300 bg-red-50 text-red-800 hover:bg-red-100`;
    case "done":
    case "approved":
    case "prepress_approved":
      return `${base} border-green-300 bg-green-50 text-green-800 hover:bg-green-100`;
    case "sent_for_approval":
      return `${base} border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100`;
    default:
      return `${base} border-gray-300 bg-white text-gray-800 hover:bg-gray-50`;
  }
}

type TransitionRule = {
  from: GrafikaStatus[];
  to: GrafikaStatus;
  requiresComment?: boolean;
};

const TRANSITIONS: TransitionRule[] = [
  { from: ["open"], to: "in_progress" },
  { from: ["in_progress"], to: "data_problem", requiresComment: true },
  { from: ["data_problem"], to: "open" },
  { from: ["data_problem"], to: "in_progress" },
  { from: ["sent_for_approval"], to: "in_progress", requiresComment: true },
  { from: ["in_progress"], to: "done" },
  { from: ["done"], to: "prepress_approved" },
  { from: ["done"], to: "in_progress", requiresComment: true },
  { from: ["prepress_approved"], to: "sent_for_approval" },
  { from: ["sent_for_approval"], to: "approved" },
];

export type GrafikaTransitionRole = "grafik" | "prepress" | "final" | "zadavatel";

const ROLE_TRANSITIONS: Record<GrafikaTransitionRole, Array<{ from: GrafikaStatus; to: GrafikaStatus }>> = {
  grafik: [
    { from: "open", to: "in_progress" },
    { from: "in_progress", to: "data_problem" },
    { from: "in_progress", to: "done" },
    { from: "data_problem", to: "in_progress" },
  ],
  zadavatel: [{ from: "data_problem", to: "open" }],
  prepress: [
    { from: "done", to: "prepress_approved" },
    { from: "done", to: "in_progress" },
  ],
  final: [
    { from: "prepress_approved", to: "sent_for_approval" },
    { from: "sent_for_approval", to: "approved" },
  ],
};

/** Role, které lze převzít (zadavatel/admin s potvrzením). */
const OVERRIDABLE_ROLES: GrafikaTransitionRole[] = ["grafik", "prepress", "final"];

export function getAllowedGrafikaTransitions(
  currentStatus: string,
  roles: GrafikaTransitionRole[]
): GrafikaStatus[] {
  const from = parseGrafikaStatus(currentStatus);
  if (!from) return [];
  const allowed = new Set<GrafikaStatus>();
  for (const role of roles) {
    for (const t of ROLE_TRANSITIONS[role]) {
      if (t.from === from) allowed.add(t.to);
    }
  }
  return [...allowed];
}

export type GrafikaTransitionOption = {
  toStatus: GrafikaStatus;
  viaOverride: boolean;
  actingAs: GrafikaTransitionRole;
};

/**
 * Dostupné přechody: nativní role bez potvrzení; při canOverride i cizí kroky (grafik/prepress/final).
 */
export function listGrafikaTransitionOptions(
  currentStatus: string,
  nativeRoles: GrafikaTransitionRole[],
  canOverride: boolean
): GrafikaTransitionOption[] {
  const from = parseGrafikaStatus(currentStatus);
  if (!from) return [];

  const byTo = new Map<GrafikaStatus, GrafikaTransitionOption>();

  for (const role of nativeRoles) {
    for (const t of ROLE_TRANSITIONS[role]) {
      if (t.from !== from) continue;
      byTo.set(t.to, { toStatus: t.to, viaOverride: false, actingAs: role });
    }
  }

  if (canOverride) {
    for (const role of OVERRIDABLE_ROLES) {
      for (const t of ROLE_TRANSITIONS[role]) {
        if (t.from !== from) continue;
        const existing = byTo.get(t.to);
        if (existing && !existing.viaOverride) continue;
        if (!existing) {
          byTo.set(t.to, { toStatus: t.to, viaOverride: true, actingAs: role });
        }
      }
    }
  }

  return [...byTo.values()];
}

export function grafikaActingAsLabel(role: GrafikaTransitionRole): string {
  switch (role) {
    case "grafik":
      return "grafik";
    case "prepress":
      return "prepress";
    case "final":
      return "finální schvalovatel";
    case "zadavatel":
      return "zadavatel";
  }
}

export type AssertGrafikaTransitionInput = {
  fromStatus: string;
  toStatus: string;
  comment?: string | null;
};

export function assertGrafikaTransition(input: AssertGrafikaTransitionInput): void {
  const from = parseGrafikaStatus(input.fromStatus);
  const to = parseGrafikaStatus(input.toStatus);
  if (!from || !to) {
    throw new Error("Neplatný stav zakázky.");
  }
  const rule = TRANSITIONS.find((r) => r.to === to && r.from.includes(from));
  if (!rule) {
    throw new Error(`Přechod ze stavu „${grafikaStatusLabel(from)}“ do „${grafikaStatusLabel(to)}“ není povolen.`);
  }
  if (rule.requiresComment && !(input.comment ?? "").trim()) {
    throw new Error(
      to === "in_progress"
        ? "U vrácení grafikovi je povinný komentář s důvodem."
        : "U tohoto přechodu je povinný komentář s popisem problému."
    );
  }
}

export function grafikaTransitionRequiresComment(fromStatus: string, toStatus: string): boolean {
  const from = parseGrafikaStatus(fromStatus);
  const to = parseGrafikaStatus(toStatus);
  if (!from || !to) return false;
  const rule = TRANSITIONS.find((r) => r.to === to && r.from.includes(from));
  return rule?.requiresComment === true;
}

export function grafikaTransitionActionLabel(toStatus: GrafikaStatus, fromStatus?: string): string {
  switch (toStatus) {
    case "open":
      return fromStatus === "data_problem" ? "Uvolnit ke zpracování" : "Zařadit do fronty";
    case "in_progress":
      if (fromStatus === "done") return "Vrátit grafikovi (DTP)";
      if (fromStatus === "data_problem") return "Uvolnit a pokračovat";
      if (fromStatus === "sent_for_approval") return "Vrátit grafikovi k opravě";
      return "Zahájit práci";
    case "approved":
      return "Schválit finálně (schváleno klientem)";
    case "data_problem":
      return "Pozastavit – problém s daty";
    case "done":
      return "Označit jako hotovo";
    case "prepress_approved":
      return "Schválit prepressem";
    case "sent_for_approval":
      return "Odeslat ke schválení klientovi";
    default:
      return grafikaStatusLabel(toStatus);
  }
}
