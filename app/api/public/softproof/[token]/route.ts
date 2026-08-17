import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/db";
import {
  MAKETY_FILE_MODULE,
  maketyFileContentDisposition,
  resolveMaketyFileDiskPath,
  sanitizeMaketyMimeType,
} from "@/lib/makety-files";
import { recordMaketyFileEvent } from "@/lib/makety-file-events";
import { notifyMaketaUsers } from "@/lib/makety-notify";
import { loadSoftproofTemplates } from "@/lib/makety-softproof-templates-db";
import {
  getSoftproofPublicChrome,
  getSoftproofTemplate,
  renderSoftproofTemplate,
} from "@/lib/makety-softproof-templates";
import {
  consumeSoftproofLink,
  findSoftproofLinkByRawToken,
  softproofLinkAccess,
  validateSoftproofDecision,
} from "@/lib/makety-softproof-links";

export const runtime = "nodejs";

function jsonError(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

async function resolveLink(rawToken: string) {
  const link = await findSoftproofLinkByRawToken(rawToken);
  if (!link) return { error: jsonError(404, { status: "missing", message: "Odkaz nenalezen" }) };

  const templates = await loadSoftproofTemplates();
  const template = getSoftproofTemplate(templates, link.locale);
  const access = softproofLinkAccess(link);
  const rendered = renderSoftproofTemplate(template, {
    maketaId: link.maketa_id,
    pageUrl: "",
  });

  if (access === "used") {
    return {
      error: jsonError(410, {
        status: "used",
        message: rendered.usedMessage,
        locale: link.locale,
        texts: getSoftproofPublicChrome(link.locale),
      }),
    };
  }
  if (access === "expired" || access === "revoked") {
    return {
      error: jsonError(410, {
        status: "expired",
        message: rendered.expiredMessage,
        locale: link.locale,
        texts: getSoftproofPublicChrome(link.locale),
      }),
    };
  }

  const maketa = await prisma.makety.findFirst({
    where: { id: link.maketa_id, work_type: "grafika" },
    select: {
      id: true,
      order_number: true,
      job_number: true,
      label_code: true,
      created_by: true,
      assignee_user_id: true,
      prepress_user_id: true,
      final_approver_user_id: true,
    },
  });
  if (!maketa) {
    return { error: jsonError(404, { status: "missing", message: "Zakázka nenalezena" }) };
  }

  const fileRow = await prisma.file_uploads.findFirst({
    where: { id: link.file_id, module: MAKETY_FILE_MODULE, record_id: link.maketa_id },
  });
  if (!fileRow) {
    return { error: jsonError(404, { status: "missing", message: "Soubor nenalezen" }) };
  }

  return { link, maketa, fileRow, rendered };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const raw = decodeURIComponent((await params).token);
    const resolved = await resolveLink(raw);
    if ("error" in resolved) return resolved.error;

    const { link, maketa, fileRow, rendered } = resolved;
    const wantFile = req.nextUrl.searchParams.get("file") === "1";
    const asDownload = req.nextUrl.searchParams.get("download") === "1";

    if (wantFile || asDownload) {
      const diskPath = resolveMaketyFileDiskPath(fileRow.file_path);
      if (!diskPath) return new NextResponse("Neplatná cesta k souboru", { status: 500 });
      let buf: Buffer;
      try {
        buf = await readFile(diskPath);
      } catch {
        return new NextResponse("Soubor na serveru chybí", { status: 404 });
      }

      await prisma.file_uploads.update({
        where: { id: fileRow.id },
        data: { last_accessed_at: new Date() },
      });
      await recordMaketyFileEvent({
        maketaId: maketa.id,
        fileId: fileRow.id,
        eventType: "softproof_downloaded",
        userId: null,
        meta: { filename: fileRow.original_filename, locale: link.locale },
      });

      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": sanitizeMaketyMimeType(fileRow.mime_type),
          "Content-Disposition": maketyFileContentDisposition(
            fileRow.original_filename,
            asDownload ? "attachment" : "inline"
          ),
          "Content-Length": String(buf.length),
          "Cache-Control": "private, no-store",
        },
      });
    }

    const mime = sanitizeMaketyMimeType(fileRow.mime_type);
    return NextResponse.json({
      status: "ok",
      locale: link.locale,
      fileName: fileRow.original_filename,
      mime,
      canPreview: mime === "application/pdf" || mime.startsWith("image/"),
      labelCode: maketa.label_code,
      orderNumber: maketa.job_number || maketa.order_number,
      maketaId: maketa.id,
      texts: {
        pageTitle: rendered.pageTitle,
        pageHint: rendered.pageHint,
        downloadLabel: rendered.downloadLabel,
        approveLabel: rendered.approveLabel,
        rejectLabel: rendered.rejectLabel,
        rejectReasonLabel: rendered.rejectReasonLabel,
        legalHtml: rendered.legalHtml,
        ...getSoftproofPublicChrome(link.locale),
      },
    });
  } catch (e) {
    console.error("GET /api/public/softproof/[token]", e);
    return NextResponse.json({ error: "Chyba při načítání" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const raw = decodeURIComponent((await params).token);
    const resolved = await resolveLink(raw);
    if ("error" in resolved) return resolved.error;

    const { link, maketa, fileRow } = resolved;
    let body: { action?: unknown; reason?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
    }

    const decision = validateSoftproofDecision(body.action, body.reason);
    if (!decision.ok) {
      return NextResponse.json({ error: decision.error }, { status: 400 });
    }

    const consumed = await consumeSoftproofLink({
      id: link.id,
      action: decision.action,
      reason: decision.reason,
    });
    if (!consumed) {
      return NextResponse.json(
        { status: "used", message: "Tento odkaz již byl použit." },
        { status: 410 }
      );
    }

    const commentBody =
      decision.action === "approved"
        ? `Klient schválil softproof (${fileRow.original_filename}) z odkazu odeslaného na ${link.sent_to_email}.`
        : `Klient zamítl softproof (${fileRow.original_filename}) z odkazu odeslaného na ${link.sent_to_email}.\n\nDůvod:\n${decision.reason}`;

    await prisma.makety_comments.create({
      data: {
        maketa_id: maketa.id,
        user_id: link.created_by,
        body: commentBody,
      },
    });

    await recordMaketyFileEvent({
      maketaId: maketa.id,
      fileId: fileRow.id,
      eventType: decision.action === "approved" ? "client_approved" : "client_rejected",
      userId: null,
      meta: {
        filename: fileRow.original_filename,
        to_email: link.sent_to_email,
        reason: decision.reason,
      },
    });

    await notifyMaketaUsers({
      maketaId: maketa.id,
      userIds: [
        maketa.created_by,
        maketa.assignee_user_id,
        maketa.prepress_user_id,
        maketa.final_approver_user_id,
      ],
      bodyPreview: commentBody,
      orderNumber: maketa.order_number,
      kind: decision.action === "approved" ? "client_approved" : "client_rejected",
      workType: "grafika",
    });

    return NextResponse.json({ success: true, action: decision.action });
  } catch (e) {
    console.error("POST /api/public/softproof/[token]", e);
    return NextResponse.json({ error: "Chyba při uložení rozhodnutí" }, { status: 500 });
  }
}
