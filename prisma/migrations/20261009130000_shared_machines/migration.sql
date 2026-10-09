-- Společný číselník strojů – plná migrace dat je ve skriptu:
--   npm run db:shared-machines-migrate
-- Tento SQL slouží jako dokumentace / fallback CREATE.
SET NAMES utf8mb4;

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
