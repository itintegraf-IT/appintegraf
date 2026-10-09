import { canReadTechnologie, canWriteTechnologie } from "@/lib/technologie/access";
import { canReadVykresy, canWriteVykresy } from "@/lib/vykresy/access";

/** Čtení společného číselníku – stačí přístup k Výkresům nebo Technologii. */
export async function canReadSharedMachines(userId: number): Promise<boolean> {
  if (await canReadVykresy(userId)) return true;
  if (await canReadTechnologie(userId)) return true;
  return false;
}

/** Zápis společného číselníku – write u Výkresů nebo Technologie. */
export async function canWriteSharedMachines(userId: number): Promise<boolean> {
  if (await canWriteVykresy(userId)) return true;
  if (await canWriteTechnologie(userId)) return true;
  return false;
}
