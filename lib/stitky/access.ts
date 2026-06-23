import { getUserRoles, hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import {
  hasStitkyMistrFlag,
  hasStitkyTiskarFlag,
  stitkyRolesFromAccessRecord,
} from "@/lib/stitky-module-access-flags";
import { prisma } from "@/lib/db";
import { type StitkyUserRole } from "@/lib/stitky/constants";

async function getMergedModuleAccess(userId: number): Promise<Record<string, string>> {
  const roles = await getUserRoles(userId);
  const merged: Record<string, string> = {};

  for (const role of roles) {
    const raw = role.module_access;
    if (raw == null) continue;
    let decoded: unknown = raw;
    if (typeof raw === "string") {
      try {
        decoded = JSON.parse(raw);
      } catch {
        continue;
      }
    }
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) continue;
    const record = decoded as Record<string, unknown>;
    if (record.all === true) {
      return { stitky: "admin", stitky_tiskar: "1", stitky_mistr: "1" };
    }
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "string") merged[key] = value;
    }
  }

  return merged;
}

export async function getStitkyUserRoles(userId: number): Promise<StitkyUserRole[]> {
  if (await isAdmin(userId)) return ["ZADAVATEL", "MISTER", "TISKAR"];

  const fromAccess = stitkyRolesFromAccessRecord(await getMergedModuleAccess(userId));
  if (fromAccess.length > 0) return fromAccess;

  const rows = await prisma.stitky_user_roles.findMany({
    where: { user_id: userId },
    select: { role: true },
  });
  return rows.map((r) => r.role as StitkyUserRole);
}

export async function hasStitkyRole(userId: number, role: StitkyUserRole): Promise<boolean> {
  if (await isAdmin(userId)) return true;
  const roles = await getStitkyUserRoles(userId);
  return roles.includes(role);
}

export async function canReadStitky(userId: number): Promise<boolean> {
  if (await isAdmin(userId)) return true;
  if (await hasModuleAccess(userId, "stitky", "read")) return true;
  return (await getStitkyUserRoles(userId)).length > 0;
}

export async function canWriteStitkyOrder(userId: number): Promise<boolean> {
  if (await isAdmin(userId)) return true;
  if (await hasModuleAccess(userId, "stitky", "write")) return true;
  return hasStitkyRole(userId, "ZADAVATEL");
}

export async function canSubmitStitky(userId: number): Promise<boolean> {
  return canWriteStitkyOrder(userId);
}

export async function canPrintStitky(userId: number): Promise<boolean> {
  if (await isAdmin(userId)) return true;
  if (await hasModuleAccess(userId, "stitky", "admin")) return true;

  const ma = await getMergedModuleAccess(userId);
  if (hasStitkyTiskarFlag(ma) || hasStitkyMistrFlag(ma)) return true;

  return hasStitkyRole(userId, "TISKAR") || hasStitkyRole(userId, "MISTER");
}

export async function canCompleteStitky(userId: number): Promise<boolean> {
  return canPrintStitky(userId);
}

export async function canAdministerStitky(userId: number): Promise<boolean> {
  if (await isAdmin(userId)) return true;
  return hasModuleAccess(userId, "stitky", "admin");
}

export async function canDeleteStitkyOrder(
  userId: number,
  order: { created_by: number; status: string }
): Promise<boolean> {
  if (order.status === "DONE") return false;
  if (await canAdministerStitky(userId)) return true;
  if (order.created_by !== userId) return false;
  return order.status === "DRAFT";
}
