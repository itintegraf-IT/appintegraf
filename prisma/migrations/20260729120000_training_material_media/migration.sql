-- Videa a prezentace ve výukových materiálech
ALTER TABLE `learning_materials`
  ADD COLUMN `material_type` VARCHAR(20) NOT NULL DEFAULT 'text' AFTER `content`,
  ADD COLUMN `media_url` VARCHAR(500) NULL AFTER `material_type`;
