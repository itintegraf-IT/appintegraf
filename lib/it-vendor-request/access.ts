import { isAdmin } from "@/lib/auth-utils";
import { isInDepartment } from "@/lib/equipment-departments";

/** Správa IT požadavků externích dodavatelů – IT oddělení nebo admin. */
export async function canManageItVendorRequests(userId: number): Promise<boolean> {
  if (await isAdmin(userId)) return true;
  return isInDepartment(userId, "IT");
}
