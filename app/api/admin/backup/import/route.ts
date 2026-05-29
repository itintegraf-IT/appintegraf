import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/backup/admin-auth";
import { BACKUP_CONFIRM_TEXT, BACKUP_UPLOAD_MAX_BYTES } from "@/lib/backup/config";
import { runBackupRestoreFromBuffer } from "@/lib/backup/import";
import { normalizeModuleIds } from "@/lib/backup/module-registry";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const form = await req.formData();
  const file = form.get("file");
  const confirm = String(form.get("confirm") ?? "");
  const modulesRaw = String(form.get("modules") ?? "[]");

  if (confirm !== BACKUP_CONFIRM_TEXT) {
    return NextResponse.json(
      { error: `Pro obnovu zadejte potvrzení „${BACKUP_CONFIRM_TEXT}“` },
      { status: 400 }
    );
  }

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Chybí soubor zálohy" }, { status: 400 });
  }

  if (file.size > BACKUP_UPLOAD_MAX_BYTES) {
    return NextResponse.json(
      {
        error: `Soubor překračuje limit ${BACKUP_UPLOAD_MAX_BYTES / 1024 / 1024} MB. Pro větší zálohy použijte obnovu ze serveru.`,
      },
      { status: 400 }
    );
  }

  let modules: string[];
  try {
    modules = JSON.parse(modulesRaw) as string[];
  } catch {
    return NextResponse.json({ error: "Neplatný seznam modulů" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await runBackupRestoreFromBuffer(
    buf,
    normalizeModuleIds(modules),
    auth.userId
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.errors.join("; "), ...result }, { status: 500 });
  }

  return NextResponse.json(result);
}
