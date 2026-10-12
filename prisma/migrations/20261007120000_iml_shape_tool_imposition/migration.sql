-- Tříúrovňový katalog výseků: tvar → nástroj → montáž + FK na produktech

CREATE TABLE IF NOT EXISTS `iml_shape_catalog` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `shape_code` VARCHAR(30) NOT NULL,
  `shape_type` VARCHAR(20) NOT NULL,
  `width_mm` DECIMAL(6, 2) NOT NULL,
  `height_mm` DECIMAL(6, 2) NOT NULL,
  `internal_note` VARCHAR(255) NULL,
  `drawing_file_path` VARCHAR(255) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `iml_shape_catalog_shape_code_key` (`shape_code`),
  INDEX `iml_shape_catalog_shape_type_idx` (`shape_type`),
  INDEX `iml_shape_catalog_width_mm_height_mm_idx` (`width_mm`, `height_mm`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `iml_tool_catalog` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tool_code_new` VARCHAR(30) NOT NULL,
  `tool_code_orig` VARCHAR(30) NOT NULL,
  `technology` VARCHAR(30) NOT NULL,
  `weight_50g` DECIMAL(6, 3) NULL,
  `weight_60g` DECIMAL(6, 3) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  `note` TEXT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `iml_tool_catalog_tool_code_new_key` (`tool_code_new`),
  INDEX `iml_tool_catalog_tool_code_orig_idx` (`tool_code_orig`),
  INDEX `iml_tool_catalog_technology_idx` (`technology`),
  INDEX `iml_tool_catalog_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `iml_shape_tool_assignment` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `shape_id` INT NOT NULL,
  `tool_id` INT NOT NULL,
  `priority` VARCHAR(10) NOT NULL DEFAULT 'PRIMARY',
  PRIMARY KEY (`id`),
  UNIQUE KEY `iml_shape_tool_assignment_shape_id_tool_id_key` (`shape_id`, `tool_id`),
  UNIQUE KEY `iml_shape_tool_assignment_shape_id_priority_key` (`shape_id`, `priority`),
  INDEX `iml_shape_tool_assignment_tool_id_idx` (`tool_id`),
  CONSTRAINT `iml_shape_tool_assignment_shape_id_fkey`
    FOREIGN KEY (`shape_id`) REFERENCES `iml_shape_catalog` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `iml_shape_tool_assignment_tool_id_fkey`
    FOREIGN KEY (`tool_id`) REFERENCES `iml_tool_catalog` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `iml_imposition_catalog` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tool_id` INT NOT NULL,
  `imposition_code` VARCHAR(30) NOT NULL,
  `positions_count` INT NOT NULL,
  `layout_type` VARCHAR(10) NOT NULL DEFAULT 'SOLO',
  `description` VARCHAR(255) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `iml_imposition_catalog_imposition_code_idx` (`imposition_code`),
  INDEX `iml_imposition_catalog_tool_id_idx` (`tool_id`),
  CONSTRAINT `iml_imposition_catalog_tool_id_fkey`
    FOREIGN KEY (`tool_id`) REFERENCES `iml_tool_catalog` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `iml_products`
  ADD COLUMN `shape_id` INT NULL AFTER `die_cut_id`,
  ADD COLUMN `selected_tool_id` INT NULL AFTER `shape_id`,
  ADD COLUMN `selected_imposition_id` INT NULL AFTER `selected_tool_id`,
  ADD COLUMN `box_type_id` INT NULL AFTER `selected_imposition_id`,
  ADD COLUMN `boxes_per_pallet` INT NULL AFTER `box_type_id`,
  ADD COLUMN `pallet_weight` DECIMAL(8, 2) NULL AFTER `boxes_per_pallet`;

CREATE INDEX `iml_products_shape_id_idx` ON `iml_products` (`shape_id`);
CREATE INDEX `iml_products_selected_tool_id_idx` ON `iml_products` (`selected_tool_id`);
CREATE INDEX `iml_products_selected_imposition_id_idx` ON `iml_products` (`selected_imposition_id`);
CREATE INDEX `iml_products_box_type_id_idx` ON `iml_products` (`box_type_id`);

ALTER TABLE `iml_products`
  ADD CONSTRAINT `iml_products_shape_id_fkey`
    FOREIGN KEY (`shape_id`) REFERENCES `iml_shape_catalog` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `iml_products_selected_tool_id_fkey`
    FOREIGN KEY (`selected_tool_id`) REFERENCES `iml_tool_catalog` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `iml_products_selected_imposition_id_fkey`
    FOREIGN KEY (`selected_imposition_id`) REFERENCES `iml_imposition_catalog` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `iml_products_box_type_id_fkey`
    FOREIGN KEY (`box_type_id`) REFERENCES `iml_box_types` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
