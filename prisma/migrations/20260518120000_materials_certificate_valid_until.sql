-- Platnost certifikátu – pro Prisma migrate viz:
--   prisma/migrations/20260518120000_materials_certificate_valid_until/migration.sql
-- Platnost certifikátu u záznamu materiálu (odděleně od valid_until = BL/SDS)
SET NAMES utf8mb4;

ALTER TABLE `materials`
  ADD COLUMN `certificate_valid_until` DATETIME NULL AFTER `valid_until`;
