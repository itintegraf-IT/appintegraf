import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ContractApprovalStatus } from "@/lib/contracts/workflow-status";
import { logContractAudit } from "@/lib/contracts/audit";
import {
  resolveApproverForWorkflowStep,
  resolveDepartmentIdForContract,
} from "@/lib/contracts/resolveApprovers";
import { getCurrentPendingApproval, getWorkflowStepsOrdered } from "@/lib/contracts/workflow-helpers";

/**
 * POST /api/contracts/[id]/approve
 * Body: { action: "approve" | "reject", comment?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const contractId = parseInt((await params).id, 10);
  if (Number.isNaN(contractId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const userId = parseInt(session.user.id, 10);

  const body = await req.json().catch(() => ({}));
  const action = body.action === "reject" ? "reject" : "approve";
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";

  if (action === "reject" && !comment) {
    return NextResponse.json({ error: "U zamítnutí uveďte důvod." }, { status: 400 });
  }

  const contract = await prisma.contracts.findUnique({
    where: { id: contractId },
    include: {
      contract_types: { select: { name: true } },
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "Smlouva nenalezena" }, { status: 404 });
  }

  if (contract.approval_status !== ContractApprovalStatus.IN_APPROVAL) {
    return NextResponse.json({ error: "Smlouva nečeká na schválení." }, { status: 400 });
  }

  const pending = await getCurrentPendingApproval(prisma, contractId);
  if (!pending) {
    return NextResponse.json({ error: "Není otevřený krok schvalování." }, { status: 400 });
  }

  if (pending.approver_id !== userId) {
    return NextResponse.json(
      { error: "Tuto smlouvu nemáte na schválení vy." },
      { status: 403 }
    );
  }

  if (action === "reject") {
    await prisma.$transaction([
      prisma.contract_approvals.update({
        where: { id: pending.id },
        data: {
          status: "rejected",
          comment,
          updated_at: new Date(),
        },
      }),
      prisma.contracts.update({
        where: { id: contractId },
        data: {
          approval_status: ContractApprovalStatus.REJECTED,
          updated_at: new Date(),
        },
      }),
      prisma.notifications.create({
        data: {
          user_id: contract.created_by,
          title: "Smlouva zamítnuta",
          message: `Smlouva „${contract.title}“ byla zamítnuta. Důvod: ${comment}`,
          type: "contract_rejected",
          link: `/contracts/${contractId}`,
        },
      }),
    ]);

    await logContractAudit({
      userId,
      action: "reject:contracts",
      tableName: "contracts",
      recordId: contractId,
      newValues: { approval_status: ContractApprovalStatus.REJECTED },
    });

    return NextResponse.json({ success: true, message: "Smlouva byla zamítnuta." });
  }

  // --- schválení: nejdřív zjistit další krok a přiřaditelnost, pak transakce ---
  const steps = await getWorkflowStepsOrdered(prisma, contract.contract_type_id);
  const currentOrder = pending.approval_order ?? 0;
  const nextStep = steps
    .filter((s) => s.step_order > currentOrder)
    .sort((a, b) => a.step_order - b.step_order)[0];

  const deptId = await resolveDepartmentIdForContract(prisma, contract);

  let nextResolved: { userId: number } | null = null;
  if (nextStep) {
    const resolved = await resolveApproverForWorkflowStep(
      prisma,
      { resolver: nextStep.resolver, fixed_user_id: nextStep.fixed_user_id },
      { departmentId: deptId, createdByUserId: contract.created_by }
    );
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: 400 });
    }
    nextResolved = { userId: resolved.userId };
  }

  if (nextStep && nextResolved) {
    await prisma.$transaction([
      prisma.contract_approvals.update({
        where: { id: pending.id },
        data: {
          status: "approved",
          comment: "Schváleno",
          approved_at: new Date(),
          updated_at: new Date(),
        },
      }),
      prisma.contract_approvals.create({
        data: {
          contract_id: contractId,
          approver_id: nextResolved.userId,
          approval_type: nextStep.resolver,
          approval_order: nextStep.step_order,
          status: "pending",
        },
      }),
      prisma.contracts.update({
        where: { id: contractId },
        data: { updated_at: new Date() },
      }),
      prisma.notifications.create({
        data: {
          user_id: nextResolved.userId,
          title: "Smlouva ke schválení",
          message: `Smlouva „${contract.title}“ čeká na váš krok schválení.`,
          type: "contract_approval",
          link: `/contracts/${contractId}`,
        },
      }),
    ]);

    await logContractAudit({
      userId,
      action: "approve_step:contracts",
      tableName: "contracts",
      recordId: contractId,
      newValues: { next_approver_id: nextResolved.userId, step_order: nextStep.step_order },
    });

    return NextResponse.json({
      success: true,
      message: "Krok byl schválen, čeká se na dalšího schvalovatele.",
    });
  }

  await prisma.$transaction([
    prisma.contract_approvals.update({
      where: { id: pending.id },
      data: {
        status: "approved",
        comment: "Schváleno",
        approved_at: new Date(),
        updated_at: new Date(),
      },
    }),
    prisma.contracts.update({
      where: { id: contractId },
      data: {
        approval_status: ContractApprovalStatus.APPROVAL_COMPLETED,
        updated_at: new Date(),
      },
    }),
    prisma.notifications.create({
      data: {
        user_id: contract.created_by,
        title: "Smlouva schválena",
        message: `Vaše smlouva „${contract.title}“ prošla schvalováním. Můžete pokračovat k podpisu.`,
        type: "contract_approved",
        link: `/contracts/${contractId}`,
      },
    }),
  ]);

  await logContractAudit({
    userId,
    action: "approve_final:contracts",
    tableName: "contracts",
    recordId: contractId,
    newValues: { approval_status: ContractApprovalStatus.APPROVAL_COMPLETED },
  });

  return NextResponse.json({
    success: true,
    message: "Schvalování je dokončeno.",
  });
}
