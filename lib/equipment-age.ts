/** Kalendářní rozdíl roku a měsíce od data oproti dnešku (stejná logika jako typické evidence v PHP). */

function csYears(n: number): string {
  if (n <= 0) return "";
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return `${n} rok`;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return `${n} roky`;
  return `${n} let`;
}

function csMonths(n: number): string {
  if (n <= 0) return "";
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return `${n} měsíc`;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return `${n} měsíce`;
  return `${n} měsíců`;
}

export function formatEquipmentAge(from: Date, asOf: Date = new Date()): string {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  if (start > end) return "—";

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  if (end.getDate() < start.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years < 0) return "—";

  const parts: string[] = [];
  const yPart = csYears(years);
  if (yPart) parts.push(yPart);
  if (months > 0) parts.push(csMonths(months));
  if (parts.length === 0) return "méně než měsíc";
  return parts.join(" ");
}

export type EquipmentAgeSource = "purchase" | "record";

export function equipmentAgeFromRecord(
  purchaseDate: Date | null | undefined,
  createdAt: Date | null | undefined
): { text: string; source: EquipmentAgeSource | null } {
  if (purchaseDate) {
    return {
      text: formatEquipmentAge(new Date(purchaseDate)),
      source: "purchase",
    };
  }
  if (createdAt) {
    return {
      text: formatEquipmentAge(new Date(createdAt)),
      source: "record",
    };
  }
  return { text: "—", source: null };
}
