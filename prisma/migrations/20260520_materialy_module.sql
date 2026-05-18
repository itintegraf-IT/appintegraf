-- Modul Katalog materiálů + napojení IML produktů
SET NAMES utf8mb4;

ALTER TABLE `file_uploads`
  ADD COLUMN `document_type` VARCHAR(30) NULL AFTER `module`;

CREATE TABLE IF NOT EXISTS `material_categories` (
  `code` VARCHAR(20) NOT NULL,
  `label` VARCHAR(100) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `material_categories` (`code`, `label`, `sort_order`) VALUES
  ('PAPER', 'Papír', 1),
  ('FOIL', 'Fólie', 2),
  ('COLOR', 'Barvy', 3),
  ('LACQUER', 'Laky', 4)
ON DUPLICATE KEY UPDATE `label` = VALUES(`label`), `sort_order` = VALUES(`sort_order`);

CREATE TABLE IF NOT EXISTS `material_subcategories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `category_code` VARCHAR(20) NOT NULL,
  `parent_id` INT NULL,
  `name` VARCHAR(255) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_material_subcat_category` (`category_code`),
  KEY `idx_material_subcat_parent` (`parent_id`),
  CONSTRAINT `material_subcategories_category_fk` FOREIGN KEY (`category_code`) REFERENCES `material_categories` (`code`) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT `material_subcategories_parent_fk` FOREIGN KEY (`parent_id`) REFERENCES `material_subcategories` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `material_subcategories` (`category_code`, `parent_id`, `name`, `sort_order`, `is_active`)
SELECT 'COLOR', NULL, 'PANTONE', 1, TRUE
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `material_subcategories` WHERE `category_code` = 'COLOR' AND `name` = 'PANTONE' AND `parent_id` IS NULL
);

CREATE TABLE IF NOT EXISTS `materials` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `category_code` VARCHAR(20) NOT NULL,
  `subcategory_id` INT NULL,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(100) NULL,
  `manufacturer` VARCHAR(255) NULL,
  `supplier` VARCHAR(255) NULL,
  `description` TEXT NULL,
  `cas_number` VARCHAR(50) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `valid_until` DATETIME NULL,
  `notes` TEXT NULL,
  `legacy_source` VARCHAR(30) NULL,
  `legacy_id` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_materials_category` (`category_code`),
  KEY `idx_materials_subcategory` (`subcategory_id`),
  KEY `idx_materials_name` (`name`),
  KEY `idx_materials_code` (`code`),
  KEY `idx_materials_legacy` (`legacy_source`, `legacy_id`),
  CONSTRAINT `materials_category_fk` FOREIGN KEY (`category_code`) REFERENCES `material_categories` (`code`) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT `materials_subcategory_fk` FOREIGN KEY (`subcategory_id`) REFERENCES `material_subcategories` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `iml_products`
  ADD COLUMN `foil_material_id` INT NULL AFTER `foil_type`,
  ADD COLUMN `color_material_id` INT NULL AFTER `color_coverage`,
  ADD COLUMN `paper_material_id` INT NULL AFTER `color_material_id`,
  ADD COLUMN `lacquer_material_id` INT NULL AFTER `paper_material_id`;

ALTER TABLE `iml_products`
  ADD KEY `idx_iml_products_foil_material` (`foil_material_id`),
  ADD KEY `idx_iml_products_color_material` (`color_material_id`),
  ADD KEY `idx_iml_products_paper_material` (`paper_material_id`),
  ADD KEY `idx_iml_products_lacquer_material` (`lacquer_material_id`);

ALTER TABLE `iml_products`
  ADD CONSTRAINT `iml_products_foil_material_fk` FOREIGN KEY (`foil_material_id`) REFERENCES `materials` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  ADD CONSTRAINT `iml_products_color_material_fk` FOREIGN KEY (`color_material_id`) REFERENCES `materials` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  ADD CONSTRAINT `iml_products_paper_material_fk` FOREIGN KEY (`paper_material_id`) REFERENCES `materials` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  ADD CONSTRAINT `iml_products_lacquer_material_fk` FOREIGN KEY (`lacquer_material_id`) REFERENCES `materials` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

UPDATE `iml_products` p
INNER JOIN `materials` m ON m.`category_code` = 'FOIL' AND m.`is_active` = TRUE
  AND (m.`name` = p.`foil_type` OR m.`code` = p.`foil_type`)
SET p.`foil_material_id` = m.`id`
WHERE p.`foil_type` IS NOT NULL AND TRIM(p.`foil_type`) <> '' AND p.`foil_material_id` IS NULL;

UPDATE `iml_products` p
INNER JOIN `materials` m ON m.`category_code` = 'COLOR' AND m.`is_active` = TRUE
  AND (m.`name` = p.`color_coverage` OR m.`code` = p.`color_coverage`)
SET p.`color_material_id` = m.`id`
WHERE p.`color_coverage` IS NOT NULL AND TRIM(p.`color_coverage`) <> '' AND p.`color_material_id` IS NULL;
