import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { readFile, unlink } from "fs/promises";
import {
  IML_DIE_CUT_UPLOAD_MODULE,
  diskPathFromDieCutWebPath,
} from "@/lib/iml-die-cut-upload";

export const runtime = "nodejs";

function contentDisposition(filename: string, disposition: "inline" | "attachment"): string {
  const safe = filename.replace(/["\r\n]/g, "_");
  const encoded = encodeURIComponent(filename);
  return `${disposition}; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Neautorizováno", { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return new NextResponse("Nemáte oprávnění", { status: 403 });
  }

  const dieCutId = parseInt((await params).id, 10);
  const fileId = parseInt((await params).fileId, 10);
  if (Number.isNaN(dieCutId) || Number.isNaN(fileId)) {
    return new NextResponse("Neplatné ID", { status: 400 });
  }

  const fileRow = await prisma.file_uploads.findFirst({
    where: {
      id: fileId,
      module: IML_DIE_CUT_UPLOAD_MODULE,
      record_id: dieCutId,
    },
  });
  if (!fileRow) {
    return new NextResponse("Soubor nenalezen", { status: 404 });
  }

  let buf: Buffer;
  try {
    buf = await readFile(diskPathFromDieCutWebPath(fileRow.file_path));
  } catch {
    return new NextResponse("Soubor na serveru chybí", { status: 404 });
  }

  const asDownload = req.nextUrl.searchParams.get("download") === "1";
  const mime = fileRow.mime_type?.trim() || "application/octet-stream";

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": contentDisposition(
        fileRow.original_filename,
        asDownload || !mime.includes("pdf") ? "attachment" : "inline"
      ),
      "Content-Length": String(buf.length),
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění smazat přílohu." }, { status: 403 });
  }

  const dieCutId = parseInt((await params).id, 10);
  const fileId = parseInt((await params).fileId, 10);
  if (Number.isNaN(dieCutId) || Number.isNaN(fileId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const fileRow = await prisma.file_uploads.findFirst({
    where: {
      id: fileId,
      module: IML_DIE_CUT_UPLOAD_MODULE,
      record_id: dieCutId,
    },
  });

  if (!fileRow) {
    return NextResponse.json({ error: "Soubor nenalezen" }, { status: 404 });
  }

  try {
    await unlink(diskPathFromDieCutWebPath(fileRow.file_path));
  } catch {
    // soubor už chybí na disku
  }

  await prisma.file_uploads.delete({ where: { id: fileId } });

  await logImlAudit({
    userId,
    action: "delete",
    tableName: "file_uploads",
    recordId: fileId,
    oldValues: {
      die_cut_id: dieCutId,
      original_filename: fileRow.original_filename,
    },
  });

  return NextResponse.json({ success: true });
}
