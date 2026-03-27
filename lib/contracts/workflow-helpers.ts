import type { PrismaClient } from "@prisma/client";

export async function getWorkflowStepsOrdered(db: PrismaClient, contractTypeId: number) {
  return db.contract_workflow_steps.findMany({
    where: { contract_type_id: contractTypeId },
    orderBy: { step_order: "asc" },
  });
}

/** Aktuální čekající krok (nejmenší approval_order mezi pending). */
export async function getCurrentPendingApproval(db: PrismaClient, contractId: number) {
  return db.contract_approvals.findFirst({
    where: { contract_id: contractId, status: "pending" },
    orderBy: { approval_order: "asc" },
  });
}
