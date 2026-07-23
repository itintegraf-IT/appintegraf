/** Formát pořizovací ceny majetku pro zobrazení v UI. */
export function formatEquipmentPrice(value: unknown): string {
  if (value == null) return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(n)} Kč`;
}
