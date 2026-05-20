-- URL slug pro skupiny materiálů (dynamické kategorie v katalogu)
SET NAMES utf8mb4;

ALTER TABLE `material_categories`
  ADD COLUMN `slug` VARCHAR(80) NULL AFTER `label`;

UPDATE `material_categories` SET `slug` = 'papir' WHERE `code` = 'PAPER' AND (`slug` IS NULL OR `slug` = '');
UPDATE `material_categories` SET `slug` = 'foilie' WHERE `code` = 'FOIL' AND (`slug` IS NULL OR `slug` = '');
UPDATE `material_categories` SET `slug` = 'barvy' WHERE `code` = 'COLOR' AND (`slug` IS NULL OR `slug` = '');
UPDATE `material_categories` SET `slug` = 'laky' WHERE `code` = 'LACQUER' AND (`slug` IS NULL OR `slug` = '');
UPDATE `material_categories` SET `slug` = LOWER(`code`) WHERE `slug` IS NULL OR `slug` = '';
