-- Číselník výsekových zařízení + FK na technologie
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `technologie_die_cut_devices` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_technologie_die_cut_devices_active` (`is_active`),
  KEY `idx_technologie_die_cut_devices_sort` (`sort_order`),
  KEY `idx_technologie_die_cut_devices_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `technologie_die_cut_devices` (`name`, `sort_order`, `is_active`)
SELECT * FROM (
  SELECT 'Montex' AS name, 10 AS sort_order, TRUE AS is_active
  UNION ALL SELECT 'Atlas', 20, TRUE
  UNION ALL SELECT 'Ruční protlačovák', 30, TRUE
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM `technologie_die_cut_devices` LIMIT 1);

ALTER TABLE `technologie`
  ADD COLUMN `die_cut_device_id` INT NULL;

CREATE INDEX `idx_technologie_die_cut_device` ON `technologie`(`die_cut_device_id`);

ALTER TABLE `technologie`
  ADD CONSTRAINT `technologie_die_cut_device_fk`
  FOREIGN KEY (`die_cut_device_id`) REFERENCES `technologie_die_cut_devices`(`id`)
  ON DELETE SET NULL ON UPDATE NO ACTION;
