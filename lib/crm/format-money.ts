export function parseMoneyInput(input: string): string {
  let cleaned = input.replace(/\s/g, "").replace(/[^\d,.]/g, "");
  const firstSep = cleaned.search(/[.,]/);
  if (firstSep >= 0) {
    const before = cleaned.slice(0, firstSep);
    const after = cleaned.slice(firstSep + 1).replace(/[.,]/g, "");
    cleaned = `${before},${after}`;
  }
  return cleaned;
}

export function formatMoneyInput(raw: string): string {
  if (!raw) return "";
  const [intPart = "", decPart] = raw.split(",");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decPart !== undefined ? `${grouped},${decPart}` : grouped;
}

export function moneyInputToNumber(raw: string): number {
  if (!raw) return 0;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
