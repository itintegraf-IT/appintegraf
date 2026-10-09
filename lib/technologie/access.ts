import { hasModuleAccess } from "@/lib/auth-utils";

export async function canReadTechnologie(userId: number): Promise<boolean> {
  return hasModuleAccess(userId, "technologie", "read");
}

export async function canWriteTechnologie(userId: number): Promise<boolean> {
  return hasModuleAccess(userId, "technologie", "write");
}
