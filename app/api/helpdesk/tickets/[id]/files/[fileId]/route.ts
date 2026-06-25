import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { unlink } from "fs/promises";
import {
  HELPDESK_FILE_MODULE,
  canDeleteFile,
  canViewTicket,
  resolveHelpdeskFileDiskPath,
} from "@/lib/helpdesk/files";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const ticketId = parseInt((await params).id, 10);
  const fileId = parseInt((await params).fileId, 10);
  if (Number.isNaN(ticketId) || Number.isNaN(fileId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const ticket = await prisma.helpdesk_tickets.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket nenalezen" }, { status: 404 });
  }

  const fileRow = await prisma.file_uploads.findFirst({
    where: {
      id: fileId,
      module: HELPDESK_FILE_MODULE,
      record_id: ticketId,
    },
  });

  if (!fileRow) {
    return NextResponse.json({ error: "Soubor nenalezen" }, { status: 404 });
  }

  if (!(await canViewTicket(userId, ticket))) {
    return NextResponse.json({ error: "Nemáte přístup" }, { status: 403 });
  }

  if (!(await canDeleteFile(userId, ticket, fileRow.uploaded_by))) {
    return NextResponse.json({ error: "Nemáte oprávnění smazat tento soubor." }, { status: 403 });
  }

  const abs = resolveHelpdeskFileDiskPath(fileRow.file_path);
  if (abs) {
    try {
      await unlink(abs);
    } catch {
      // soubor už chybí na disku
    }
  }

  await prisma.file_uploads.delete({ where: { id: fileId } });

  return NextResponse.json({ success: true });
}
