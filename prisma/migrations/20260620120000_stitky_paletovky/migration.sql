-- Modul Paletovky (pod Štítky výroba)
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `stitky_paletovka_templates` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(200) NOT NULL,
  `layout_variant` VARCHAR(30) NOT NULL DEFAULT 'single',
  `blocks_per_page` INT NOT NULL DEFAULT 1,
  `layout_json` JSON NOT NULL,
  `defaults_json` JSON NOT NULL,
  `source_filename` VARCHAR(255) NULL,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_paletovka_tpl_name` (`name`),
  KEY `idx_paletovka_tpl_created_by` (`created_by`),
  CONSTRAINT `stitky_paletovka_templates_creator_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stitky_paletovky` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `template_id` INT NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `data_json` JSON NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_paletovky_status` (`status`),
  KEY `idx_paletovky_created_by` (`created_by`),
  KEY `idx_paletovky_template` (`template_id`),
  CONSTRAINT `stitky_paletovky_template_fk` FOREIGN KEY (`template_id`) REFERENCES `stitky_paletovka_templates` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `stitky_paletovky_creator_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
