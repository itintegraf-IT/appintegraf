import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  HELPDESK_FILE_MODULE,
  canUploadToTicket,
  canViewTicket,
  saveHelpdeskFile,
} from "@/lib/helpdesk/files";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const ticketId = parseInt((await params).id, 10);
  if (Number.isNaN(ticketId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const ticket = await prisma.helpdesk_tickets.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket nenalezen" }, { status: 404 });
  }

  if (!(await canViewTicket(userId, ticket))) {
    return NextResponse.json({ error: "Nemáte přístup" }, { status: 403 });
  }

  const files = await prisma.file_uploads.findMany({
    where: { module: HELPDESK_FILE_MODULE, record_id: ticketId },
    orderBy: { created_at: "asc" },
    include: {
      users: { select: { first_name: true, last_name: true } },
    },
  });

  return NextResponse.json({ files });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const ticketId = parseInt((await params).id, 10);
  if (Number.isNaN(ticketId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const ticket = await prisma.helpdesk_tickets.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket nenalezen" }, { status: 404 });
  }

  if (!(await canUploadToTicket(userId, ticket))) {
    return NextResponse.json({ error: "Nemáte oprávnění nahrávat přílohy." }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Vyberte soubor." }, { status: 400 });
  }

  const result = await saveHelpdeskFile({
    file,
    module: HELPDESK_FILE_MODULE,
    recordId: ticketId,
    userId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ file: result.row });
}
