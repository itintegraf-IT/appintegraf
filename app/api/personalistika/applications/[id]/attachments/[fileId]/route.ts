import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { unlink } from "fs/promises";
import path from "path";
import { logPersonalistikaAudit } from "@/lib/personalistika-audit";

const MODULE = "personalistika";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, MODULE, "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění mazat přílohy." }, { status: 403 });
  }

  const applicationId = parseInt((await params).id, 10);
  const fileId = parseInt((await params).fileId, 10);
  if (!Number.isFinite(applicationId) || !Number.isFinite(fileId)) {
    return NextResponse.json({ error: "Neplatné ID." }, { status: 400 });
  }

  const fileRow = await prisma.file_uploads.findFirst({
    where: { id: fileId, module: MODULE, record_id: applicationId },
  });
  if (!fileRow) return NextResponse.json({ error: "Soubor nebyl nalezen." }, { status: 404 });

  const abs = path.join(process.cwd(), "public", fileRow.file_path.replace(/^\//, ""));
  try {
    await unlink(abs);
  } catch {
    // file can already be deleted
  }

  await prisma.file_uploads.delete({ where: { id: fileId } });
  await logPersonalistikaAudit({
    userId,
    action: "delete:application_file",
    tableName: "file_uploads",
    recordId: fileId,
    oldValues: { application_id: applicationId, original_filename: fileRow.original_filename },
  });

  return NextResponse.json({ success: true });
}
