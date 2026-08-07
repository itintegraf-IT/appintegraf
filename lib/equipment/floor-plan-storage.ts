import { access, mkdir, writeFile } from "fs/promises";
import path from "path";

/** Relativní webová cesta `/uploads/...` → absolutní disková cesta pod `public/`. */
export function floorPlanImageDiskPath(imagePath: string): string | null {
  const normalized = imagePath.replace(/\\/g, "/").trim();
  if (!normalized.startsWith("/uploads/equipment/floor-plans/")) return null;
  if (normalized.includes("..")) return null;
  const relative = normalized.replace(/^\//, "");
  return path.join(process.cwd(), "public", ...relative.split("/"));
}

export function floorPlanImageContentType(imagePath: string): string {
  const lower = imagePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export function floorPlanUploadDir(planId: number): string {
  return path.join(
    process.cwd(),
    "public",
    "uploads",
    "equipment",
    "floor-plans",
    String(planId)
  );
}

export function floorPlanWebPath(planId: number, fileName: string): string {
  return `/uploads/equipment/floor-plans/${planId}/${fileName}`;
}

/** Zapíše soubor a ověří, že je na disku čitelný. */
export async function writeFloorPlanImageFile(
  planId: number,
  fileName: string,
  data: Buffer
): Promise<{ image_path: string; diskPath: string }> {
  const uploadDir = floorPlanUploadDir(planId);
  await mkdir(uploadDir, { recursive: true });
  const diskPath = path.join(uploadDir, fileName);
  await writeFile(diskPath, data);
  try {
    await access(diskPath);
  } catch {
    throw new Error(
      `Soubor se nepodařilo zapsat na disk (${diskPath}). Zkontrolujte práva zápisu do public/uploads.`
    );
  }
  return { image_path: floorPlanWebPath(planId, fileName), diskPath };
}
