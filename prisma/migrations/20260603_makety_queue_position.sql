-- Pořadí ve frontě výroby (per work_type + assignee)
SET NAMES utf8mb4;

ALTER TABLE `makety`
  ADD COLUMN `queue_position` INT NULL AFTER `priority`;

CREATE INDEX `idx_makety_queue` ON `makety` (`work_type`, `assignee_user_id`, `queue_position`);
