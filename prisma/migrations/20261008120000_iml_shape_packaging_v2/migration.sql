-- IML v2: materiálová matice + zákazníci u tvaru, primary_machine, Fénix pole na produktu

ALTER TABLE `iml_products`
  ADD COLUMN `raw_data_width_mm` DECIMAL(6, 2) NULL AFTER `format_height_mm`,
  ADD COLUMN `raw_data_height_mm` DECIMAL(6, 2) NULL AFTER `raw_data_width_mm`,
  ADD COLUMN `colors_spec` VARCHAR(100) NULL AFTER `raw_data_height_mm`;

ALTER TABLE `iml_tool_catalog`
  ADD COLUMN `primary_machine` VARCHAR(50) NULL AFTER `technology`;

CREATE TABLE IF NOT EXISTS `iml_shape_customer_assignment` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `shape_id` INT NOT NULL,
  `customer_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `iml_shape_customer_assignment_shape_id_customer_id_key` (`shape_id`, `customer_id`),
  KEY `iml_shape_customer_assignment_customer_id_idx` (`customer_id`),
  CONSTRAINT `iml_shape_customer_assignment_shape_id_fkey`
    FOREIGN KEY (`shape_id`) REFERENCES `iml_shape_catalog` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `iml_shape_customer_assignment_customer_id_fkey`
    FOREIGN KEY (`customer_id`) REFERENCES `iml_customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `iml_shape_material_packaging` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `shape_id` INT NOT NULL,
  `material_code` VARCHAR(30) NOT NULL,
  `weight_per_thousand` DECIMAL(8, 3) NOT NULL DEFAULT 0.000,
  `pcs_per_box` INT NOT NULL DEFAULT 0,
  `pcs_per_pallet` INT NOT NULL DEFAULT 0,
  `box_type` VARCHAR(50) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `iml_shape_material_packaging_shape_id_material_code_key` (`shape_id`, `material_code`),
  KEY `iml_shape_material_packaging_material_code_idx` (`material_code`),
  CONSTRAINT `iml_shape_material_packaging_shape_id_fkey`
    FOREIGN KEY (`shape_id`) REFERENCES `iml_shape_catalog` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrace hmotností z PRIMARY nástroje → matice tvaru (EUP50 / EUP60)
INSERT INTO `iml_shape_material_packaging`
  (`shape_id`, `material_code`, `weight_per_thousand`, `pcs_per_box`, `pcs_per_pallet`)
SELECT a.`shape_id`, 'EUP50', t.`weight_50g`, 0, 0
FROM `iml_shape_tool_assignment` a
INNER JOIN `iml_tool_catalog` t ON t.`id` = a.`tool_id`
WHERE a.`priority` = 'PRIMARY' AND t.`weight_50g` IS NOT NULL
ON DUPLICATE KEY UPDATE `weight_per_thousand` = VALUES(`weight_per_thousand`);

INSERT INTO `iml_shape_material_packaging`
  (`shape_id`, `material_code`, `weight_per_thousand`, `pcs_per_box`, `pcs_per_pallet`)
SELECT a.`shape_id`, 'EUP60', t.`weight_60g`, 0, 0
FROM `iml_shape_tool_assignment` a
INNER JOIN `iml_tool_catalog` t ON t.`id` = a.`tool_id`
WHERE a.`priority` = 'PRIMARY' AND t.`weight_60g` IS NOT NULL
ON DUPLICATE KEY UPDATE `weight_per_thousand` = VALUES(`weight_per_thousand`);
