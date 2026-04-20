-- Obnova hesla + aktivace účtu: tokeny, rate-limit, password_version
-- Spusťte ručně v MySQL (phpMyAdmin / klient), pokud nepoužíváte `prisma db push`.
-- Charset odpovídá zbytku aplikace (utf8mb4).

SET NAMES utf8mb4;

-- 1) users.password_version – invalidace existujících session po změně hesla
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `password_version` INT NOT NULL DEFAULT 1;

-- 2) user_tokens – jednorázové tokeny (password_reset / account_activation)
CREATE TABLE IF NOT EXISTS `user_tokens` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `purpose` VARCHAR(32) NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL,
  `expires_at` DATETIME(0) NOT NULL,
  `used_at` DATETIME(0) NULL,
  `ip_created` VARCHAR(45) NULL,
  `ip_used` VARCHAR(45) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_tokens_hash` (`token_hash`),
  KEY `idx_user_tokens_user_purpose` (`user_id`, `purpose`),
  KEY `idx_user_tokens_expires` (`expires_at`),
  CONSTRAINT `fk_user_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) rate_limit_hits – sliding window pro rate-limit (veřejné endpointy)
CREATE TABLE IF NOT EXISTS `rate_limit_hits` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(128) NOT NULL,
  `window_start` DATETIME(0) NOT NULL,
  `count` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rate_limit_key_window` (`key`, `window_start`),
  KEY `idx_rate_limit_window` (`window_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
