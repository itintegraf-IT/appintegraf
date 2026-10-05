-- Softproof: automatická připomínka po vypršení odkazu
ALTER TABLE `makety_softproof_links`
  ADD COLUMN `reminder_enabled` BOOLEAN NOT NULL DEFAULT false AFTER `created_by`,
  ADD COLUMN `reminder_sent_at` DATETIME(0) NULL AFTER `reminder_enabled`;

CREATE INDEX `idx_makety_softproof_links_reminder`
  ON `makety_softproof_links` (`reminder_enabled`, `reminder_sent_at`, `expires_at`);
