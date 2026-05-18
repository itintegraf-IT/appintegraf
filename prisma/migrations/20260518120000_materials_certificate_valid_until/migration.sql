-- Platnost certifikátu u záznamu materiálu (odděleně od valid_until = BL/SDS)
SET NAMES utf8mb4;

ALTER TABLE `materials`
  ADD COLUMN `certificate_valid_until` DATETIME NULL AFTER `valid_until`;
