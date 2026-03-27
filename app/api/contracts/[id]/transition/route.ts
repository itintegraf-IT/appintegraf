import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";
import { ContractApprovalStatus } from "@/lib/contracts/workflow-status";
import { logContractAudit } from "@/lib/contracts/audit";
import { canManageContractRecord } from "@/lib/contracts/access";

/**
 * POST /api/contracts/[id]/transition
 * Body: { action: "begin_signature" | "sign" | "archive", signed_at?: string (ISO, jen u sign) }
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
  const admin = await isAdmin(userId);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "").trim();

  const contract = await prisma.contracts.findUnique({ where: { id: contractId } });
  if (!contract) {
    return NextResponse.json({ error: "Smlouva nenalezena" }, { status: 404 });
  }

  if (!canManageContractRecord(contract, userId, admin)) {
    return NextResponse.json({ error: "Nemáte oprávnění." }, { status: 403 });
  }

  if (action === "begin_signature") {
    if (contract.approval_status !== ContractApprovalStatus.APPROVAL_COMPLETED) {
      return NextResponse.json(
        { error: "Přechod k podpisu je možný až po dokončeném schvalování." },
        { status: 400 }
      );
    }
    await prisma.contracts.update({
      where: { id: contractId },
      data: {
        approval_status: ContractApprovalStatus.SIGNATURE_PENDING,
        updated_at: new Date(),
      },
    });
    await logContractAudit({
      userId,
      action: "transition:begin_signature",
      tableName: "contracts",
      recordId: contractId,
      newValues: { approval_status: ContractApprovalStatus.SIGNATURE_PENDING },
    });
    return NextResponse.json({ success: true, message: "Stav: čeká na podpis." });
  }

  if (action === "sign") {
    if (contract.approval_status !== ContractApprovalStatus.SIGNATURE_PENDING) {
      return NextResponse.json(
        { error: "Zapsat podpis lze ve stavu „čeká na podpis“." },
        { status: 400 }
      );
    }
    let signedAt = new Date();
    if (body.signed_at != null && body.signed_at !== "") {
      const d = new Date(String(body.signed_at));
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Neplatné datum podpisu." }, { status: 400 });
      }
      signedAt = d;
    }
    await prisma.contracts.update({
      where: { id: contractId },
      data: {
        approval_status: ContractApprovalStatus.SIGNED,
        signed_at: signedAt,
        updated_at: new Date(),
      },
    });
    await logContractAudit({
      userId,
      action: "transition:sign",
      tableName: "contracts",
      recordId: contractId,
      newValues: {
        approval_status: ContractApprovalStatus.SIGNED,
        signed_at: signedAt.toISOString(),
      },
    });
    return NextResponse.json({ success: true, message: "Podpis byl zaznamenán." });
  }

  if (action === "archive") {
    if (contract.approval_status !== ContractApprovalStatus.SIGNED) {
      return NextResponse.json(
        { error: "Archivovat lze jen podepsanou smlouvu." },
        { status: 400 }
      );
    }
    await prisma.contracts.update({
      where: { id: contractId },
      data: {
        approval_status: ContractApprovalStatus.ARCHIVED,
        updated_at: new Date(),
      },
    });
    await logContractAudit({
      userId,
      action: "transition:archive",
      tableName: "contracts",
      recordId: contractId,
      newValues: { approval_status: ContractApprovalStatus.ARCHIVED },
    });
    return NextResponse.json({ success: true, message: "Smlouva byla archivována." });
  }

  return NextResponse.json(
    { error: "Neplatná akce (begin_signature, sign, archive)." },
    { status: 400 }
  );
}
