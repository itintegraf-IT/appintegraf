-- Modul technické výkresy a 3D modely
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `vykresy_machines` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vykresy_machines_active` (`is_active`),
  KEY `idx_vykresy_machines_sort` (`sort_order`),
  KEY `idx_vykresy_machines_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vykresy` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `document_kind` VARCHAR(30) NOT NULL,
  `department_id` INT NULL,
  `machine_id` INT NULL,
  `description` TEXT NULL,
  `created_by` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vykresy_name` (`name`),
  KEY `idx_vykresy_document_kind` (`document_kind`),
  KEY `idx_vykresy_department` (`department_id`),
  KEY `idx_vykresy_machine` (`machine_id`),
  KEY `idx_vykresy_created_by` (`created_by`),
  KEY `idx_vykresy_created_at` (`created_at`),
  CONSTRAINT `vykresy_department_fk` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `vykresy_machine_fk` FOREIGN KEY (`machine_id`) REFERENCES `vykresy_machines` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `vykresy_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
