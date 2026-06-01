import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { userCanViewMaketa, userCanEditMaketa } from "@/lib/makety-access";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { MAKETY_FILE_MODULE } from "@/lib/makety-files";
import { unlink } from "fs/promises";
import path from "path";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessMaketyModule(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const maketaId = parseInt((await params).id, 10);
  const fileId = parseInt((await params).fileId, 10);
  if (Number.isNaN(maketaId) || Number.isNaN(fileId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanViewMaketa(userId, maketaId))) {
    return NextResponse.json({ error: "Maketa nenalezena" }, { status: 404 });
  }

  const canDelete = await userCanEditMaketa(userId, maketaId);
  if (!canDelete) {
    return NextResponse.json({ error: "Smazat soubor může jen zadavatel" }, { status: 403 });
  }

  const fileRow = await prisma.file_uploads.findFirst({
    where: { id: fileId, module: MAKETY_FILE_MODULE, record_id: maketaId },
  });
  if (!fileRow) {
    return NextResponse.json({ error: "Soubor nenalezen" }, { status: 404 });
  }

  const diskPath = path.join(process.cwd(), "public", fileRow.file_path.replace(/^\//, ""));
  try {
    await unlink(diskPath);
  } catch {
    /* soubor na disku už nemusí existovat */
  }

  await prisma.file_uploads.delete({ where: { id: fileId } });
  return NextResponse.json({ success: true });
}
