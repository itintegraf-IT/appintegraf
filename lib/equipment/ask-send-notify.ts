/**
 * Vždy se zeptá, zda odeslat notifikaci (in-app + e-mail).
 * OK = true (odeslat), Storno = false (neodeslat) — akce samotná pokračuje.
 */
export function askSendEquipmentMovementNotify(): boolean {
  return window.confirm(
    "Odeslat notifikaci držiteli a účtárně (aplikace + e-mail)?\n\nOK = odeslat\nStorno = neodeslat"
  );
}
