/** Kanonická data jedné paletovky (jeden blok na stránce). */

export const PALETOVKA_LAYOUT_VARIANTS = ["single", "dual_horizontal", "stacked"] as const;
export type PaletovkaLayoutVariant = (typeof PALETOVKA_LAYOUT_VARIANTS)[number];

export const PALETOVKA_STATUSES = ["DRAFT", "PRINTED"] as const;
export type PaletovkaStatus = (typeof PALETOVKA_STATUSES)[number];

export type PaletovkaRowData = {
  mnozstvi: string;
  popis: string;
  cislo: string;
};

export type PaletovkaBlockData = {
  zadavatel: string;
  zakazka: string;
  cisloZakazky: string;
  druh?: string;
  urcenoPro?: string;
  extraLines?: string[];
  nakladLabel: "Náklad" | "Celkem";
  baleniPopis: string;
  jednotkaLabel: "Paleta" | "Krabice";
  radky: PaletovkaRowData[];
};

export type PaletovkaDocumentData = {
  blocks: PaletovkaBlockData[];
};

export type PaletovkaLayoutRegion = {
  key: string;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  fontSize?: number;
  bold?: boolean;
};

export type PaletovkaLayoutBlock = {
  originCol: number;
  originRow: number;
  regions: PaletovkaLayoutRegion[];
};

export type PaletovkaLayoutJson = {
  variant: PaletovkaLayoutVariant;
  blocks: PaletovkaLayoutBlock[];
  pageWidthMm?: number;
  pageHeightMm?: number;
};

export function emptyBlock(partial?: Partial<PaletovkaBlockData>): PaletovkaBlockData {
  return {
    zadavatel: "",
    zakazka: "",
    cisloZakazky: "",
    nakladLabel: "Náklad",
    baleniPopis: "",
    jednotkaLabel: "Paleta",
    radky: [{ mnozstvi: "", popis: "", cislo: "" }],
    ...partial,
  };
}

export function parsePaletovkaDocumentData(raw: unknown): PaletovkaDocumentData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.blocks)) return null;
  const blocks: PaletovkaBlockData[] = [];
  for (const b of o.blocks) {
    if (!b || typeof b !== "object") return null;
    const block = b as Record<string, unknown>;
    const radkyRaw = Array.isArray(block.radky) ? block.radky : [];
    const radky: PaletovkaRowData[] = radkyRaw.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        mnozstvi: String(row.mnozstvi ?? ""),
        popis: String(row.popis ?? ""),
        cislo: String(row.cislo ?? ""),
      };
    });
    if (radky.length === 0) radky.push({ mnozstvi: "", popis: "", cislo: "" });
    blocks.push({
      zadavatel: String(block.zadavatel ?? ""),
      zakazka: String(block.zakazka ?? ""),
      cisloZakazky: String(block.cisloZakazky ?? ""),
      druh: block.druh != null ? String(block.druh) : undefined,
      urcenoPro: block.urcenoPro != null ? String(block.urcenoPro) : undefined,
      extraLines: Array.isArray(block.extraLines)
        ? block.extraLines.map((l) => String(l))
        : undefined,
      nakladLabel: block.nakladLabel === "Celkem" ? "Celkem" : "Náklad",
      baleniPopis: String(block.baleniPopis ?? ""),
      jednotkaLabel: block.jednotkaLabel === "Krabice" ? "Krabice" : "Paleta",
      radky,
    });
  }
  if (blocks.length === 0) return null;
  return { blocks };
}

export function parsePaletovkaLayoutJson(raw: unknown): PaletovkaLayoutJson | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const variant = String(o.variant ?? "single");
  if (!PALETOVKA_LAYOUT_VARIANTS.includes(variant as PaletovkaLayoutVariant)) return null;
  if (!Array.isArray(o.blocks)) return null;
  return {
    variant: variant as PaletovkaLayoutVariant,
    blocks: o.blocks as PaletovkaLayoutBlock[],
    pageWidthMm: o.pageWidthMm != null ? Number(o.pageWidthMm) : 210,
    pageHeightMm: o.pageHeightMm != null ? Number(o.pageHeightMm) : 297,
  };
}
