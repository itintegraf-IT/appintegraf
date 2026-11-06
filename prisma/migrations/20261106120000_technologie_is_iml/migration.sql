-- Příznak: technologie pro IML
ALTER TABLE `technologie`
  ADD COLUMN `is_iml` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `idx_technologie_is_iml` ON `technologie`(`is_iml`);
