import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";
import { ContractApprovalStatus } from "@/lib/contracts/workflow-status";
import { logContractAudit } from "@/lib/contracts/audit";
import { Prisma } from "@prisma/client";

const detailInclude = {
  contract_types: true,
  users_created_by: { select: { id: true, first_name: true, last_name: true, email: true } },
  users_responsible: { select: { id: true, first_name: true, last_name: true, email: true } },
  departments: { select: { id: true, name: true, code: true } },
  contract_approvals: {
    orderBy: { approval_order: "asc" as const },
    include: {
      users: { select: { id: true, first_name: true, last_name: true, email: true } },
    },
  },
} as const;

function canEditContract(
  approvalStatus: string,
  createdBy: number,
  userId: number,
  userIsAdmin: boolean
): boolean {
  if (userIsAdmin) return true;
  if (createdBy !== userId) return false;
  return (
    approvalStatus === ContractApprovalStatus.DRAFT ||
    approvalStatus === ContractApprovalStatus.RETURNED
  );
}

export async function GET(
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

  const contract = await prisma.contracts.findUnique({
    where: { id },
    include: detailInclude,
  });

  if (!contract) {
    return NextResponse.json({ error: "Smlouva nenalezena" }, { status: 404 });
  }

  return NextResponse.json({ contract });
}

export async function PUT(
  req: NextRequest,
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

  const existing = await prisma.contracts.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Smlouva nenalezena" }, { status: 404 });
  }

  if (!canEditContract(existing.approval_status, existing.created_by, userId, userIsAdmin)) {
    return NextResponse.json(
      { error: "Smlouvu v tomto stavu nelze upravovat nebo nejste jejím autorem." },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Neplatné JSON tělo" }, { status: 400 });
  }

  const data: Prisma.contractsUpdateInput = { updated_at: new Date() };

  if (body.title !== undefined) {
    const t = String(body.title).trim();
    if (!t) {
      return NextResponse.json({ error: "Název nesmí být prázdný" }, { status: 400 });
    }
    data.title = t;
  }
  if (body.contract_number !== undefined) {
    data.contract_number =
      body.contract_number === null || body.contract_number === ""
        ? null
        : String(body.contract_number).trim() || null;
  }
  if (body.party_company !== undefined) {
    data.party_company =
      body.party_company === null || body.party_company === ""
        ? null
        : String(body.party_company).trim() || null;
  }
  if (body.party_contact !== undefined) {
    data.party_contact =
      body.party_contact === null || body.party_contact === ""
        ? null
        : String(body.party_contact).trim() || null;
  }
  if (body.description !== undefined) {
    data.description = body.description == null ? null : String(body.description);
  }
  if (body.contract_type_id !== undefined) {
    const tid = parseInt(String(body.contract_type_id), 10);
    if (Number.isNaN(tid)) {
      return NextResponse.json({ error: "Neplatný typ smlouvy" }, { status: 400 });
    }
    const typeOk = await prisma.contract_types.findFirst({
      where: { id: tid, is_active: true },
      select: { id: true },
    });
    if (!typeOk) {
      return NextResponse.json({ error: "Neplatný nebo neaktivní typ smlouvy" }, { status: 400 });
    }
    data.contract_types = { connect: { id: tid } };
  }
  if (body.value_amount !== undefined) {
    if (body.value_amount === null || body.value_amount === "") {
      data.value_amount = null;
    } else {
      try {
        data.value_amount = new Prisma.Decimal(String(body.value_amount));
      } catch {
        return NextResponse.json({ error: "Neplatná hodnota smlouvy" }, { status: 400 });
      }
    }
  }
  if (body.value_currency !== undefined) {
    data.value_currency =
      body.value_currency === null || body.value_currency === ""
        ? null
        : String(body.value_currency).trim().slice(0, 10);
  }
  if (body.effective_from !== undefined) {
    if (body.effective_from === null || body.effective_from === "") {
      data.effective_from = null;
    } else {
      const d = new Date(String(body.effective_from));
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Neplatné datum účinnosti" }, { status: 400 });
      }
      data.effective_from = d;
    }
  }
  if (body.valid_until !== undefined) {
    if (body.valid_until === null || body.valid_until === "") {
      data.valid_until = null;
    } else {
      const d = new Date(String(body.valid_until));
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Neplatné datum platnosti" }, { status: 400 });
      }
      data.valid_until = d;
    }
  }
  if (body.expires_at !== undefined) {
    if (body.expires_at === null || body.expires_at === "") {
      data.expires_at = null;
    } else {
      const d = new Date(String(body.expires_at));
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Neplatné datum expirace" }, { status: 400 });
      }
      data.expires_at = d;
    }
  }
  if (body.responsible_user_id !== undefined) {
    if (body.responsible_user_id === null || body.responsible_user_id === "") {
      data.users_responsible = { disconnect: true };
    } else {
      const rid = parseInt(String(body.responsible_user_id), 10);
      if (Number.isNaN(rid)) {
        return NextResponse.json({ error: "Neplatná odpovědná osoba" }, { status: 400 });
      }
      data.users_responsible = { connect: { id: rid } };
    }
  }
  if (body.department_id !== undefined) {
    if (body.department_id === null || body.department_id === "") {
      data.departments = { disconnect: true };
    } else {
      const did = parseInt(String(body.department_id), 10);
      if (Number.isNaN(did)) {
        return NextResponse.json({ error: "Neplatné oddělení" }, { status: 400 });
      }
      data.departments = { connect: { id: did } };
    }
  }

  const updated = await prisma.contracts.update({
    where: { id },
    data,
    include: detailInclude,
  });

  await logContractAudit({
    userId,
    action: "update:contracts",
    tableName: "contracts",
    recordId: id,
    oldValues: {
      title: existing.title,
      approval_status: existing.approval_status,
    },
    newValues: {
      title: updated.title,
      approval_status: updated.approval_status,
    },
  });

  return NextResponse.json({ contract: updated });
}

export async function DELETE(
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

  const existing = await prisma.contracts.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Smlouva nenalezena" }, { status: 404 });
  }

  if (!canEditContract(existing.approval_status, existing.created_by, userId, userIsAdmin)) {
    return NextResponse.json(
      { error: "Smlouvu v tomto stavu nelze smazat nebo nejste jejím autorem." },
      { status: 403 }
    );
  }

  await prisma.contracts.delete({ where: { id } });

  await logContractAudit({
    userId,
    action: "delete:contracts",
    tableName: "contracts",
    recordId: id,
    oldValues: { title: existing.title },
  });

  return NextResponse.json({ success: true });
}
