import { hasModuleAccess, hasMaketyVyrobaAccess } from "@/lib/auth-utils";

/** Přístup k modulu Makety (čtení / výroba). */
export async function canAccessMaketyModule(userId: number): Promise<boolean> {
  return (await hasModuleAccess(userId, "makety", "read")) || (await hasMaketyVyrobaAccess(userId));
}
