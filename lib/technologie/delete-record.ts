import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { TECHNOLOGIE_MODULE } from "./constants";

export type DeleteTechnologieResult =
  | { ok: true }
  | { ok: false; status: 404 | 500; error: string };

async function unlinkUploadFile(filePath: string): Promise<void> {
  if (!filePath.startsWith("/uploads/")) return;
  const diskPath = path.join(process.cwd(), "public", filePath.replace(/^\//, ""));
  try {
    await unlink(diskPath);
  } catch {
    // soubor už nemusí existovat
  }
}

/** Smaže záznam rozkresu včetně souborů na disku a v file_uploads. */
export async function deleteTechnologieRecord(
  technologieId: number
): Promise<DeleteTechnologieResult> {
  const existing = await prisma.technologie.findUnique({ where: { id: technologieId } });
  if (!existing) {
    return { ok: false, status: 404, error: "Záznam nenalezen" };
  }

  const files = await prisma.file_uploads.findMany({
    where: { module: TECHNOLOGIE_MODULE, record_id: technologieId },
    select: { id: true, file_path: true },
  });

  for (const f of files) {
    await unlinkUploadFile(f.file_path);
    await prisma.file_uploads.delete({ where: { id: f.id } });
  }

  await prisma.technologie.delete({ where: { id: technologieId } });
  return { ok: true };
}
