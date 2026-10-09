-- Modul Technologie – rozkresy tiskových archů
-- Tiskové stroje: společný číselník shared_machines (viz migrace shared_machines)
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `technologie_sheet_types` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_technologie_sheet_types_active` (`is_active`),
  KEY `idx_technologie_sheet_types_sort` (`sort_order`),
  KEY `idx_technologie_sheet_types_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shared_machines` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `machine_group` VARCHAR(20) NOT NULL DEFAULT 'postpress',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_shared_machines_active` (`is_active`),
  KEY `idx_shared_machines_sort` (`sort_order`),
  KEY `idx_shared_machines_name` (`name`),
  KEY `idx_shared_machines_group` (`machine_group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `technologie` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(32) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `sheet_type_id` INT NULL,
  `format_text` VARCHAR(64) NULL,
  `sheet_size_text` VARCHAR(64) NULL,
  `print_machine_id` INT NULL,
  `note` TEXT NULL,
  `preview_updated_at` DATETIME NULL,
  `created_by` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `technologie_code` (`code`),
  KEY `idx_technologie_code` (`code`),
  KEY `idx_technologie_name` (`name`),
  KEY `idx_technologie_sheet_type` (`sheet_type_id`),
  KEY `idx_technologie_print_machine` (`print_machine_id`),
  KEY `idx_technologie_created_by` (`created_by`),
  KEY `idx_technologie_created_at` (`created_at`),
  KEY `idx_technologie_updated_at` (`updated_at`),
  CONSTRAINT `technologie_sheet_type_fk` FOREIGN KEY (`sheet_type_id`) REFERENCES `technologie_sheet_types` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `technologie_print_machine_fk` FOREIGN KEY (`print_machine_id`) REFERENCES `shared_machines` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `technologie_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `technologie_sheet_types` (`name`, `sort_order`, `is_active`)
SELECT * FROM (
  SELECT 'volný list' AS name, 0 AS sort_order, TRUE AS is_active
  UNION ALL SELECT 'V1', 1, TRUE
  UNION ALL SELECT 'V2', 2, TRUE
  UNION ALL SELECT 'V4', 3, TRUE
  UNION ALL SELECT 'V8', 4, TRUE
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM `technologie_sheet_types` LIMIT 1);

INSERT INTO `shared_machines` (`name`, `machine_group`, `sort_order`, `is_active`)
SELECT * FROM (
  SELECT 'XL 105' AS name, 'press' AS machine_group, 0 AS sort_order, TRUE AS is_active
  UNION ALL SELECT 'XL 106', 'press', 1, TRUE
  UNION ALL SELECT 'XL105/106', 'press', 2, TRUE
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM `shared_machines` WHERE `name` IN ('XL 105', 'XL 106', 'XL105/106') LIMIT 1
);
