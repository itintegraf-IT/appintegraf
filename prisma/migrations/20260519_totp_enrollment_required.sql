-- Admin vyžádá 2FA; uživatel dokončí nastavení při prvním přihlášení
SET NAMES utf8mb4;

ALTER TABLE `users`
  ADD COLUMN `totp_enrollment_required` TINYINT(1) NOT NULL DEFAULT 0;
