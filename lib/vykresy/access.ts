import { hasModuleAccess } from "@/lib/auth-utils";

export async function canReadVykresy(userId: number): Promise<boolean> {
  return hasModuleAccess(userId, "vykresy", "read");
}

export async function canWriteVykresy(userId: number): Promise<boolean> {
  return hasModuleAccess(userId, "vykresy", "write");
}
