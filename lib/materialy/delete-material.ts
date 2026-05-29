import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { logMaterialyAuditSafe } from "@/lib/materialy/audit";
import { MATERIALY_UPLOAD_MODULE } from "@/lib/materialy/upload";

export async function countMaterialProductLinks(materialId: number): Promise<number> {
  return prisma.iml_products.count({
    where: {
      OR: [
        { foil_material_id: materialId },
        { color_material_id: materialId },
        { paper_material_id: materialId },
        { lacquer_material_id: materialId },
      ],
    },
  });
}

export type PermanentDeleteResult =
  | { ok: true }
  | { ok: false; status: 404 | 409 | 500; error: string };

/** Trvale odstraní materiál z databáze včetně nahraných dokumentů. */
export async function permanentDeleteMaterial(
  materialId: number,
  userId: number
): Promise<PermanentDeleteResult> {
  const existing = await prisma.materials.findUnique({ where: { id: materialId } });
  if (!existing) {
    return { ok: false, status: 404, error: "Materiál nenalezen" };
  }

  const links = await countMaterialProductLinks(materialId);
  if (links > 0) {
    return {
      ok: false,
      status: 409,
      error: `Materiál je navázaný na ${links} produkt(ů) IML. Nejprve odeberte vazbu u produktů, nebo použijte „Skrýt“.`,
    };
  }

  const files = await prisma.file_uploads.findMany({
    where: { module: MATERIALY_UPLOAD_MODULE, record_id: materialId },
    select: { id: true, file_path: true },
  });

  for (const f of files) {
    if (f.file_path.startsWith("/uploads/")) {
      const diskPath = path.join(process.cwd(), "public", f.file_path.replace(/^\//, ""));
      try {
        await unlink(diskPath);
      } catch {
        // soubor už nemusí existovat
      }
    }
    await prisma.file_uploads.delete({ where: { id: f.id } });
  }

  await prisma.materials.delete({ where: { id: materialId } });

  await logMaterialyAuditSafe({
    userId,
    action: "delete",
    tableName: "materials",
    recordId: materialId,
    oldValues: { name: existing.name, category_code: existing.category_code },
  });

  return { ok: true };
}
