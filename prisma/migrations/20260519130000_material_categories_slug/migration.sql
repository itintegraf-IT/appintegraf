-- URL slug pro skupiny materiálů (dynamické kategorie v katalogu)
-- Idempotentní: sloupec slug mohl být již doplněn runtime skriptem ensureMaterialCategoriesSchema.
SET NAMES utf8mb4;

SET @slug_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'material_categories'
    AND COLUMN_NAME = 'slug'
);

SET @ddl := IF(
  @slug_exists = 0,
  'ALTER TABLE `material_categories` ADD COLUMN `slug` VARCHAR(80) NULL AFTER `label`',
  'SELECT 1'
);
PREPARE stmt_slug FROM @ddl;
EXECUTE stmt_slug;
DEALLOCATE PREPARE stmt_slug;

UPDATE `material_categories` SET `slug` = 'papir' WHERE `code` = 'PAPER' AND (`slug` IS NULL OR `slug` = '');
UPDATE `material_categories` SET `slug` = 'foilie' WHERE `code` = 'FOIL' AND (`slug` IS NULL OR `slug` = '');
UPDATE `material_categories` SET `slug` = 'barvy' WHERE `code` = 'COLOR' AND (`slug` IS NULL OR `slug` = '');
UPDATE `material_categories` SET `slug` = 'laky' WHERE `code` = 'LACQUER' AND (`slug` IS NULL OR `slug` = '');
UPDATE `material_categories` SET `slug` = LOWER(`code`) WHERE `slug` IS NULL OR `slug` = '';
