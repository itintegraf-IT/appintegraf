import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { VYKRESY_MODULE } from "./constants";

export type DeleteVykresResult =
  | { ok: true }
  | { ok: false; status: 404 | 500; error: string };

/** Smaže záznam výkresu včetně souborů na disku a v file_uploads. */
export async function deleteVykresRecord(vykresId: number): Promise<DeleteVykresResult> {
  const existing = await prisma.vykresy.findUnique({ where: { id: vykresId } });
  if (!existing) {
    return { ok: false, status: 404, error: "Záznam nenalezen" };
  }

  const files = await prisma.file_uploads.findMany({
    where: { module: VYKRESY_MODULE, record_id: vykresId },
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

  await prisma.vykresy.delete({ where: { id: vykresId } });
  return { ok: true };
}
