-- Modul Makety: tabulky makety, makety_departments, makety_comments
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `makety` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `body` TEXT NOT NULL,
  `order_number` VARCHAR(100) NULL,
  `material` VARCHAR(255) NULL,
  `dimensions` VARCHAR(255) NULL,
  `quantity` INT NULL,
  `priority` VARCHAR(20) NOT NULL DEFAULT 'normal',
  `assigned_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `due_at` DATETIME(0) NOT NULL,
  `assignee_user_id` INT NULL,
  `created_by` INT NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'open',
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_makety_assignee` (`assignee_user_id`),
  KEY `idx_makety_creator` (`created_by`),
  KEY `idx_makety_due` (`due_at`),
  KEY `idx_makety_status` (`status`),
  CONSTRAINT `makety_assignee_fk` FOREIGN KEY (`assignee_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `makety_creator_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `makety_departments` (
  `maketa_id` INT NOT NULL,
  `department_id` INT NOT NULL,
  PRIMARY KEY (`maketa_id`, `department_id`),
  KEY `idx_makety_departments_dept` (`department_id`),
  CONSTRAINT `makety_departments_maketa_fk` FOREIGN KEY (`maketa_id`) REFERENCES `makety` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `makety_departments_dept_fk` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `makety_comments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `maketa_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `body` TEXT NOT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_makety_comments_maketa` (`maketa_id`),
  KEY `idx_makety_comments_user` (`user_id`),
  CONSTRAINT `makety_comments_maketa_fk` FOREIGN KEY (`maketa_id`) REFERENCES `makety` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `makety_comments_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
