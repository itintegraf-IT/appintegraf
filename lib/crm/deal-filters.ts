import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { Role } from "@/lib/crm/rbac";
import { crm_deal_stage } from "@prisma/client";

export const NO_CATEGORY_SENTINEL = "_none" as const;

export type DealFilters = {
  q: string;
  mine: boolean;
  owner_ids: string[];
  category_ids: string[];     // může obsahovat NO_CATEGORY_SENTINEL
  stages: crm_deal_stage[];       // NEW
  closeFrom: Date | null;
  closeTo: Date | null;
};

const DateOrNull = z
  .string()
  .optional()
  .transform((v) => {
    if (!v) return null;
    // Očekáváme YYYY-MM-DD; konstruujeme local midnight pro konzistenci s toIsoDate.
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!match) {
      const fallback = new Date(v);
      return Number.isNaN(fallback.getTime()) ? null : fallback;
    }
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  });

const CommaArray = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").filter(Boolean) : []));

const StageArray = z
  .string()
  .optional()
  .transform((v) => {
    if (!v) return [] as crm_deal_stage[];
    const tokens = v.split(",").filter(Boolean);
    const validStages = Object.values(crm_deal_stage) as crm_deal_stage[];
    return tokens.filter((t): t is crm_deal_stage => validStages.includes(t as crm_deal_stage));
  });

const FiltersInput = z.object({
  q: z.string().optional().transform((v) => (v ?? "").trim()),
  mine: z.string().optional(),                 // "0" | "1" | undefined
  owner: CommaArray,
  category: CommaArray,
  stage: StageArray,                           // NEW
  closeFrom: DateOrNull,
  closeTo: DateOrNull,
});

export type RawSearchParams = Record<string, string | string[] | undefined>;

function flatten(searchParams: RawSearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(searchParams)) {
    out[k] = Array.isArray(v) ? v[0] : v;
  }
  return out;
}

export function parseFilters(searchParams: RawSearchParams, role: Role): DealFilters {
  const flat = flatten(searchParams);
  const parsed = FiltersInput.safeParse(flat);
  if (!parsed.success) {
    // nikdy bychom sem neměli dorazit — všechny pole v FiltersInput jsou optional + transform
    return {
      q: "",
      mine: role === "SALES",
      owner_ids: [],
      category_ids: [],
      stages: [],                // NEW
      closeFrom: null,
      closeTo: null,
    };
  }
  const data = parsed.data;
  const mine =
    data.mine === "1" ? true :
    data.mine === "0" ? false :
    role === "SALES";
  return {
    q: data.q,
    mine,
    owner_ids: data.owner,
    category_ids: data.category,
    stages: data.stage,          // NEW
    closeFrom: data.closeFrom,
    closeTo: data.closeTo,
  };
}

/**
 * Stavbí Prisma `where` klauzuli z parsovaných filtrů.
 *
 * **RBAC poznámka:** Tato funkce neaplikuje žádnou RBAC kontrolu nad rámec
 * sessionUserId pro `mine`. Jakýkoli owner_ids parameter z URL je respektován
 * doslova. To je v pořádku v současném modelu, kde všichni autentizovaní
 * uživatelé mohou vidět všechny dealy v `/deals/kanban`. Pokud v budoucnu
 * zavedeme per-role visibility (např. SALES vidí jen vlastní + tým), MUSÍ
 * volající kombinovat výsledek `buildWhere()` s base RBAC `where` přes `AND`.
 */
