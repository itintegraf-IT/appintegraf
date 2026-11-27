import {
  hasMaketySpravaVzorkuAccess,
  hasModuleAccess,
} from "@/lib/auth-utils";

export type ImlProductEditAccess = {
  canRead: boolean;
  canWrite: boolean;
  /** Správa vzorků + čtení IML, bez plného iml:write — smí měnit jen vzor/nátisk. */
  canEditSampleFlagsOnly: boolean;
  /** Smí měnit has_print_sample / has_print_proof (plný zápis nebo jen vzorky). */
  canEditSampleFlags: boolean;
};

/**
 * Oprávnění k editaci polí „Máme vzor min. tisku“ a „Máme nátisk“ na IML produktu.
 * Plný iml:write = vše; správa vzorků bez write = jen tato dvě boolean pole.
 */
export async function getImlProductEditAccess(
  userId: number
): Promise<ImlProductEditAccess> {
  const [canRead, canWrite, hasSpravaVzorku] = await Promise.all([
    hasModuleAccess(userId, "iml", "read"),
    hasModuleAccess(userId, "iml", "write"),
    hasMaketySpravaVzorkuAccess(userId),
  ]);

  const canEditSampleFlagsOnly = !canWrite && canRead && hasSpravaVzorku;
  const canEditSampleFlags = canWrite || canEditSampleFlagsOnly;

  return {
    canRead,
    canWrite,
    canEditSampleFlagsOnly,
    canEditSampleFlags,
  };
}
