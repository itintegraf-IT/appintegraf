import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { unlink } from "fs/promises";
import path from "path";
import { canWriteMaterialCatalog } from "@/lib/materialy/access";
import { logMaterialyAuditSafe } from "@/lib/materialy/audit";
import { MATERIALY_UPLOAD_MODULE } from "@/lib/materialy/upload";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteMaterialCatalog(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const materialId = parseInt((await params).id, 10);
  const fileId = parseInt((await params).fileId, 10);
  if (Number.isNaN(materialId) || Number.isNaN(fileId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const material = await prisma.materials.findUnique({ where: { id: materialId }, select: { id: true } });
  if (!material) {
    return NextResponse.json({ error: "Materiál nenalezen" }, { status: 404 });
  }

  const fileRow = await prisma.file_uploads.findFirst({
    where: {
      id: fileId,
      module: MATERIALY_UPLOAD_MODULE,
      record_id: materialId,
    },
  });

  if (!fileRow) {
    return NextResponse.json({ error: "Soubor nenalezen" }, { status: 404 });
  }

  const abs = path.join(process.cwd(), "public", fileRow.file_path.replace(/^\//, ""));
  try {
    await unlink(abs);
  } catch {
    // soubor už chybí na disku
  }

  await prisma.file_uploads.delete({ where: { id: fileId } });

  await logMaterialyAuditSafe({
    userId,
    action: "delete:material_file",
    tableName: "file_uploads",
    recordId: fileId,
    oldValues: { original_filename: fileRow.original_filename, material_id: materialId },
  });

  return NextResponse.json({ success: true });
}
