import type { Prisma } from "@prisma/client";
import { ContractApprovalStatus } from "@/lib/contracts/workflow-status";

export type ContractListFilters = {
  approvalStatus?: string;
  contractTypeId?: number;
  /** Fulltext v názvu, čísle, stranách, popisu */
  search?: string;
  /** Končí platnost nebo expirace do N dnů (včetně dneška) */
  expiringWithinDays?: number;
};

/**
 * Sestaví podmínku pro seznam / export smluv.
 */
export function buildContractsWhere(f: ContractListFilters): Prisma.contractsWhereInput {
  const and: Prisma.contractsWhereInput[] = [];

  if (f.approvalStatus?.trim()) {
    and.push({ approval_status: f.approvalStatus.trim() });
  }

  if (f.contractTypeId != null && Number.isFinite(f.contractTypeId)) {
    and.push({ contract_type_id: f.contractTypeId });
  }

  const q = f.search?.trim();
  if (q) {
    and.push({
      OR: [
        { title: { contains: q } },
        { contract_number: { contains: q } },
        { party_company: { contains: q } },
        { party_contact: { contains: q } },
        { description: { contains: q } },
      ],
    });
  }

  if (f.expiringWithinDays != null && f.expiringWithinDays > 0) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + f.expiringWithinDays);

    and.push({
      approval_status: {
        notIn: [ContractApprovalStatus.ARCHIVED, ContractApprovalStatus.REJECTED],
      },
    });
    and.push({
      OR: [
        { valid_until: { gte: start, lte: end } },
        { expires_at: { gte: start, lte: end } },
      ],
    });
  }

  if (and.length === 0) return {};
  return { AND: and };
}

/** Parsování query z API i ze stránky `/contracts`. */
export function parseContractListSearchParams(
  searchParams: URLSearchParams
): ContractListFilters {
  const status =
    searchParams.get("approval_status") ?? searchParams.get("status") ?? undefined;
  const typeRaw =
    searchParams.get("contract_type_id") ?? searchParams.get("type") ?? undefined;
  const contractTypeId = typeRaw ? parseInt(typeRaw, 10) : undefined;
  const q = searchParams.get("q") ?? undefined;
  const exp = searchParams.get("expiring");
  let expiringWithinDays: number | undefined;
  if (exp === "30" || exp === "60" || exp === "90") {
    expiringWithinDays = parseInt(exp, 10);
  }

  return {
    approvalStatus: status ?? undefined,
    contractTypeId:
      contractTypeId != null && !Number.isNaN(contractTypeId)
        ? contractTypeId
        : undefined,
    search: q ?? undefined,
    expiringWithinDays,
  };
}
