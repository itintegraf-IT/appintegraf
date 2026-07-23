-- Per-user e-mail notification preferences per module (JSON).
-- Missing/null = all modules enabled (preserve current behaviour).
ALTER TABLE `users` ADD COLUMN `email_notifications` LONGTEXT NULL;