export function buildWhere(filters: DealFilters, sessionUserId: number): Prisma.crm_dealsWhereInput {
  const clauses: Prisma.crm_dealsWhereInput[] = [];

  // search q (fulltext na title / number / company.name)
  // MySQL má case-insensitive collation defaultně, mode: "insensitive" je PostgreSQL-only
  if (filters.q) {
    clauses.push({
      OR: [
        { title: { contains: filters.q } },
        { number: { contains: filters.q } },
        { company: { name: { contains: filters.q } } },
      ],
    });
  }

  // owner — explicitní výběr má přednost před mine
  if (filters.owner_ids.length > 0) {
    const ownerIds = filters.owner_ids
      .map((id) => parseInt(id, 10))
      .filter((id) => !Number.isNaN(id));
    if (ownerIds.length > 0) {
      clauses.push({ owner_id: { in: ownerIds } });
    }
  } else if (filters.mine) {
    clauses.push({ owner_id: sessionUserId });
  }

  // category s _none sentinelem
  if (filters.category_ids.length > 0) {
    const realIds = filters.category_ids.filter((id) => id !== NO_CATEGORY_SENTINEL);
    const includeNull = filters.category_ids.includes(NO_CATEGORY_SENTINEL);

    if (includeNull && realIds.length > 0) {
      clauses.push({
        OR: [
          { category_id: { in: realIds } },
          { category_id: null },
        ],
      });
    } else if (includeNull) {
      clauses.push({ category_id: null });
    } else {
      clauses.push({ category_id: { in: realIds } });
    }
  }

  // stage filter (multi-select)
  if (filters.stages.length > 0) {
    clauses.push({ stage: { in: filters.stages } });
  }

  // close date range
  if (filters.closeFrom || filters.closeTo) {
    clauses.push({
      close_date: {
        ...(filters.closeFrom ? { gte: filters.closeFrom } : {}),
        ...(filters.closeTo ? { lte: filters.closeTo } : {}),
      },
    });
  }

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0]!;
  return { AND: clauses };
}

function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Immutably patch URL filter parameters.
 *
 * Mutual exclusion: `mine` and `owner_ids` are mutually exclusive — passing
 * both in a single call throws. Setting `owner_ids` automatically clears `mine`,
 * setting `mine=true` automatically clears `owner_ids`.
 *
 * Page reset: každá změna filtru smaže `?page` parametr (paginace začíná
 * znovu od 1). Sortování (`sortBy`/`sortDir`) se nedotýká.
 */
export function setFilter(
  current: URLSearchParams,
  patch: Partial<{
    q: string;
    mine: boolean;
    owner_ids: string[];
    category_ids: string[];
    stages: crm_deal_stage[];          // NEW
    closeFrom: Date | null;
    closeTo: Date | null;
  }>
): URLSearchParams {
  if ("mine" in patch && "owner_ids" in patch) {
    throw new Error("setFilter: 'mine' and 'owner_ids' are mutually exclusive — pass one or the other");
  }
  const next = new URLSearchParams(current);

  if ("q" in patch) {
    if (patch.q && patch.q.length > 0) next.set("q", patch.q);
    else next.delete("q");
  }

  // mine ↔ owner mutual exclusion
  if ("owner_ids" in patch) {
    if (patch.owner_ids && patch.owner_ids.length > 0) {
      next.set("owner", patch.owner_ids.join(","));
      next.set("mine", "0");
    } else {
      next.delete("owner");
    }
  }

  if ("mine" in patch) {
    if (patch.mine) {
      next.set("mine", "1");
      next.delete("owner");
    } else {
      next.set("mine", "0");
    }
  }

  if ("category_ids" in patch) {
    if (patch.category_ids && patch.category_ids.length > 0) {
      next.set("category", patch.category_ids.join(","));
    } else {
      next.delete("category");
    }
  }

  if ("stages" in patch) {
    if (patch.stages && patch.stages.length > 0) {
      next.set("stage", patch.stages.join(","));
    } else {
      next.delete("stage");
    }
  }

  if ("closeFrom" in patch) {
    if (patch.closeFrom) next.set("closeFrom", toIsoDate(patch.closeFrom));
    else next.delete("closeFrom");
  }

  if ("closeTo" in patch) {
    if (patch.closeTo) next.set("closeTo", toIsoDate(patch.closeTo));
    else next.delete("closeTo");
  }

  // Změna jakéhokoli filtru resetuje paginaci na page 1
  next.delete("page");
  return next;
}

export function clearFilters(role: Role): URLSearchParams {
  const out = new URLSearchParams();
  if (role === "SALES") out.set("mine", "1");
  return out;
}

// pomocné konstanty pro tests / komponenty
export { FiltersInput, flatten };
