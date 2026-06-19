-- Modul Štítky výroba (migrace z XLSM)
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `stitky_templates` (
  `key` VARCHAR(50) NOT NULL,
  `sheet_key` VARCHAR(50) NOT NULL,
  `row_start` INT NOT NULL DEFAULT 2,
  `row_step` INT NOT NULL DEFAULT 7,
  `row_end` INT NOT NULL DEFAULT 49,
  `col_start` INT NOT NULL DEFAULT 1,
  `col_step` INT NOT NULL DEFAULT 4,
  `col_end` INT NOT NULL DEFAULT 6,
  `layout_status` VARCHAR(20) NOT NULL DEFAULT 'ready',
  `component_key` VARCHAR(50) NOT NULL DEFAULT 'standard',
  `sort_order` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stitky_orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_number` VARCHAR(50) NOT NULL,
  `template_key` VARCHAR(50) NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  `notes` TEXT NULL,
  `created_by` INT NOT NULL,
  `last_changed_by` INT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stitky_order_number` (`order_number`),
  KEY `idx_stitky_orders_status` (`status`),
  KEY `idx_stitky_orders_created_by` (`created_by`),
  KEY `idx_stitky_orders_template` (`template_key`),
  CONSTRAINT `stitky_orders_creator_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `stitky_orders_changed_fk` FOREIGN KEY (`last_changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `stitky_orders_template_fk` FOREIGN KEY (`template_key`) REFERENCES `stitky_templates` (`key`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stitky_label_rows` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_id` INT NOT NULL,
  `row_index` TINYINT NOT NULL,
  `quantity` INT NULL,
  `pack_size` INT NULL,
  `text1` VARCHAR(500) NULL,
  `text2` VARCHAR(500) NULL,
  `text3` VARCHAR(500) NULL,
  `prefix` VARCHAR(50) NULL,
  `range_from` VARCHAR(20) NULL,
  `range_to` VARCHAR(20) NULL,
  `barcode_type` VARCHAR(50) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stitky_row_order_index` (`order_id`, `row_index`),
  CONSTRAINT `stitky_label_rows_order_fk` FOREIGN KEY (`order_id`) REFERENCES `stitky_orders` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stitky_user_roles` (
  `user_id` INT NOT NULL,
  `role` VARCHAR(20) NOT NULL,
  PRIMARY KEY (`user_id`, `role`),
  CONSTRAINT `stitky_user_roles_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stitky_settings` (
  `key` VARCHAR(50) NOT NULL,
  `value` TEXT NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `stitky_templates` (`key`, `sheet_key`, `row_start`, `row_step`, `row_end`, `col_start`, `col_step`, `col_end`, `layout_status`, `component_key`, `sort_order`) VALUES
('Standard', 'Standard', 2, 7, 49, 1, 4, 6, 'ready', 'standard', 1),
('Standard IG', 'Standard', 2, 7, 49, 1, 4, 6, 'ready', 'standard', 2),
('Neutrální', 'neut', 2, 7, 49, 1, 4, 6, 'ready', 'neut', 3),
('Oriflame', 'Oriflame', 2, 9, 34, 1, 5, 9, 'ready', 'oriflame', 4),
('MHA', 'MHA', 2, 7, 49, 1, 4, 6, 'ready', 'standard', 10),
('DPMB Průkazka', 'DPMB', 2, 7, 49, 1, 4, 6, 'ready', 'standard', 11),
('DPMB Kupón', 'DPMB', 2, 7, 49, 1, 4, 6, 'ready', 'standard', 12),
('DPMB Bloková jíz', 'DPMB', 2, 7, 49, 1, 4, 6, 'ready', 'standard', 13),
('DPMB Univerzál jíz', 'DPMB', 2, 7, 49, 1, 4, 6, 'ready', 'standard', 14),
('DP Bratislava', 'DP', 2, 7, 49, 1, 4, 6, 'ready', 'standard', 15),
('Obálky SVK', 'Obalky', 2, 7, 49, 1, 4, 6, 'ready', 'standard', 16),
('Obálky CZ', 'Obalky', 2, 7, 49, 1, 4, 6, 'ready', 'standard', 17),
('Billa', 'Billa', 2, 7, 49, 1, 4, 6, 'ready', 'standard', 18),
('Jídelní kupóny', 'Kupony', 2, 7, 49, 1, 4, 6, 'ready', 'standard', 19),
('Korid LK', 'Korid', 2, 7, 49, 1, 4, 6, 'ready', 'standard', 20),
('jiné', 'Custom', 2, 7, 49, 1, 4, 6, 'ready', 'standard', 99);

INSERT IGNORE INTO `stitky_settings` (`key`, `value`) VALUES
('email_recipients', 'd.stepan@integraf.cz;m.mateju@integraf.cz');
