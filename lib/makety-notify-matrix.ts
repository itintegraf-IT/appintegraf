/** Role vůči konkrétní maketě/grafice (pro matici e-mailů §4.5). */
export type MaketaPartyRole = "grafik" | "prepress" | "zadavatel" | "other";

/**
 * Které role smí dostat e-mail pro daný typ události (grafika).
 * In-app notifikace zůstávají bez této filtrace.
 *
 * Spec: grafik jen zamítnutí; prepress jen hotovo grafikem; zadavatel schválení Michalem + výsledek u klienta.
 */
const GRAFIKA_EMAIL_MATRIX: Partial<Record<string, MaketaPartyRole[]>> = {
  client_rejected: ["grafik", "zadavatel"],
  returned_to_dtp: ["grafik"],
  data_problem: ["zadavatel"],
  awaiting_prepress: ["prepress"],
  done: ["prepress"],
  prepress_ok: ["zadavatel"],
  client_approved: ["zadavatel"],
  approved: ["zadavatel"],
  sent_for_client: ["zadavatel"],
  // Založení / přiřazení: jen příslušná role (ne spam na všechny)
  assigned: ["grafik"],
  workflow_assigned: ["grafik", "prepress"],
  awaiting_final: ["zadavatel"],
};

export function partyRoleForMaketa(params: {
  userId: number;
  assigneeUserId: number | null | undefined;
  prepressUserId: number | null | undefined;
  creatorUserId: number | null | undefined;
}): MaketaPartyRole {
  if (params.assigneeUserId === params.userId) return "grafik";
  if (params.prepressUserId === params.userId) return "prepress";
  if (params.creatorUserId === params.userId) return "zadavatel";
  return "other";
}

/** True = uživatel smí dostat e-mail (u makety bez matice vždy true). */
export function allowMaketaEmailByMatrix(params: {
  workType: string;
  kind: string;
  role: MaketaPartyRole;
}): boolean {
  if (params.workType !== "grafika") return true;
  const allowed = GRAFIKA_EMAIL_MATRIX[params.kind];
  if (!allowed) return params.role !== "other";
  return allowed.includes(params.role);
}
