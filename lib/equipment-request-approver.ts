import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { getDepartmentMembers } from "@/lib/equipment-departments";

const VEDENI_DEPARTMENT = "Vedení";

/** Ověří, že uživatel je aktivní člen oddělení Vedení (primární nebo sekundární). */
export async function isVedeniApprover(userId: number): Promise<boolean> {
  const vedeni = await prisma.departments.findFirst({
    where: { name: VEDENI_DEPARTMENT, is_active: true },
    select: { id: true },
  });
  if (!vedeni) return false;

  const approverOk = await prisma.users.findFirst({
    where: {
      id: userId,
      is_active: true,
      OR: [
        { department_id: vedeni.id },
        { user_secondary_departments: { some: { department_id: vedeni.id } } },
      ],
    },
    select: { id: true },
  });
  return !!approverOk;
}

/** Vrátí chybovou hlášku, pokud schvalovatel není platný; jinak null. */
export async function validateVedeniApprover(
  approvalTo: number
): Promise<string | null> {
  const vedeni = await prisma.departments.findFirst({
    where: { name: VEDENI_DEPARTMENT, is_active: true },
    select: { id: true },
  });
  if (!vedeni) {
    return "Oddělení „Vedení“ není v systému nalezeno";
  }

  const approverOk = await prisma.users.findFirst({
    where: {
      id: approvalTo,
      is_active: true,
      OR: [
        { department_id: vedeni.id },
        { user_secondary_departments: { some: { department_id: vedeni.id } } },
      ],
    },
    select: { id: true },
  });
  if (!approverOk) {
    return "Vybraný schvalovatel není členem oddělení Vedení";
  }
  return null;
}

/** IT uživatelé s oprávněním equipment:write pro notifikace při vrácení požadavku. */
export async function getEquipmentITNotifyUserIds(
  extraUserId?: number | null
): Promise<number[]> {
  const itMembers = await getDepartmentMembers("IT");
  const ids = new Set<number>();

  for (const member of itMembers) {
    if (await hasModuleAccess(member.id, "equipment", "write")) {
      ids.add(member.id);
    }
  }
  if (extraUserId) {
    ids.add(extraUserId);
  }
  return [...ids];
}

export const workflowLogUserSelect = {
  id: true,
  first_name: true,
  last_name: true,
} as const;

export const workflowLogInclude = {
  orderBy: { created_at: "asc" as const },
  include: {
    users_actor: { select: workflowLogUserSelect },
    users_from: { select: workflowLogUserSelect },
    users_to: { select: workflowLogUserSelect },
  },
};
