import {
  normalizeMaketyWorkType,
  type MaketyWorkType,
} from "@/lib/makety-work-type";

function trimOrNull(value: string | null | undefined): string | null {
  const s = value?.trim();
  return s ? s : null;
}

export type MaketaEmailSubjectRefInput = {
  maketaId: number;
  workType?: MaketyWorkType | string | null;
  orderNumber?: string | null;
  jobNumber?: string | null;
  labelCode?: string | null;
};

/**
 * Jednoznačná identifikace zakázky pro subject interních mailů.
 * Formát: `{zakázka} / {etiketa} (#grafika|maketa {id})` — prázdné části se vynechají.
 */
export function buildMaketaEmailSubjectRef(input: MaketaEmailSubjectRefInput): string {
  const workType = normalizeMaketyWorkType(input.workType);
  const zak = trimOrNull(input.jobNumber) ?? trimOrNull(input.orderNumber);
  const label = trimOrNull(input.labelCode);
  const idTag = workType === "grafika" ? `#grafika ${input.maketaId}` : `#maketa ${input.maketaId}`;

  const leftParts: string[] = [];
  if (zak) leftParts.push(zak);
  if (label) leftParts.push(label);
  const left = leftParts.join(" / ");

  return left ? `${left} (${idTag})` : idTag;
}

export function buildMaketaEmailSubject(title: string, ref: string): string {
  const t = title.trim() || "Notifikace";
  const r = ref.trim();
  if (!r) return `${t} – INTEGRAF`;
  return `${t} · ${r} – INTEGRAF`;
}
