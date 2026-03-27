import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";
import { unlink } from "fs/promises";
import path from "path";
import { logContractAudit } from "@/lib/contracts/audit";
import { canManageContractRecord, canModifyAttachments } from "@/lib/contracts/access";

const MODULE = "contracts";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const contractId = parseInt((await params).id, 10);
  const fileId = parseInt((await params).fileId, 10);
  if (Number.isNaN(contractId) || Number.isNaN(fileId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const userId = parseInt(session.user.id, 10);
  const admin = await isAdmin(userId);

  const contract = await prisma.contracts.findUnique({ where: { id: contractId } });
  if (!contract) {
    return NextResponse.json({ error: "Smlouva nenalezena" }, { status: 404 });
  }

  const fileRow = await prisma.file_uploads.findFirst({
    where: {
      id: fileId,
      module: MODULE,
      record_id: contractId,
    },
  });

  if (!fileRow) {
    return NextResponse.json({ error: "Soubor nenalezen" }, { status: 404 });
  }

  if (!canModifyAttachments(contract.approval_status)) {
    return NextResponse.json({ error: "Nelze mazat přílohy u tohoto stavu." }, { status: 400 });
  }

  const canDelete =
    admin ||
    fileRow.uploaded_by === userId ||
    canManageContractRecord(contract, userId, admin);

  if (!canDelete) {
    return NextResponse.json({ error: "Nemáte oprávnění smazat tento soubor." }, { status: 403 });
  }

  const abs = path.join(process.cwd(), "public", fileRow.file_path.replace(/^\//, ""));
  try {
    await unlink(abs);
  } catch {
    // soubor už chybí na disku
  }

  await prisma.file_uploads.delete({ where: { id: fileId } });

  await logContractAudit({
    userId,
    action: "delete:contract_file",
    tableName: "file_uploads",
    recordId: fileId,
    oldValues: { original_filename: fileRow.original_filename, contract_id: contractId },
  });

  return NextResponse.json({ success: true });
}
