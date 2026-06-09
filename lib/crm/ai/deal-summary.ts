import { AppError } from "@/lib/crm/errors";
import { DealSummaryContentSchema, type DealSummaryContent } from "./types";

export const SYSTEM_PROMPT = `Jsi CRM analytik pro českou polygrafickou firmu Integraf, s.r.o. Tvým úkolem je shrnout obchodní případ (deal) pro sales tým.

PRAVIDLA:
1. Odpovídej VÝHRADNĚ česky.
2. Vrať VÝHRADNĚ validní JSON ve struktuře níže — žádné markdown fences, žádné komentáře, žádný text před/za JSON.
3. NIKDY si nevymýšlej fakta, jména, čísla nebo data, která nejsou v poskytnutém kontextu. Pokud informace chybí, napiš v dané sekci "Nedostatek dat" nebo nech pole prázdné.
4. Datumy formátuj jako DD.MM.YYYY.
5. Buď stručný a faktický. Žádný marketing language.
6. nextActions musí být návrhy, ne příkazy. Sales člověk je čte jako inspiraci, akce zadává sám ručně.

VÝSTUPNÍ JSON STRUKTURA (přesně tato pole, vše string nebo string[]):
{
  "factStrip": "Jeden řádek faktů: deal · stage · hodnota · pravděpodobnost · close date",
  "clientInfo": ["Bullet points o klientovi (firma, segment, decision maker)"],
  "topics": ["3-7 témat, která se v dealu řeší (z aktivit a poznámek)"],
  "history": [{ "date": "DD.MM.YYYY", "description": "Co se stalo" }],
  "upcoming": [{ "date": "DD.MM.YYYY", "description": "Co je naplánované" }],
  "conclusion": "1 odstavec (3-5 vět) shrnutí stavu dealu.",
  "nextActions": ["3-5 návrhů dalších akcí"]
}

LIMITY:
- factStrip: max 300 znaků
- conclusion: max 1500 znaků
- každý bullet: max 300 znaků
- topics, clientInfo, nextActions: max 10 položek
- history: max 50, upcoming: max 20`;

export type DealForPrompt = {
  id: string;
  title: string;
  value: number | { toString(): string };
  stage: string;
  probability: number;
  closeDate: Date | null;
  company: { name: string; segment?: string | null; tags?: string[] };
  contacts: Array<{
    firstName: string;
    lastName: string;
    position?: string | null;
    isDecisionMaker?: boolean;
  }>;
  owner: { name: string };
};

export type ActivityForPrompt = {
  type: string;
  date: Date;
  subject?: string | null;
  note?: string | null;
  durationMin?: number | null;
};

export type NoteForPrompt = {
  content: string;
  createdAt: Date;
};

export type AuditForPrompt = {
  action: string;
  createdAt: Date;
  diff: Record<string, unknown>;
};

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("cs-CZ");
}

function stringifyStage(value: unknown): string {
  if (value === undefined || value === null) return "?";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function buildContextMessage(
  deal: DealForPrompt,
  activities: ActivityForPrompt[],
  notes: NoteForPrompt[],
  audits: AuditForPrompt[]
): string {
  const dm = deal.contacts.find((c) => c.isDecisionMaker);
  const stageTransitions = audits
    .filter((a) => {
      const stageDiff = a.diff?.stage as { before?: unknown; after?: unknown } | undefined;
      return stageDiff && (stageDiff.before !== undefined || stageDiff.after !== undefined);
    })
    .map((a) => {
      const sd = a.diff.stage as { before?: unknown; after?: unknown };
      return {
        date: fmtDate(a.createdAt),
        from: stringifyStage(sd.before),
        to: stringifyStage(sd.after),
      };
    });

  const payload = {
    deal: {
      title: deal.title,
      stage: deal.stage,
      value: Number(deal.value).toLocaleString("cs-CZ"),
      probability: deal.probability,
      closeDate: fmtDate(deal.closeDate),
      owner: deal.owner.name,
    },
    company: {
      name: deal.company.name,
      segment: deal.company.segment ?? "—",
      tags: deal.company.tags ?? [],
    },
    decisionMaker: dm
      ? {
          name: `${dm.firstName} ${dm.lastName}`,
          position: dm.position ?? "—",
        }
      : null,
    otherContacts: deal.contacts
      .filter((c) => !c.isDecisionMaker)
      .map((c) => ({
        name: `${c.firstName} ${c.lastName}`,
        position: c.position ?? "—",
      })),
    stageTransitions,
    activities: activities.map((a) => ({
      type: a.type,
      date: fmtDate(a.date),
      subject: a.subject ?? "—",
      note: a.note ?? "",
      durationMin: a.durationMin ?? null,
    })),
    notes: notes.map((n) => ({
      date: fmtDate(n.createdAt),
      content: n.content,
    })),
  };

  return `Vygeneruj shrnutí pro tento deal podle pravidel v system promptu. Kontext:\n\n${JSON.stringify(payload, null, 2)}`;
}

function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const inner = fenced?.[1];
  return inner !== undefined ? inner.trim() : trimmed;
}

export function parseAndValidate(rawText: string): DealSummaryContent {
  const cleaned = stripMarkdownFences(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new AppError("PARSE_ERROR", "AI vrátilo nevalidní JSON. Zkus generování znovu.", {
      cause: err,
    });
  }
  const result = DealSummaryContentSchema.safeParse(parsed);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const detail = firstIssue ? firstIssue.message : "neznámé pole";
    throw new AppError("PARSE_ERROR", `AI výstup neodpovídá očekávané struktuře: ${detail}`);
  }
  return result.data;
}
