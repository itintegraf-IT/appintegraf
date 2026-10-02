import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadEquipment } from "@/lib/equipment/access";
import { equipmentDownloadName, equipmentFileDiskPath, equipmentServeHeaders } from "@/lib/equipment/files";
import { EQUIPMENT_UPLOAD_MODULE } from "@/lib/equipment/upload";

/** Fotka nebo příloha položky — s kontrolou práva číst skupinu položky. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  const { id: idParam, fileId: fileIdParam } = await params;
  const id = parseInt(idParam, 10);
  const fileId = parseInt(fileIdParam, 10);
  if (Number.isNaN(id) || Number.isNaN(fileId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  try {
    const item = await prisma.equipment_items.findUnique({
      where: { id },
      select: { category_id: true },
    });
    if (!item) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
    if (!(await canReadEquipment(userId, item.category_id))) {
      return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
    }

    const fileRow = await prisma.file_uploads.findFirst({
      where: { id: fileId, module: EQUIPMENT_UPLOAD_MODULE, record_id: id },
      select: { file_path: true, mime_type: true, original_filename: true },
    });
    if (!fileRow) return NextResponse.json({ error: "Soubor nenalezen" }, { status: 404 });

    const diskPath = equipmentFileDiskPath(id, fileRow.file_path);
    if (!diskPath) {
      console.error("equipment file GET: neočekávaná cesta souboru", { fileId });
      return NextResponse.json({ error: "Soubor nenalezen" }, { status: 404 });
    }

    let buf: Buffer;
    try {
      buf = await readFile(diskPath);
    } catch {
      return NextResponse.json({ error: "Soubor na serveru chybí." }, { status: 404 });
    }

    const download = req.nextUrl.searchParams.get("download") === "1";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        ...equipmentServeHeaders(
          fileRow.mime_type,
          equipmentDownloadName(fileRow.original_filename, fileRow.file_path),
          download
        ),
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    console.error("equipment file GET:", e);
    return NextResponse.json({ error: "Chyba při načítání souboru" }, { status: 500 });
  }
}
