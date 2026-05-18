-- 2FA (TOTP) – pole v users + záložní kódy
-- Spuštění: npm run migrate:totp-2fa  (nebo phpMyAdmin)
SET NAMES utf8mb4;

ALTER TABLE `users`
  ADD COLUMN `totp_secret_enc` VARCHAR(512) NULL,
  ADD COLUMN `totp_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `totp_enabled_at` DATETIME(0) NULL;

CREATE TABLE IF NOT EXISTS `user_totp_backup_codes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `code_hash` VARCHAR(64) NOT NULL,
  `used_at` DATETIME(0) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_totp_backup_user` (`user_id`),
  KEY `idx_totp_backup_hash` (`code_hash`),
  CONSTRAINT `fk_totp_backup_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
