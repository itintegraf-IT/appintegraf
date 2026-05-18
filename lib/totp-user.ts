import { prisma } from "@/lib/db";
import { deleteBackupCodesForUser } from "@/lib/totp-backup-codes";

/** Vypne 2FA pro uživatele, smaže secret a záložní kódy. */
export async function disableTotpForUser(
  userId: number,
  options?: { invalidateSessions?: boolean }
): Promise<void> {
  await deleteBackupCodesForUser(userId);
  await prisma.users.update({
    where: { id: userId },
    data: {
      totp_secret_enc: null,
      totp_enabled: false,
      totp_enrollment_required: false,
      totp_enabled_at: null,
      ...(options?.invalidateSessions ? { password_version: { increment: 1 } } : {}),
    },
  });
}

/** Admin zapne povinnost 2FA – uživatel dokončí nastavení při přihlášení. */
export async function requireTotpForUser(userId: number): Promise<void> {
  await deleteBackupCodesForUser(userId);
  await prisma.users.update({
    where: { id: userId },
    data: {
      totp_enrollment_required: true,
      totp_enabled: false,
      totp_secret_enc: null,
      totp_enabled_at: null,
    },
  });
}
