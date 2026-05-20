import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/backup/admin-auth";
import { BACKUP_UPLOAD_MAX_BYTES } from "@/lib/backup/config";
import { resolveSafeBackupFilePath } from "@/lib/backup/server-files";
import { readManifestFromZip, readManifestFromBuffer } from "@/lib/backup/zip-read";

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Chybí soubor zálohy" }, { status: 400 });
    }
    if (file.size > BACKUP_UPLOAD_MAX_BYTES) {
      return NextResponse.json(
        { error: `Soubor překračuje limit ${BACKUP_UPLOAD_MAX_BYTES / 1024 / 1024} MB` },
        { status: 400 }
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    try {
      const manifest = await readManifestFromBuffer(buf);
      return NextResponse.json({ manifest });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Nepodařilo se načíst manifest";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  let body: { fileName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatný požadavek" }, { status: 400 });
  }

  const zipPath = body.fileName ? resolveSafeBackupFilePath(body.fileName) : null;
  if (!zipPath) {
    return NextResponse.json({ error: "Neplatný soubor zálohy" }, { status: 400 });
  }

  try {
    const manifest = await readManifestFromZip(zipPath);
    return NextResponse.json({ manifest });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Nepodařilo se načíst manifest";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
