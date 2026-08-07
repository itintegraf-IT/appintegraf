-- Globální katalog výseků IML + vazba na produkt (die_cut_id).
-- Unikátní klíč: label_shape_code (kód tvaru etikety).

CREATE TABLE IF NOT EXISTS `iml_die_cuts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `label_shape_code` VARCHAR(100) NOT NULL,
  `die_cut_tool_code` VARCHAR(100) NULL,
  `assembly_code` VARCHAR(100) NULL,
  `positions_on_sheet` INT NULL,
  `labels_per_sheet` INT NULL,
  `pieces_per_box` INT NULL,
  `pieces_per_pallet` INT NULL,
  `note` TEXT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  UNIQUE KEY `iml_die_cuts_label_shape_code_key` (`label_shape_code`),
  KEY `iml_die_cuts_is_active_idx` (`is_active`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill: jeden výsek na každý neprázdný kód tvaru z produktů (agregace MAX pro čísla).
INSERT INTO `iml_die_cuts` (
  `label_shape_code`,
  `die_cut_tool_code`,
  `assembly_code`,
  `positions_on_sheet`,
  `labels_per_sheet`,
  `pieces_per_box`,
  `pieces_per_pallet`,
  `is_active`
)
SELECT
  TRIM(p.`label_shape_code`) AS label_shape_code,
  MAX(NULLIF(TRIM(p.`die_cut_tool_code`), '')) AS die_cut_tool_code,
  MAX(NULLIF(TRIM(p.`assembly_code`), '')) AS assembly_code,
  MAX(p.`positions_on_sheet`) AS positions_on_sheet,
  MAX(p.`labels_per_sheet`) AS labels_per_sheet,
  MAX(p.`pieces_per_box`) AS pieces_per_box,
  MAX(p.`pieces_per_pallet`) AS pieces_per_pallet,
  TRUE
FROM `iml_products` p
WHERE p.`label_shape_code` IS NOT NULL
  AND TRIM(p.`label_shape_code`) <> ''
GROUP BY TRIM(p.`label_shape_code`)
ON DUPLICATE KEY UPDATE
  `die_cut_tool_code` = COALESCE(VALUES(`die_cut_tool_code`), `iml_die_cuts`.`die_cut_tool_code`),
  `assembly_code` = COALESCE(VALUES(`assembly_code`), `iml_die_cuts`.`assembly_code`),
  `positions_on_sheet` = COALESCE(VALUES(`positions_on_sheet`), `iml_die_cuts`.`positions_on_sheet`),
  `labels_per_sheet` = COALESCE(VALUES(`labels_per_sheet`), `iml_die_cuts`.`labels_per_sheet`),
  `pieces_per_box` = COALESCE(VALUES(`pieces_per_box`), `iml_die_cuts`.`pieces_per_box`),
  `pieces_per_pallet` = COALESCE(VALUES(`pieces_per_pallet`), `iml_die_cuts`.`pieces_per_pallet`);

ALTER TABLE `iml_products`
  ADD COLUMN `die_cut_id` INT NULL AFTER `labels_per_sheet`;

UPDATE `iml_products` p
INNER JOIN `iml_die_cuts` d ON d.`label_shape_code` = TRIM(p.`label_shape_code`)
SET p.`die_cut_id` = d.`id`
WHERE p.`label_shape_code` IS NOT NULL
  AND TRIM(p.`label_shape_code`) <> ''
  AND p.`die_cut_id` IS NULL;

ALTER TABLE `iml_products`
  ADD INDEX `iml_products_die_cut_id_idx` (`die_cut_id`),
  ADD CONSTRAINT `iml_products_die_cut_id_fkey`
    FOREIGN KEY (`die_cut_id`) REFERENCES `iml_die_cuts`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
