/** Typ přílohy u makety/grafiky (`file_uploads.document_type`). */
export const MAKETY_FILE_KINDS = ["softproof", "print_data", "other"] as const;
export type MaketyFileKind = (typeof MAKETY_FILE_KINDS)[number];

export function isMaketyFileKind(value: string): value is MaketyFileKind {
  return MAKETY_FILE_KINDS.includes(value as MaketyFileKind);
}

export function parseMaketyFileKind(
  raw: string | null | undefined
): MaketyFileKind | null {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  return isMaketyFileKind(v) ? v : null;
}

/** Vyžaduje platný typ; při neplatném vrátí chybu. */
export function requireMaketyFileKind(
  raw: string | null | undefined
): { ok: true; kind: MaketyFileKind } | { ok: false; error: string } {
  const kind = parseMaketyFileKind(raw);
  if (!kind) {
    return {
      ok: false,
      error: "Vyberte typ souboru: softproof, tisková data nebo jiné",
    };
  }
  return { ok: true, kind };
}

export function maketyFileKindLabel(kind: string | null | undefined): string {
  switch (kind) {
    case "softproof":
      return "Softproof (náhled)";
    case "print_data":
      return "Tisková data";
    case "other":
      return "Jiné";
    default:
      return "Bez typu";
  }
}

export function maketyFileKindBadgeClass(kind: string | null | undefined): string {
  switch (kind) {
    case "softproof":
      return "bg-sky-100 text-sky-800";
    case "print_data":
      return "bg-violet-100 text-violet-800";
    case "other":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-amber-50 text-amber-800";
  }
}
