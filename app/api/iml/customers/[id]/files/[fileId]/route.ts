import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { unlink } from "fs/promises";
import {
  diskPathFromWebPath,
  IML_CUSTOMER_UPLOAD_MODULE,
} from "@/lib/iml-customer-upload";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const canWrite = await hasModuleAccess(userId, "iml", "write");
  if (!canWrite) {
    return NextResponse.json({ error: "Nemáte oprávnění smazat přílohu." }, { status: 403 });
  }

  const customerId = parseInt((await params).id, 10);
  const fileId = parseInt((await params).fileId, 10);
  if (Number.isNaN(customerId) || Number.isNaN(fileId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const admin = await isAdmin(userId);

  const fileRow = await prisma.file_uploads.findFirst({
    where: {
      id: fileId,
      module: IML_CUSTOMER_UPLOAD_MODULE,
      record_id: customerId,
    },
  });

  if (!fileRow) {
    return NextResponse.json({ error: "Soubor nenalezen" }, { status: 404 });
  }

  const canDelete = admin || fileRow.uploaded_by === userId;
  if (!canDelete) {
    return NextResponse.json({ error: "Nemáte oprávnění smazat tento soubor." }, { status: 403 });
  }

  try {
    await unlink(diskPathFromWebPath(fileRow.file_path));
  } catch {
    // soubor už chybí na disku
  }

  await prisma.file_uploads.delete({ where: { id: fileId } });

  await logImlAudit({
    userId,
    action: "delete:customer_file",
    tableName: "file_uploads",
    recordId: fileId,
    oldValues: {
      customer_id: customerId,
      original_filename: fileRow.original_filename,
    },
  });

  return NextResponse.json({ success: true });
}
