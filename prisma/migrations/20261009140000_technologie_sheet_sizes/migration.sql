-- Číselník velikostí tiskových archů + FK místo volného textu
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `technologie_sheet_sizes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(64) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_technologie_sheet_sizes_active` (`is_active`),
  KEY `idx_technologie_sheet_sizes_sort` (`sort_order`),
  KEY `idx_technologie_sheet_sizes_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `technologie_sheet_sizes` (`name`, `sort_order`, `is_active`)
SELECT * FROM (
  SELECT '1020x720' AS name, 0 AS sort_order, TRUE AS is_active
  UNION ALL SELECT '1000x700', 1, TRUE
  UNION ALL SELECT '900x640', 2, TRUE
  UNION ALL SELECT '900x630', 3, TRUE
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM `technologie_sheet_sizes` LIMIT 1);
