-- Připomínky a rozšířené barvy: barva dál zůstává v DB, ale u nových událostí se bere z typu.
ALTER TABLE `calendar_events`
  ADD COLUMN `remind_before_minutes` INT NULL,
  ADD COLUMN `reminder_notify_in_app` TINYINT(1) NULL DEFAULT 1,
  ADD COLUMN `reminder_notify_email` TINYINT(1) NULL DEFAULT 1,
  ADD COLUMN `reminder_notified_at` DATETIME NULL;
