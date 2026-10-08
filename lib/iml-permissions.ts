import { getModuleAccessItems, hasModuleAccess } from "@/lib/auth-utils";

/**
 * Supervizor může objednat produkty mimo stav „aktivní“ (viz Fáze 5).
 * Oprávnění: položka `iml.supervisor_override` nebo `iml.admin` v module_access (pole-formát).
 */
export async function hasImlSupervisorOverride(userId: number): Promise<boolean> {
  const items = await getModuleAccessItems(userId);
  return items.some(
    (x) => x === "iml.supervisor_override" || x === "iml.admin" || x === "iml:admin"
  );
}

async function hasImlAdminFlag(userId: number): Promise<boolean> {
  const items = await getModuleAccessItems(userId);
  return items.some((x) => x === "iml.admin" || x === "iml:admin");
}

const FINE_GRAINED = [
  "iml.shapes",
  "iml.tools",
  "iml.impositions",
  "iml.packing",
] as const;

function hasAnyFineGrained(items: string[]): boolean {
  return items.some((x) => (FINE_GRAINED as readonly string[]).includes(x));
}

async function canManageCatalog(
  userId: number,
  flag: (typeof FINE_GRAINED)[number]
): Promise<boolean> {
  if (await hasImlAdminFlag(userId)) return true;
  if (!(await hasModuleAccess(userId, "iml", "write"))) return false;
  const items = await getModuleAccessItems(userId);
  if (hasAnyFineGrained(items)) return items.includes(flag);
  return true;
}

/** Plná správa číselníků tvarů a přiřazení nástrojů (Technologie). */
export async function canManageImlShapes(userId: number): Promise<boolean> {
  return canManageCatalog(userId, "iml.shapes");
}

/** Správa katalogu nástrojů. */
export async function canManageImlTools(userId: number): Promise<boolean> {
  return canManageCatalog(userId, "iml.tools");
}

/** Správa montáží / musterů (Prepress). */
export async function canManageImlImpositions(userId: number): Promise<boolean> {
  return canManageCatalog(userId, "iml.impositions");
}

/** Úprava balicího předpisu na produktu (Expedice). */
export async function canEditImlPacking(userId: number): Promise<boolean> {
  return canManageCatalog(userId, "iml.packing");
}
