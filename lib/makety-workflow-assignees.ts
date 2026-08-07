import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";
import { userHasMaketyGrafikaRole } from "@/lib/makety-grafika-users";
import {
  userHasMaketySchvalovatelFinalRole,
  userHasMaketySchvalovatelPrepressRole,
} from "@/lib/makety-schvalovatel-users";

export type MaketyWorkflowAssignees = {
  assignee_user_id: number;
  prepress_user_id: number | null;
  final_approver_user_id: number | null;
};

function parseId(raw: unknown): number | null | "invalid" {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = parseInt(String(raw), 10);
  if (Number.isNaN(n) || n < 1) return "invalid";
  return n;
}

export function parseWorkflowAssigneesFromInput(input: {
  get: (key: string) => FormDataEntryValue | null;
} | Record<string, unknown>): {
  assignee_user_id: number | null | "invalid";
  prepress_user_id: number | null | "invalid";
  final_approver_user_id: number | null | "invalid";
} {
  const read = (key: string): unknown => {
    if (typeof (input as { get?: unknown }).get === "function") {
      return (input as FormData).get(key);
    }
    return (input as Record<string, unknown>)[key];
  };
  return {
    assignee_user_id: parseId(read("assignee_user_id")),
    prepress_user_id: parseId(read("prepress_user_id")),
    final_approver_user_id: parseId(read("final_approver_user_id")),
  };
}

/** Validace osob ve workflow grafiky. Pro maketa vrací jen assignee. */
export async function resolveGrafikaWorkflowAssignees(
  workType: string,
  assigneeUserId: number,
  prepressUserId: number | null,
  finalApproverUserId: number | null
): Promise<MaketyWorkflowAssignees | { error: string }> {
  if (workType !== "grafika") {
    return {
      assignee_user_id: assigneeUserId,
      prepress_user_id: null,
      final_approver_user_id: null,
    };
  }

  if (prepressUserId == null) {
    return { error: "Vyberte schvalovatele prepress" };
  }
  if (finalApproverUserId == null) {
    return { error: "Vyberte finálního schvalovatele" };
  }

  const [assignee, prepress, final] = await Promise.all([
    prisma.users.findFirst({
      where: { id: assigneeUserId, is_active: true },
      select: { id: true },
    }),
    prisma.users.findFirst({
      where: { id: prepressUserId, is_active: true },
      select: { id: true },
    }),
    prisma.users.findFirst({
      where: { id: finalApproverUserId, is_active: true },
      select: { id: true },
    }),
  ]);

  if (!assignee) return { error: "Grafik neexistuje nebo není aktivní" };
  if (!prepress) return { error: "Schvalovatel prepress neexistuje nebo není aktivní" };
  if (!final) return { error: "Finální schvalovatel neexistuje nebo není aktivní" };

  const [okGrafik, okPrepress, okFinal] = await Promise.all([
    userHasMaketyGrafikaRole(assigneeUserId).then(async (ok) => ok || (await isAdmin(assigneeUserId))),
    userHasMaketySchvalovatelPrepressRole(prepressUserId).then(
      async (ok) => ok || (await isAdmin(prepressUserId))
    ),
    userHasMaketySchvalovatelFinalRole(finalApproverUserId).then(
      async (ok) => ok || (await isAdmin(finalApproverUserId))
    ),
  ]);

  if (!okGrafik) return { error: "Vybraný uživatel nemá roli Grafika" };
  if (!okPrepress) return { error: "Vybraný uživatel nemá roli Schvalovatel prepress" };
  if (!okFinal) return { error: "Vybraný uživatel nemá roli Finální schvalovatel grafiky" };

  return {
    assignee_user_id: assigneeUserId,
    prepress_user_id: prepressUserId,
    final_approver_user_id: finalApproverUserId,
  };
}
