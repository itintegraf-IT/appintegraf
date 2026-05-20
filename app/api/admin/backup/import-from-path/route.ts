import { NextRequest, NextResponse } from "next/server";
import { access } from "fs/promises";
import { requireAdminApi } from "@/lib/backup/admin-auth";
import { BACKUP_CONFIRM_TEXT, isBackupRestoreEnabled } from "@/lib/backup/config";
import { runBackupRestore } from "@/lib/backup/import";
import { resolveSafeBackupFilePath } from "@/lib/backup/server-files";
import { normalizeModuleIds } from "@/lib/backup/module-registry";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  if (!isBackupRestoreEnabled()) {
    return NextResponse.json(
      { error: "Obnova ze zálohy je na tomto serveru zakázána (BACKUP_RESTORE_ENABLED)." },
      { status: 403 }
    );
  }

  let body: { fileName?: string; modules?: string[]; confirm?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  if (body.confirm !== BACKUP_CONFIRM_TEXT) {
    return NextResponse.json(
      { error: `Pro obnovu zadejte potvrzení „${BACKUP_CONFIRM_TEXT}“` },
      { status: 400 }
    );
  }

  const zipPath = body.fileName ? resolveSafeBackupFilePath(body.fileName) : null;
  if (!zipPath) {
    return NextResponse.json({ error: "Neplatný soubor zálohy" }, { status: 400 });
  }

  try {
    await access(zipPath);
  } catch {
    return NextResponse.json({ error: "Soubor zálohy na serveru neexistuje" }, { status: 404 });
  }

  const modules = normalizeModuleIds(body.modules ?? []);
  const result = await runBackupRestore(zipPath, modules, auth.userId);

  if (!result.ok) {
    return NextResponse.json({ error: result.errors.join("; "), ...result }, { status: 500 });
  }

  return NextResponse.json(result);
}
