-- Typ dat u zadání grafiky: nová data | úprava dat
SET NAMES utf8mb4;

ALTER TABLE `makety`
  ADD COLUMN `data_kind` VARCHAR(20) NOT NULL DEFAULT 'nova_data' AFTER `priority`;
