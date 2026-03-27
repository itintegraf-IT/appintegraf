import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ContractApprovalStatus } from "@/lib/contracts/workflow-status";
import { logContractAudit } from "@/lib/contracts/audit";
import { parseContractPayload } from "@/lib/contracts/parse-payload";
import {
  parseContractListSearchParams,
  buildContractsWhere,
} from "@/lib/contracts/list-where";

const listInclude = {
  contract_types: { select: { id: true, name: true, code: true } },
  users_created_by: { select: { id: true, first_name: true, last_name: true } },
  users_responsible: { select: { id: true, first_name: true, last_name: true } },
} as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limitRaw = searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitRaw ?? "50", 10) || 50, 1), 200);

  const filters = parseContractListSearchParams(searchParams);
  const where = buildContractsWhere(filters);

  const contracts = await prisma.contracts.findMany({
    where,
    orderBy: { updated_at: "desc" },
    take: limit,
    include: listInclude,
  });

  return NextResponse.json({ contracts });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Neplatné JSON tělo" }, { status: 400 });
  }

  const payload = parseContractPayload(body);
  if (!payload.title) {
    return NextResponse.json({ error: "Vyplňte název smlouvy" }, { status: 400 });
  }
  if (payload.contract_type_id === undefined || payload.contract_type_id === null) {
    return NextResponse.json({ error: "Vyberte typ smlouvy" }, { status: 400 });
  }

  const typeOk = await prisma.contract_types.findFirst({
    where: { id: payload.contract_type_id, is_active: true },
    select: { id: true },
  });
  if (!typeOk) {
    return NextResponse.json({ error: "Neplatný nebo neaktivní typ smlouvy" }, { status: 400 });
  }

  if (body.value_amount != null && body.value_amount !== "" && payload.value_amount === undefined) {
    return NextResponse.json({ error: "Neplatná hodnota smlouvy (číslo)" }, { status: 400 });
  }

  const userId = parseInt(session.user.id, 10);

  const created = await prisma.contracts.create({
    data: {
      title: payload.title,
      contract_number: payload.contract_number ?? null,
      party_company: payload.party_company ?? null,
      party_contact: payload.party_contact ?? null,
      contract_type_id: payload.contract_type_id,
      description: payload.description ?? null,
      approval_status: ContractApprovalStatus.DRAFT,
      value_amount: payload.value_amount ?? null,
      value_currency: payload.value_currency ?? "CZK",
      effective_from: payload.effective_from ?? null,
      valid_until: payload.valid_until ?? null,
      expires_at: payload.expires_at ?? null,
      created_by: userId,
      responsible_user_id:
        payload.responsible_user_id === undefined ? null : payload.responsible_user_id,
      department_id: payload.department_id === undefined ? null : payload.department_id,
    },
    include: listInclude,
  });

  await logContractAudit({
    userId,
    action: "create:contracts",
    tableName: "contracts",
    recordId: created.id,
    newValues: {
      title: created.title,
      contract_type_id: created.contract_type_id,
      approval_status: created.approval_status,
    },
  });

  return NextResponse.json({ contract: created });
}
