-- Typ zakázky v modulu Makety a grafika: maketa (plotr) | grafika
SET NAMES utf8mb4;

ALTER TABLE `makety`
  ADD COLUMN `work_type` VARCHAR(20) NOT NULL DEFAULT 'maketa' AFTER `status`;

CREATE INDEX `idx_makety_work_type` ON `makety` (`work_type`);
