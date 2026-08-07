-- Interaktivní půdorysy: plány + polygony místností

CREATE TABLE IF NOT EXISTS `equipment_floor_plans` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `floor_label` VARCHAR(40) NOT NULL,
  `building` VARCHAR(100) NULL,
  `image_path` VARCHAR(500) NOT NULL,
  `image_width` INT NULL,
  `image_height` INT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_eq_floor_plans_active_sort` (`is_active`, `sort_order`),
  CONSTRAINT `equipment_floor_plans_user_fk`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `equipment_rooms`
  ADD COLUMN `floor_plan_id` INT NULL AFTER `is_active`,
  ADD COLUMN `polygon_json` LONGTEXT NULL AFTER `floor_plan_id`,
  ADD COLUMN `plan_color` VARCHAR(20) NULL AFTER `polygon_json`,
  ADD INDEX `idx_equipment_rooms_floor_plan` (`floor_plan_id`),
  ADD CONSTRAINT `equipment_rooms_floor_plan_fk`
    FOREIGN KEY (`floor_plan_id`) REFERENCES `equipment_floor_plans` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
