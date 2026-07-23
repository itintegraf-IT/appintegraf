import { getUserRoles, hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";

export type AccessibleCategories =
  | { mode: "all" }
  | { mode: "ids"; ids: number[] }
  | { mode: "none" };

async function getResponsibleCategoryIds(userId: number): Promise<number[]> {
  const rows = await prisma.equipment_categories.findMany({
    where: { responsible_user_id: userId, is_active: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function getViewerCategoryIds(userId: number): Promise<number[]> {
  const rows = await prisma.equipment_user_category_access.findMany({
    where: { user_id: userId },
    select: { category_id: true },
  });
  return rows.map((r) => r.category_id);
}

export async function canAdministerEquipment(userId: number): Promise<boolean> {
  if (await isAdmin(userId)) return true;
  return hasModuleAccess(userId, "equipment", "admin");
}

export async function isCategoryResponsible(userId: number, categoryId: number): Promise<boolean> {
  const row = await prisma.equipment_categories.findFirst({
    where: { id: categoryId, responsible_user_id: userId },
    select: { id: true },
  });
  return !!row;
}

/**
 * Kategorie přístupné uživateli pro čtení.
 * - admin / equipment:admin / equipment:write / equipment:read bez omezení → all
 * - equipment:read + záznamy v access → jen ty skupiny (+ zodpovědné)
 * - zodpovědný / nahlížení bez module read → jen jejich ID
 */
export async function getAccessibleCategories(userId: number): Promise<AccessibleCategories> {
  if (await isAdmin(userId)) return { mode: "all" };
  if (await hasModuleAccess(userId, "equipment", "admin")) return { mode: "all" };
  if (await hasModuleAccess(userId, "equipment", "write")) return { mode: "all" };

  const hasRead = await hasModuleAccess(userId, "equipment", "read");
  const viewerIds = await getViewerCategoryIds(userId);
  const responsibleIds = await getResponsibleCategoryIds(userId);

  if (hasRead && viewerIds.length === 0) {
    // zpětná kompatibilita: read bez omezení = vše
    return { mode: "all" };
  }

  const ids = [...new Set([...viewerIds, ...responsibleIds])];
  if (ids.length === 0) {
    if (hasRead) return { mode: "all" };
    return { mode: "none" };
  }
  return { mode: "ids", ids };
}

export async function getAccessibleCategoryIds(userId: number): Promise<number[] | null> {
  const access = await getAccessibleCategories(userId);
  if (access.mode === "all") return null;
  if (access.mode === "none") return [];
  return access.ids;
}

export async function canReadEquipment(userId: number, categoryId?: number): Promise<boolean> {
  if (await isAdmin(userId)) return true;
  if (await hasModuleAccess(userId, "equipment", "admin")) return true;
  if (await hasModuleAccess(userId, "equipment", "write")) return true;

  if (categoryId != null && (await isCategoryResponsible(userId, categoryId))) return true;

  const access = await getAccessibleCategories(userId);
  if (access.mode === "all") return true;
  if (access.mode === "none") return false;
  if (categoryId == null) return access.ids.length > 0;
  return access.ids.includes(categoryId);
}

export async function canWriteEquipment(userId: number, categoryId?: number): Promise<boolean> {
  if (await isAdmin(userId)) return true;
  if (await hasModuleAccess(userId, "equipment", "admin")) return true;
  if (await hasModuleAccess(userId, "equipment", "write")) return true;

  if (categoryId != null) {
    return isCategoryResponsible(userId, categoryId);
  }

  const responsible = await getResponsibleCategoryIds(userId);
  return responsible.length > 0;
}

export async function categoryWhereForUser(userId: number): Promise<{ category_id?: { in: number[] } } | { id: { in: never[] } } | Record<string, never>> {
  const ids = await getAccessibleCategoryIds(userId);
  if (ids === null) return {};
  if (ids.length === 0) return { id: { in: [] as never[] } };
  return { category_id: { in: ids } };
}

export async function hasAnyEquipmentAccess(userId: number): Promise<boolean> {
  if (await canReadEquipment(userId)) return true;
  const roles = await getUserRoles(userId);
  return roles.some((r) => r.name?.toLowerCase() === "admin");
}
