import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";
import { ContractApprovalStatus } from "@/lib/contracts/workflow-status";
import { logContractAudit } from "@/lib/contracts/audit";
import {
  resolveApproverForWorkflowStep,
  resolveDepartmentIdForContract,
} from "@/lib/contracts/resolveApprovers";
import { getWorkflowStepsOrdered } from "@/lib/contracts/workflow-helpers";

/**
 * POST /api/contracts/[id]/submit
 * Odeslání návrhu ke schválení (první krok podle šablony typu smlouvy).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const userId = parseInt(session.user.id, 10);
  const userIsAdmin = await isAdmin(userId);

  const contract = await prisma.contracts.findUnique({
    where: { id },
    include: { contract_types: { select: { name: true } } },
  });

  if (!contract) {
    return NextResponse.json({ error: "Smlouva nenalezena" }, { status: 404 });
  }

  const allowed =
    contract.approval_status === ContractApprovalStatus.DRAFT ||
    contract.approval_status === ContractApprovalStatus.RETURNED;
  if (!allowed) {
    return NextResponse.json(
      { error: "Odeslat lze jen návrh nebo vrácenou smlouvu." },
      { status: 400 }
    );
  }

  if (!userIsAdmin && contract.created_by !== userId) {
    return NextResponse.json({ error: "Pouze autor smlouvy může odeslat návrh." }, { status: 403 });
  }

  const steps = await getWorkflowStepsOrdered(prisma, contract.contract_type_id);
  if (steps.length === 0) {
    return NextResponse.json(
      {
        error:
          "Pro tento typ smlouvy nejsou nastavené kroky schvalování. Doplňte je v administraci.",
      },
      { status: 400 }
    );
  }

  const first = steps[0];
  const deptId = await resolveDepartmentIdForContract(prisma, contract);
  const resolved = await resolveApproverForWorkflowStep(
    prisma,
    { resolver: first.resolver, fixed_user_id: first.fixed_user_id },
    { departmentId: deptId, createdByUserId: contract.created_by }
  );

  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.contract_approvals.deleteMany({ where: { contract_id: id } });
    await tx.contracts.update({
      where: { id },
      data: {
        approval_status: ContractApprovalStatus.IN_APPROVAL,
        updated_at: new Date(),
      },
    });
    await tx.contract_approvals.create({
      data: {
        contract_id: id,
        approver_id: resolved.userId,
        approval_type: first.resolver,
        approval_order: first.step_order,
        status: "pending",
      },
    });
    await tx.notifications.create({
      data: {
        user_id: resolved.userId,
        title: "Smlouva ke schválení",
        message: `Máte novou smlouvu ke schválení: „${contract.title}“ (${contract.contract_types?.name ?? "typ"}).`,
        type: "contract_approval",
        link: `/contracts/${id}`,
      },
    });
  });

  await logContractAudit({
    userId,
    action: "submit:contracts",
    tableName: "contracts",
    recordId: id,
    newValues: {
      approval_status: ContractApprovalStatus.IN_APPROVAL,
      first_approver_id: resolved.userId,
    },
  });

  return NextResponse.json({
    success: true,
    message: "Návrh byl odeslán ke schválení.",
  });
}
