import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { sendMaketySoftproofEmail } from "@/lib/email";
import {
  userCanOperateGrafikaAutomation,
  userCanViewMaketa,
} from "@/lib/makety-access";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import {
  MAKETY_FILE_MODULE,
  resolveMaketyFileDiskPath,
  sanitizeMaketyMimeType,
} from "@/lib/makety-files";
import { signSoftproofToken } from "@/lib/makety-softproof-token";
import { assertGrafikaTransition } from "@/lib/makety-grafika-status";
import { notifyMaketaUsers } from "@/lib/makety-notify";

export const runtime = "nodejs";

const ATTACH_MAX_BYTES = 8 * 1024 * 1024;

function getBaseUrl(req: NextRequest): string {
  const explicit =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return req.nextUrl.origin;
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
  if (!(await canAccessMaketyModule(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const maketaId = parseInt((await params).id, 10);
  if (Number.isNaN(maketaId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanViewMaketa(userId, maketaId))) {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }

  let body: { fileId?: number; toEmail?: string; attachFile?: boolean; acknowledgeOverride?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  const automation = await userCanOperateGrafikaAutomation(userId, maketaId);
  if (!automation.allowed) {
    return NextResponse.json(
      { error: "Softproof může odeslat jen finální schvalovatel" },
      { status: 403 }
    );
  }
  if (automation.viaOverride && body.acknowledgeOverride !== true) {
    return NextResponse.json(
      {
        error: "Převzetí role finálního schvalovatele vyžaduje potvrzení",
        needsOverrideAck: true,
      },
      { status: 400 }
    );
  }

  const fileId = Number(body.fileId);
  if (!Number.isFinite(fileId)) {
    return NextResponse.json({ error: "Vyberte soubor softproofu" }, { status: 400 });
  }

  const maketa = await prisma.makety.findFirst({
    where: { id: maketaId, work_type: "grafika" },
    include: {
      iml_customers: {
        select: {
          name: true,
          email: true,
          iml_customer_emails: {
            where: { is_primary: true },
            take: 1,
            select: { email: true },
          },
        },
      },
    },
  });
  if (!maketa) {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }

  if (maketa.status !== "prepress_approved" && maketa.status !== "sent_for_approval") {
    return NextResponse.json(
      {
        error:
          "Softproof lze odeslat až po schválení prepressem a před finálním schválením.",
      },
      { status: 400 }
    );
  }

  const toEmail =
    (typeof body.toEmail === "string" ? body.toEmail.trim() : "") ||
    maketa.iml_customers?.email?.trim() ||
    maketa.iml_customers?.iml_customer_emails[0]?.email?.trim() ||
    "";
  if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    return NextResponse.json(
      { error: "Zadejte platný e-mail klienta" },
      { status: 400 }
    );
  }

  const fileRow = await prisma.file_uploads.findFirst({
    where: { id: fileId, module: MAKETY_FILE_MODULE, record_id: maketaId },
  });
  if (!fileRow) {
    return NextResponse.json({ error: "Soubor nenalezen" }, { status: 404 });
  }

  const diskPath = resolveMaketyFileDiskPath(fileRow.file_path);
  if (!diskPath) {
    return NextResponse.json({ error: "Neplatná cesta k souboru" }, { status: 500 });
  }

  let buf: Buffer | null = null;
  try {
    buf = await readFile(diskPath);
  } catch {
    return NextResponse.json(
      { error: "Soubor na serveru chybí" },
      { status: 404 }
    );
  }

  const token = await signSoftproofToken({ maketaId, fileId });
  const downloadUrl = `${getBaseUrl(req)}/api/makety/softproof/${encodeURIComponent(token)}`;

  const attach =
    body.attachFile === true && buf.length <= ATTACH_MAX_BYTES
      ? {
          filename: fileRow.original_filename,
          content: buf,
          contentType: sanitizeMaketyMimeType(fileRow.mime_type),
        }
      : undefined;

  const sent = await sendMaketySoftproofEmail({
    toEmail,
    toName: maketa.iml_customers?.name?.trim() || "kliente",
    maketaId,
    orderNumber: maketa.job_number || maketa.order_number,
    labelCode: maketa.label_code,
    downloadUrl,
    fileName: fileRow.original_filename,
    attachment: attach,
  });

  if (!sent.success) {
    return NextResponse.json(
      { error: sent.error ?? "Odeslání e-mailu selhalo" },
      { status: 502 }
    );
  }

  let status = maketa.status;
  if (maketa.status === "prepress_approved") {
    try {
      assertGrafikaTransition({
        fromStatus: maketa.status,
        toStatus: "sent_for_approval",
        comment: "",
      });
      await prisma.$transaction(async (tx) => {
        await tx.makety.update({
          where: { id: maketaId },
          data: { status: "sent_for_approval" },
        });
        await tx.makety_status_log.create({
          data: {
            maketa_id: maketaId,
            from_status: maketa.status,
            to_status: "sent_for_approval",
            user_id: userId,
            comment: `Softproof odeslán na ${toEmail}`,
          },
        });
        await tx.makety_comments.create({
          data: {
            maketa_id: maketaId,
            user_id: userId,
            body: `Softproof (${fileRow.original_filename}) odeslán na ${toEmail}`,
          },
        });
      });
      status = "sent_for_approval";

      await notifyMaketaUsers({
        maketaId,
        userIds: [
          maketa.created_by,
          maketa.assignee_user_id,
          maketa.prepress_user_id,
        ],
        bodyPreview: `Softproof odeslán na ${toEmail}`,
        orderNumber: maketa.order_number,
        kind: "sent_for_client",
        workType: "grafika",
        excludeUserId: userId,
      });
    } catch (e) {
      console.error("softproof status transition", e);
      return NextResponse.json(
        { error: "E-mail odeslán, ale změna stavu selhala" },
        { status: 500 }
      );
    }
  } else {
    await prisma.makety_comments.create({
      data: {
        maketa_id: maketaId,
        user_id: userId,
        body: `Softproof (${fileRow.original_filename}) znovu odeslán na ${toEmail}`,
      },
    });
  }

  return NextResponse.json({
    success: true,
    status,
    toEmail,
    downloadUrl,
    attached: Boolean(attach),
  });
}
