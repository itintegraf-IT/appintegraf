export const MATERIAL_TYPES = ["text", "video", "presentation"] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

export function parseMaterialType(raw: unknown): MaterialType {
  const value = String(raw ?? "text").trim().toLowerCase();
  if (MATERIAL_TYPES.includes(value as MaterialType)) {
    return value as MaterialType;
  }
  return "text";
}

export function materialTypeLabel(type: MaterialType): string {
  switch (type) {
    case "video":
      return "Video";
    case "presentation":
      return "Prezentace";
    default:
      return "Text";
  }
}
