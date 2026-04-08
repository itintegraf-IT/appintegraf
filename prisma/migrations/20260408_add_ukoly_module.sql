-- Modul Úkoly: tabulky ukoly + ukoly_departments
-- Spusťte ručně v MySQL (phpMyAdmin / klient), pokud nepoužíváte `prisma db push`.
-- Charset odpovídá zbytku aplikace (utf8mb4).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `ukoly` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `body` TEXT NOT NULL,
  `order_number` VARCHAR(100) NULL,
  `assigned_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `due_at` DATETIME(0) NOT NULL,
  `urgent` BOOLEAN NOT NULL DEFAULT FALSE,
  `assignee_user_id` INT NULL,
  `created_by` INT NOT NULL,
  `attachment_path` VARCHAR(500) NULL,
  `attachment_original_name` VARCHAR(255) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'open',
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ukoly_assignee` (`assignee_user_id`),
  KEY `idx_ukoly_creator` (`created_by`),
  KEY `idx_ukoly_due` (`due_at`),
  CONSTRAINT `ukoly_assignee_fk` FOREIGN KEY (`assignee_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `ukoly_creator_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ukoly_departments` (
  `ukol_id` INT NOT NULL,
  `department_id` INT NOT NULL,
  PRIMARY KEY (`ukol_id`, `department_id`),
  KEY `idx_ukoly_departments_dept` (`department_id`),
  CONSTRAINT `ukoly_departments_ukol_fk` FOREIGN KEY (`ukol_id`) REFERENCES `ukoly` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `ukoly_departments_dept_fk` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
