import { writeFloorPlanImageFile } from "@/lib/equipment/floor-plan-storage";
import { verifyEquipmentUpload } from "@/lib/equipment/upload-verify";

export const FLOOR_PLAN_MAX_BYTES = 25 * 1024 * 1024;

/** Chyba s hláškou pro uživatele; ostatní chyby patří jen do logu serveru. */
export class FloorPlanUploadError extends Error {}

/**
 * Ověří nahraný půdorys podle obsahu, PDF převede na JPEG a uloží na disk.
 * Přípona souboru se určuje z obsahu, ne z názvu nebo typu od prohlížeče.
 */
export async function saveFloorPlanUpload(
  planId: number,
  file: File
): Promise<{ image_path: string; image_width: number | null; image_height: number | null }> {
  if (file.size > FLOOR_PLAN_MAX_BYTES) {
    throw new FloorPlanUploadError("Soubor je větší než 25 MB.");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const verified = verifyEquipmentUpload(buf, file.type, "floor_plan");
  if (!verified.ok) throw new FloorPlanUploadError(verified.error);

  let outBuf: Buffer = buf;
  let ext = verified.ext;
  if (verified.mime === "application/pdf") {
    const { pdfBufferToJpeg } = await import("@/lib/iml-product-preview-pdf-server");
    const jpeg = await pdfBufferToJpeg(buf, { maxSide: 2800, jpegQuality: 0.92 });
    if (!jpeg) {
      console.error("floor plan: převod PDF na obrázek selhal (na serveru ověřte npm run verify:canvas)");
      throw new FloorPlanUploadError("PDF se nepodařilo převést na obrázek. Nahrajte PNG nebo JPG.");
    }
    outBuf = jpeg;
    ext = ".jpg";
  }
  if (outBuf.length > FLOOR_PLAN_MAX_BYTES) {
    throw new FloorPlanUploadError("Soubor je větší než 25 MB.");
  }

  let width: number | null = null;
  let height: number | null = null;
  try {
    const canvasMod = await import("@napi-rs/canvas");
    const img = await canvasMod.loadImage(outBuf);
    width = img.width;
    height = img.height;
  } catch {
    /* rozměry jsou volitelné */
  }

  const saved = await writeFloorPlanImageFile(planId, `plan_${Date.now()}${ext}`, outBuf);
  return { image_path: saved.image_path, image_width: width, image_height: height };
}
