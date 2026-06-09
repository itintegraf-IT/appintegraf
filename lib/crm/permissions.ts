import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";

export type CrmRole = "ADMIN" | "SALES" | "VIEWER";

export type CrmAccess = {
  canRead: boolean;
  canWrite: boolean;
  canAdmin: boolean;
};

export async function getCrmAccess(userId: number): Promise<CrmAccess> {
  const admin = await isAdmin(userId);
  const canRead = admin || (await hasModuleAccess(userId, "crm", "read"));
  const canWrite = admin || (await hasModuleAccess(userId, "crm", "write"));
  const canAdmin = admin || (await hasModuleAccess(userId, "crm", "admin"));
  return { canRead, canWrite, canAdmin };
}

export async function getCrmRole(userId: number): Promise<CrmRole | null> {
  const { canRead, canWrite, canAdmin } = await getCrmAccess(userId);
  if (!canRead) return null;
  if (canAdmin) return "ADMIN";
  if (canWrite) return "SALES";
  return "VIEWER";
}

export async function requireCrmAccess(
  userId: number,
  level: "read" | "write" | "admin" = "read"
): Promise<CrmAccess> {
  const access = await getCrmAccess(userId);
  if (level === "read" && !access.canRead) throw new Error("NO_CRM_READ");
  if (level === "write" && !access.canWrite) throw new Error("NO_CRM_WRITE");
  if (level === "admin" && !access.canAdmin) throw new Error("NO_CRM_ADMIN");
  return access;
}
