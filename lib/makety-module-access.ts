import { hasModuleAccess, hasMaketyGrafikaAccess, hasMaketyVyrobaAccess } from "@/lib/auth-utils";

/** Přístup k modulu Makety a grafika (čtení / výroba / grafika). */
export async function canAccessMaketyModule(userId: number): Promise<boolean> {
  return (
    (await hasModuleAccess(userId, "makety", "read")) ||
    (await hasMaketyVyrobaAccess(userId)) ||
    (await hasMaketyGrafikaAccess(userId))
  );
}
