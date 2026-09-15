/** Parsuje body.notify — chybí / ne-true = false (neposílat). */
export function parseNotifyFlag(raw: unknown): boolean {
  return raw === true || raw === 1 || raw === "1" || raw === "true";
}
