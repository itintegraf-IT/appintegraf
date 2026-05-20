import { normalizeModuleIds } from "@/lib/backup/module-registry";
import type { BackupModuleId } from "@/lib/backup/types";

export type ResolveBackupRestoreModulesResult =
  | { ok: true; effective: BackupModuleId[] }
  | { ok: false; error: string };

/**
 * Obnova smí mazat/importovat jen moduly, které jsou v manifestu zálohy.
 * Pokud uživatel zaškrtne modul, který v archivu není, obnova se odmítne (ochrana před prázdnými tabulkami).
 */
export function resolveBackupRestoreModules(
  requestedModules: BackupModuleId[],
  manifestModules: BackupModuleId[]
): ResolveBackupRestoreModulesResult {
  const requested = normalizeModuleIds(requestedModules);
  const inBackup = normalizeModuleIds(manifestModules);

  if (inBackup.length === 0) {
    return {
      ok: false,
      error: "Manifest zálohy neobsahuje žádné platné moduly.",
    };
  }

  const notInBackup = requested.filter((m) => !inBackup.includes(m));
  if (notInBackup.length > 0) {
    return {
      ok: false,
      error:
        `Následující vybrané moduly nejsou v této záloze: ${notInBackup.join(", ")}. ` +
        `V manifestu ZIP jsou pouze: ${inBackup.join(", ")}. ` +
        `Odškrtněte moduly, které záloha neobsahuje, nebo použijte jiný soubor ZIP.`,
    };
  }

  return { ok: true, effective: requested };
}
