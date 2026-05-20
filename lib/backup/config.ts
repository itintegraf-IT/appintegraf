import path from "path";

export function getBackupDir(): string {
  const raw = process.env.BACKUP_DIR?.trim() || "./backups";
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
}

export function isBackupRestoreEnabled(): boolean {
  const v = process.env.BACKUP_RESTORE_ENABLED?.trim().toLowerCase();
  if (v === "false" || v === "0") return false;
  return true;
}

export const BACKUP_UPLOAD_MAX_BYTES = 60 * 1024 * 1024;

export const BACKUP_CONFIRM_TEXT = "OBNOVIT";
