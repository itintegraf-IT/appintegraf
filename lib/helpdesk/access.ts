import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { isInDepartment } from "@/lib/equipment-departments";

export async function canManageHelpdesk(userId: number): Promise<boolean> {
  const admin = await isAdmin(userId);
  if (admin) return true;
  const [inIT, canWrite] = await Promise.all([
    isInDepartment(userId, "IT"),
    hasModuleAccess(userId, "equipment", "write"),
  ]);
  return inIT && canWrite;
}
