import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageHelpdesk } from "@/lib/helpdesk/access";
import {
  HELPDESK_COMMENT_FILE_MODULE,
  canUploadToTicket,
  canViewTicket,
  saveHelpdeskFile,
} from "@/lib/helpdesk/files";

async function loadCommentContext(ticketId: number, commentId: number) {
  const comment = await prisma.helpdesk_comments.findFirst({
    where: { id: commentId, ticket_id: ticketId },
  });
  if (!comment) return null;

  const ticket = await prisma.helpdesk_tickets.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;

  return { comment, ticket };
}

async function canViewCommentFiles(
  userId: number,
  ticket: { requester_id: number },
  comment: { is_internal: boolean }
): Promise<boolean> {
  if (!(await canViewTicket(userId, ticket))) return false;
  if (comment.is_internal) {
    return canManageHelpdesk(userId);
  }
  return true;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const ticketId = parseInt((await params).id, 10);
  const commentId = parseInt((await params).commentId, 10);
  if (Number.isNaN(ticketId) || Number.isNaN(commentId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const ctx = await loadCommentContext(ticketId, commentId);
  if (!ctx) {
    return NextResponse.json({ error: "Komentář nenalezen" }, { status: 404 });
  }

  if (!(await canViewCommentFiles(userId, ctx.ticket, ctx.comment))) {
    return NextResponse.json({ error: "Nemáte přístup" }, { status: 403 });
  }

  const files = await prisma.file_uploads.findMany({
    where: { module: HELPDESK_COMMENT_FILE_MODULE, record_id: commentId },
    orderBy: { created_at: "asc" },
    include: {
      users: { select: { first_name: true, last_name: true } },
    },
  });

  return NextResponse.json({ files });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const ticketId = parseInt((await params).id, 10);
  const commentId = parseInt((await params).commentId, 10);
  if (Number.isNaN(ticketId) || Number.isNaN(commentId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const ctx = await loadCommentContext(ticketId, commentId);
  if (!ctx) {
    return NextResponse.json({ error: "Komentář nenalezen" }, { status: 404 });
  }

  if (!(await canUploadToTicket(userId, ctx.ticket))) {
    return NextResponse.json({ error: "Nemáte oprávnění nahrávat přílohy." }, { status: 403 });
  }

  if (ctx.comment.is_internal && !(await canManageHelpdesk(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Vyberte soubor." }, { status: 400 });
  }

  const result = await saveHelpdeskFile({
    file,
    module: HELPDESK_COMMENT_FILE_MODULE,
    recordId: commentId,
    userId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ file: result.row });
}
