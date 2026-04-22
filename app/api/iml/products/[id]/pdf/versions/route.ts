import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";

/**
 * Historie verzí PDF k produktu.
 *
 * GET    – seznam verzí (bez blobů), seřazeno od nejnovější.
 * DELETE ?version=N – smaže konkrétní verzi. Primary verzi tímto
 *                     endpointem mazat nelze (přes ni jde DELETE /pdf,
 *                     který navíc povyšuje předchozí).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k modulu IML" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const versions = await prisma.iml_product_files.findMany({
    where: { product_id: id },
    orderBy: [{ version: "desc" }],
    select: {
      id: true,
      version: true,
      filename: true,
      file_size: true,
      mime_type: true,
      is_primary: true,
      uploaded_at: true,
      uploaded_by: true,
      users: { select: { id: true, first_name: true, last_name: true, username: true } },
    },
  });

  return NextResponse.json({
    versions: versions.map((v) => ({
      id: v.id,
      version: v.version,
      filename: v.filename,
      file_size: v.file_size,
      mime_type: v.mime_type,
      is_primary: v.is_primary,
      uploaded_at: v.uploaded_at,
      uploader:
        v.users != null
          ? {
              id: v.users.id,
              name:
                [v.users.first_name, v.users.last_name].filter(Boolean).join(" ") ||
                v.users.username,
            }
          : { id: v.uploaded_by, name: `user_${v.uploaded_by}` },
    })),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám IML" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const versionParam = req.nextUrl.searchParams.get("version");
  if (!versionParam || !/^\d+$/.test(versionParam)) {
    return NextResponse.json({ error: "Parametr ?version=N je povinný" }, { status: 400 });
  }
  const versionNum = parseInt(versionParam, 10);

  const row = await prisma.iml_product_files.findUnique({
    where: { product_id_version: { product_id: id, version: versionNum } },
    select: { id: true, is_primary: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Verze neexistuje" }, { status: 404 });
  }
  if (row.is_primary) {
    return NextResponse.json(
      {
        error:
          "Primární verzi tímto endpointem nemažte – použijte DELETE /api/iml/products/[id]/pdf (provede downgrade).",
      },
      { status: 409 }
    );
  }

  await prisma.iml_product_files.delete({ where: { id: row.id } });

  await logImlAudit({
    userId,
    action: "delete",
    tableName: "iml_product_files",
    recordId: id,
    oldValues: { deleted_version: versionNum },
  });

  return NextResponse.json({ success: true, deleted_version: versionNum });
}
