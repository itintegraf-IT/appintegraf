-- Schvalovatelé kalendáře per oddělení (primární / sekundární / terciární)
CREATE TABLE IF NOT EXISTS `calendar_department_approvers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `department_id` int NOT NULL,
  `primary_user_id` int NOT NULL,
  `secondary_user_id` int DEFAULT NULL,
  `tertiary_user_id` int DEFAULT NULL,
  `created_at` timestamp(0) NOT NULL DEFAULT (now()),
  `updated_at` timestamp(0) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_calendar_dept_approvers_dept` (`department_id`),
  KEY `idx_calendar_dept_approvers_primary` (`primary_user_id`),
  KEY `idx_calendar_dept_approvers_secondary` (`secondary_user_id`),
  KEY `idx_calendar_dept_approvers_tertiary` (`tertiary_user_id`),
  CONSTRAINT `calendar_dept_approvers_dept_fk` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `calendar_dept_approvers_primary_fk` FOREIGN KEY (`primary_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `calendar_dept_approvers_secondary_fk` FOREIGN KEY (`secondary_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `calendar_dept_approvers_tertiary_fk` FOREIGN KEY (`tertiary_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
