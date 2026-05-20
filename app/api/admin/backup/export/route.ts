import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { requireAdminApi } from "@/lib/backup/admin-auth";
import { buildBackupZipStream, allModuleIds } from "@/lib/backup/export";
import { normalizeModuleIds } from "@/lib/backup/module-registry";
import type { BackupModuleId } from "@/lib/backup/types";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: { modules?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  const modules: BackupModuleId[] =
    body.modules && body.modules.length > 0
      ? normalizeModuleIds(body.modules)
      : allModuleIds();

  if (modules.length === 0) {
    return NextResponse.json({ error: "Nebyl vybrán žádný modul" }, { status: 400 });
  }

  try {
    const { stream, filename } = await buildBackupZipStream({
      modules,
      createdByUserId: auth.userId,
    });

    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export selhal";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
