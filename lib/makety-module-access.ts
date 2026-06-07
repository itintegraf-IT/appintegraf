import {
  hasModuleAccess,
  hasExplicitMaketyZadavatelGrafikaRole,
  hasExplicitMaketyZadavatelMaketaRole,
  hasMaketyGrafikaAccess,
  hasMaketyVyrobaAccess,
  isAdmin,
} from "@/lib/auth-utils";

/** Přístup k modulu Makety a grafika (čtení / admin / výroba / grafika / zadavatel / globální admin). */
export async function canAccessMaketyModule(userId: number): Promise<boolean> {
  return (
    (await isAdmin(userId)) ||
    (await hasModuleAccess(userId, "makety", "read")) ||
    (await hasModuleAccess(userId, "makety", "admin")) ||
    (await hasMaketyVyrobaAccess(userId)) ||
    (await hasMaketyGrafikaAccess(userId)) ||
    (await hasExplicitMaketyZadavatelMaketaRole(userId)) ||
    (await hasExplicitMaketyZadavatelGrafikaRole(userId))
  );
}
