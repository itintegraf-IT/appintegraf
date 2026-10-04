/** Srozumitelný popis, jak se položka do místnosti dostala (sloupec `source` historie přesunů). */
const LABELS: Record<string, string> = {
  scan: "Sken",
  manual: "Ručně",
  bulk: "Hromadně",
  import: "Z původní evidence",
};

/** Řádek historie z úklidu dat (zařazení podle původní evidence) — nemá protokol přesunu. */
export const TRANSFER_SOURCE_IMPORT = "import";

export function transferSourceLabel(source: string | null | undefined): string {
  return (source && LABELS[source]) || "Jiné";
}
