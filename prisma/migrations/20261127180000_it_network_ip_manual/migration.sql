-- Ruční přidělení IP: typ zařízení, název, popis
SET NAMES utf8mb4;

ALTER TABLE `it_network_ips`
  ADD COLUMN `device_kind` VARCHAR(80) NULL AFTER `request_id`,
  ADD COLUMN `label` VARCHAR(150) NULL AFTER `device_kind`,
  ADD COLUMN `description` TEXT NULL AFTER `label`;
