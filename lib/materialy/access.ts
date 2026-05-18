import { hasModuleAccess } from "@/lib/auth-utils";

export async function canReadMaterialCatalog(userId: number): Promise<boolean> {
  if (await hasModuleAccess(userId, "materialy", "read")) return true;
  if (await hasModuleAccess(userId, "iml", "read")) return true;
  return false;
}

export async function canWriteMaterialCatalog(userId: number): Promise<boolean> {
  return hasModuleAccess(userId, "materialy", "write");
}
