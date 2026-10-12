-- Číselník typů tvarů etiket (uživatelsky rozšiřitelný)

CREATE TABLE IF NOT EXISTS `iml_shape_types` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `iml_shape_types_code_key` (`code`),
  INDEX `iml_shape_types_is_active_idx` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `iml_shape_types` (`code`, `name`, `is_active`, `sort_order`) VALUES
  ('CUP', 'Vanička', TRUE, 10),
  ('LID', 'Víčko', TRUE, 20),
  ('WRAP', 'Obvodovka', TRUE, 30),
  ('OTHER', 'Jiné', TRUE, 90)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
