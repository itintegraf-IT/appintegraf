import { getModuleAccessItems } from "@/lib/auth-utils";

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
