import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/backup/admin-auth";
import { getBackupDir } from "@/lib/backup/config";
import { listBackupFilesOnServer } from "@/lib/backup/server-files";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const files = await listBackupFilesOnServer();
  return NextResponse.json({ backupDir: getBackupDir(), files });
}
