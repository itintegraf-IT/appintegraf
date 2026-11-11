-- Idempotence oznamování systémových novinek (data/release-notes.json → notifications)
-- Nasazení např.: ./scripts/deploy-server.sh --apply-sql 20261111_system_release_announcements.sql

CREATE TABLE IF NOT EXISTS `system_release_announcements` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `release_id` VARCHAR(120) NOT NULL,
  `announced_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `git_sha` VARCHAR(64) NULL,
  `recipient_count` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_system_release_id` (`release_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
