export const VYKRESY_MODULE = "vykresy" as const;

export const VYKRESY_MAX_BYTES = 50 * 1024 * 1024;

export const VYKRESY_DOCUMENT_KINDS = ["model_3d", "cad", "pdf", "other"] as const;
export type VykresyDocumentKind = (typeof VYKRESY_DOCUMENT_KINDS)[number];

export const VYKRESY_DOCUMENT_KIND_LABELS: Record<VykresyDocumentKind, string> = {
  model_3d: "3D model",
  cad: "CAD výkres",
  pdf: "PDF",
  other: "Jiné",
};

/** Povolené přípony (lowercase, s tečkou). */
export const VYKRESY_ALLOWED_EXTENSIONS = new Set([
  ".stl",
  ".3mf",
  ".obj",
  ".step",
  ".stp",
  ".iges",
  ".igs",
  ".dwg",
  ".dxf",
  ".pdf",
]);

export function isVykresyDocumentKind(value: string): value is VykresyDocumentKind {
  return (VYKRESY_DOCUMENT_KINDS as readonly string[]).includes(value);
}

export function suggestDocumentKindFromExt(ext: string): VykresyDocumentKind {
  const e = ext.toLowerCase();
  if ([".stl", ".3mf", ".obj"].includes(e)) return "model_3d";
  if ([".step", ".stp", ".iges", ".igs", ".dwg", ".dxf"].includes(e)) return "cad";
  if (e === ".pdf") return "pdf";
  return "other";
}
