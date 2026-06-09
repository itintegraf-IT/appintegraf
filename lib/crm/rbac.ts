import type { crm_parent_type } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { CrmRole } from "./permissions";
import type { CrmSessionUser } from "./session";

export type Role = CrmRole;

interface Owned {
  owner_id: number | null;
}

export function canViewCompany(_user: CrmSessionUser, _company: Owned): boolean {
  return true;
}

export function canViewDeal(_user: CrmSessionUser, _deal: Owned): boolean {
  return true;
}

export function canEditCompany(user: CrmSessionUser, company: Owned): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "VIEWER") return false;
  return company.owner_id === user.id;
}

export function canEditDeal(user: CrmSessionUser, deal: Owned): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "VIEWER") return false;
  return deal.owner_id === user.id;
}

export function requireRole(user: CrmSessionUser, allowed: CrmRole[]): void {
  if (!allowed.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }
}

export async function canAccessParent(
  user: CrmSessionUser,
  parentType: crm_parent_type,
  parentId: string,
  mode: "read" | "write" = "read"
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (user.role === "VIEWER") return mode === "read";

  if (parentType === "COMPANY") {
    const c = await prisma.crm_companies.findUnique({
      where: { id: parentId },
      select: { owner_id: true },
    });
    if (!c) return false;
    return c.owner_id === null || c.owner_id === user.id;
  }

  if (parentType === "CONTACT") {
    const c = await prisma.crm_contacts.findUnique({
      where: { id: parentId },
      select: { company: { select: { owner_id: true } } },
    });
    if (!c) return false;
    return c.company.owner_id === null || c.company.owner_id === user.id;
  }

  if (parentType === "DEAL") {
    const d = await prisma.crm_deals.findUnique({
      where: { id: parentId },
      select: { owner_id: true },
    });
    if (!d) return false;
    return d.owner_id === user.id;
  }

  return false;
}
