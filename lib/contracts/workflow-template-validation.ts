import { normalizeContractResolver } from "@/lib/contracts/resolveApprovers";

export type WorkflowStepInput = {
  step_order: number;
  resolver: string;
  fixed_user_id?: number | null;
};

/** Hodnoty po normalizaci – musí odpovídat `resolveApproverForWorkflowStep`. */
export const CANONICAL_RESOLVERS = [
  "department_manager",
  "legal_counsel",
  "financial_approval",
  "executive",
  "fixed_user",
] as const;

export type CanonicalResolver = (typeof CANONICAL_RESOLVERS)[number];

const ALLOWED_SET = new Set<string>(CANONICAL_RESOLVERS);

export function validateWorkflowStepsForSave(
  steps: WorkflowStepInput[]
): { ok: true; normalized: { step_order: number; resolver: string; fixed_user_id: number | null }[] } | { ok: false; message: string } {
  if (!Array.isArray(steps)) {
    return { ok: false, message: "Kroky šablony musí být pole." };
  }

  if (steps.length === 0) {
    return { ok: false, message: "Přidejte alespoň jeden krok schvalování." };
  }

  const orders = new Set<number>();
  const normalized: { step_order: number; resolver: string; fixed_user_id: number | null }[] = [];

  for (const s of steps) {
    const order = Number(s.step_order);
    if (!Number.isFinite(order) || order < 1 || order > 99) {
      return { ok: false, message: "Pořadí kroku musí být celé číslo 1–99." };
    }
    if (orders.has(order)) {
      return { ok: false, message: `Duplicitní pořadí kroku: ${order}.` };
    }
    orders.add(order);

    const resolver = normalizeContractResolver(s.resolver);
    if (!ALLOWED_SET.has(resolver)) {
      return {
        ok: false,
        message: `Neplatný resolver „${s.resolver}“. Povolené: department_manager, legal_counsel, financial_approval, executive, fixed_user (nebo aliasy ceo, legal, finance).`,
      };
    }

    let fixedUid: number | null = null;
    if (resolver === "fixed_user") {
      const id = s.fixed_user_id;
      if (id == null || !Number.isFinite(Number(id)) || Number(id) < 1) {
        return {
          ok: false,
          message: `U kroku ${order} (resolver pevný uživatel) vyberte uživatele.`,
        };
      }
      fixedUid = Math.floor(Number(id));
    }

    normalized.push(
      resolver === "fixed_user"
        ? { step_order: order, resolver, fixed_user_id: fixedUid }
        : { step_order: order, resolver, fixed_user_id: null }
    );
  }

  normalized.sort((a, b) => a.step_order - b.step_order);
  return { ok: true, normalized };
}
