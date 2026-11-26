-- Evoluce montáží: nullable tool, hlavička z Technologií, tabulka užitků, UNIQUE kód
SET NAMES utf8mb4;

-- Deduplikace kódů před UNIQUE (případné kolize → suffix -id)
UPDATE `iml_imposition_catalog` i
INNER JOIN (
  SELECT `imposition_code`
  FROM `iml_imposition_catalog`
  GROUP BY `imposition_code`
  HAVING COUNT(*) > 1
) d ON d.`imposition_code` = i.`imposition_code`
SET i.`imposition_code` = CONCAT(LEFT(i.`imposition_code`, 50), '-', i.`id`);

-- FK tool: drop před změnou nullability
SET @fk := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'iml_imposition_catalog'
    AND COLUMN_NAME = 'tool_id'
    AND REFERENCED_TABLE_NAME = 'iml_tool_catalog'
  LIMIT 1
);
SET @sql := IF(@fk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `iml_imposition_catalog` DROP FOREIGN KEY `', @fk, '`'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `iml_imposition_catalog`
  MODIFY COLUMN `tool_id` INT NULL,
  MODIFY COLUMN `imposition_code` VARCHAR(60) NOT NULL,
  ADD COLUMN `sheet_size_id` INT NULL AFTER `description`,
  ADD COLUMN `print_machine_id` INT NULL AFTER `sheet_size_id`,
  ADD COLUMN `die_cut_device_id` INT NULL AFTER `print_machine_id`,
  ADD COLUMN `is_cut_only` TINYINT(1) NOT NULL DEFAULT 0 AFTER `die_cut_device_id`;

ALTER TABLE `iml_imposition_catalog`
  ADD CONSTRAINT `iml_imposition_tool_fk`
    FOREIGN KEY (`tool_id`) REFERENCES `iml_tool_catalog`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `iml_imposition_sheet_size_fk`
    FOREIGN KEY (`sheet_size_id`) REFERENCES `technologie_sheet_sizes`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `iml_imposition_print_machine_fk`
    FOREIGN KEY (`print_machine_id`) REFERENCES `shared_machines`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `iml_imposition_die_cut_device_fk`
    FOREIGN KEY (`die_cut_device_id`) REFERENCES `technologie_die_cut_devices`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- UNIQUE kód montáže (starý non-unique index nevadí)
SET @idx := (
  SELECT INDEX_NAME FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'iml_imposition_catalog'
    AND INDEX_NAME = 'iml_imposition_catalog_imposition_code_key'
  LIMIT 1
);
SET @sql := IF(@idx IS NULL,
  'ALTER TABLE `iml_imposition_catalog` ADD UNIQUE KEY `iml_imposition_catalog_imposition_code_key` (`imposition_code`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `iml_imposition_shapes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `imposition_id` INT NOT NULL,
  `shape_id` INT NOT NULL,
  `positions_on_sheet` INT NOT NULL,
  `is_primary` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `iml_imposition_shapes_imposition_id_shape_id_key` (`imposition_id`, `shape_id`),
  KEY `iml_imposition_shapes_shape_id_idx` (`shape_id`),
  KEY `iml_imposition_shapes_shape_primary_idx` (`shape_id`, `is_primary`),
  CONSTRAINT `iml_imposition_shapes_imposition_fk`
    FOREIGN KEY (`imposition_id`) REFERENCES `iml_imposition_catalog`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `iml_imposition_shapes_shape_fk`
    FOREIGN KEY (`shape_id`) REFERENCES `iml_shape_catalog`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill SOLO užitků: právě jeden tvar s PRIMARY na stejném nástroji
INSERT INTO `iml_imposition_shapes` (`imposition_id`, `shape_id`, `positions_on_sheet`, `is_primary`)
SELECT i.`id`, a.`shape_id`, i.`positions_count`, TRUE
FROM `iml_imposition_catalog` i
INNER JOIN `iml_shape_tool_assignment` a
  ON a.`tool_id` = i.`tool_id` AND a.`priority` = 'PRIMARY'
WHERE i.`tool_id` IS NOT NULL
  AND (
    SELECT COUNT(*) FROM `iml_shape_tool_assignment` a2
    WHERE a2.`tool_id` = i.`tool_id` AND a2.`priority` = 'PRIMARY'
  ) = 1
  AND NOT EXISTS (
    SELECT 1 FROM `iml_imposition_shapes` s WHERE s.`imposition_id` = i.`id`
  );
