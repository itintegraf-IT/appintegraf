-- Majetek: místnosti, QR fond, historie přesunů, inventury, oprávnění dle skupin

-- Skupiny: zodpovědný uživatel
ALTER TABLE `equipment_categories`
  ADD COLUMN `responsible_user_id` INT NULL AFTER `is_active`,
  ADD INDEX `idx_equipment_cat_responsible` (`responsible_user_id`),
  ADD CONSTRAINT `equipment_categories_responsible_fk`
    FOREIGN KEY (`responsible_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- Položky: QR, místnost, záruka, náhledová fotka
ALTER TABLE `equipment_items`
  ADD COLUMN `asset_tag` VARCHAR(40) NULL AFTER `serial_number`,
  ADD COLUMN `qr_code` VARCHAR(64) NULL AFTER `asset_tag`,
  ADD COLUMN `room_id` INT NULL AFTER `location`,
  ADD COLUMN `cover_file_id` INT NULL AFTER `room_id`,
  ADD COLUMN `warranty_until` DATE NULL AFTER `cover_file_id`,
  ADD COLUMN `last_service_at` DATE NULL AFTER `warranty_until`,
  ADD UNIQUE INDEX `equipment_items_asset_tag_unique` (`asset_tag`),
  ADD UNIQUE INDEX `equipment_items_qr_code_unique` (`qr_code`),
  ADD INDEX `idx_equipment_items_room` (`room_id`);

CREATE TABLE IF NOT EXISTS `equipment_rooms` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `code` VARCHAR(40) NOT NULL,
  `building` VARCHAR(100) NULL,
  `floor` VARCHAR(50) NULL,
  `description` TEXT NULL,
  `qr_code` VARCHAR(64) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `equipment_rooms_code_unique` (`code`),
  UNIQUE KEY `equipment_rooms_qr_code_unique` (`qr_code`),
  INDEX `idx_equipment_rooms_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `equipment_items`
  ADD CONSTRAINT `equipment_items_room_fk`
    FOREIGN KEY (`room_id`) REFERENCES `equipment_rooms` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE TABLE IF NOT EXISTS `equipment_user_category_access` (
  `user_id` INT NOT NULL,
  `category_id` INT NOT NULL,
  `access_level` VARCHAR(20) NOT NULL DEFAULT 'read',
  `granted_by` INT NULL,
  `granted_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `category_id`),
  INDEX `idx_eq_uca_category` (`category_id`),
  CONSTRAINT `equipment_uca_user_fk`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `equipment_uca_category_fk`
    FOREIGN KEY (`category_id`) REFERENCES `equipment_categories` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `equipment_uca_granted_fk`
    FOREIGN KEY (`granted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `equipment_location_history` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `equipment_id` INT NOT NULL,
  `from_room_id` INT NULL,
  `to_room_id` INT NOT NULL,
  `transferred_by` INT NOT NULL,
  `transferred_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `source` VARCHAR(20) NOT NULL DEFAULT 'manual',
  `notes` TEXT NULL,
  `protocol_number` VARCHAR(40) NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_eq_loc_hist_equipment` (`equipment_id`),
  INDEX `idx_eq_loc_hist_to_room` (`to_room_id`),
  INDEX `idx_eq_loc_hist_from_room` (`from_room_id`),
  INDEX `idx_eq_loc_hist_transferred` (`transferred_at`),
  CONSTRAINT `equipment_loc_hist_item_fk`
    FOREIGN KEY (`equipment_id`) REFERENCES `equipment_items` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `equipment_loc_hist_from_fk`
    FOREIGN KEY (`from_room_id`) REFERENCES `equipment_rooms` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `equipment_loc_hist_to_fk`
    FOREIGN KEY (`to_room_id`) REFERENCES `equipment_rooms` (`id`) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT `equipment_loc_hist_user_fk`
    FOREIGN KEY (`transferred_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `equipment_qr_pool` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `qr_code` VARCHAR(64) NOT NULL,
  `asset_tag` VARCHAR(40) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'available',
  `batch_id` VARCHAR(40) NOT NULL,
  `equipment_id` INT NULL,
  `printed_at` TIMESTAMP NULL,
  `assigned_at` TIMESTAMP NULL,
  `assigned_by` INT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` INT NOT NULL,
  `notes` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `equipment_qr_pool_qr_unique` (`qr_code`),
  UNIQUE KEY `equipment_qr_pool_tag_unique` (`asset_tag`),
  INDEX `idx_eq_qr_pool_batch` (`batch_id`),
  INDEX `idx_eq_qr_pool_status` (`status`),
  INDEX `idx_eq_qr_pool_equipment` (`equipment_id`),
  CONSTRAINT `equipment_qr_pool_item_fk`
    FOREIGN KEY (`equipment_id`) REFERENCES `equipment_items` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `equipment_qr_pool_created_fk`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT `equipment_qr_pool_assigned_fk`
    FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `equipment_inventories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(200) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
  `scope_type` VARCHAR(20) NOT NULL DEFAULT 'all',
  `scope_id` INT NULL,
  `created_by` INT NOT NULL,
  `completed_at` TIMESTAMP NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_eq_inv_status` (`status`),
  INDEX `idx_eq_inv_created` (`created_by`),
  CONSTRAINT `equipment_inventories_user_fk`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `equipment_inventory_lines` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `inventory_id` INT NOT NULL,
  `equipment_id` INT NOT NULL,
  `expected_room_id` INT NULL,
  `scanned_at` TIMESTAMP NULL,
  `scanned_by` INT NULL,
  `line_status` VARCHAR(20) NOT NULL DEFAULT 'missing',
  `notes` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `equipment_inv_lines_unique` (`inventory_id`, `equipment_id`),
  INDEX `idx_eq_inv_lines_equipment` (`equipment_id`),
  CONSTRAINT `equipment_inv_lines_inv_fk`
    FOREIGN KEY (`inventory_id`) REFERENCES `equipment_inventories` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `equipment_inv_lines_item_fk`
    FOREIGN KEY (`equipment_id`) REFERENCES `equipment_items` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `equipment_inv_lines_room_fk`
    FOREIGN KEY (`expected_room_id`) REFERENCES `equipment_rooms` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `equipment_inv_lines_user_fk`
    FOREIGN KEY (`scanned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed výchozích skupin (pokud ještě neexistují)
INSERT IGNORE INTO `equipment_categories` (`name`, `code`, `description`, `is_active`)
VALUES
  ('Výpočetní a komunikační technika', 'IT', 'Počítače, telefony, tiskárny, síťová technika', 1),
  ('Bílá technika', 'WHITE', 'Ledničky, mikrovlnky a další bílá technika', 1),
  ('Nářadí', 'TOOLS', 'Ruční a elektrické nářadí', 1);
