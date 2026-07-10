CREATE TABLE IF NOT EXISTS `calendar_resources` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `resource_type` varchar(20) NOT NULL,
  `description` text DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `plate_number` varchar(20) DEFAULT NULL,
  `capacity` int DEFAULT NULL,
  `color` varchar(7) DEFAULT '#2563EB',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp(0) NOT NULL DEFAULT (now()),
  `updated_at` timestamp(0) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  KEY `idx_calendar_resources_type_active` (`resource_type`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `resource_reservations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `resource_id` int NOT NULL,
  `created_by` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `purpose` varchar(500) DEFAULT NULL,
  `start_date` datetime(0) NOT NULL,
  `end_date` datetime(0) NOT NULL,
  `approval_status` varchar(20) NOT NULL,
  `approver_id` int DEFAULT NULL,
  `assigned_approver_id` int DEFAULT NULL,
  `rejection_comment` text DEFAULT NULL,
  `approved_at` datetime(0) DEFAULT NULL,
  `created_at` timestamp(0) NOT NULL DEFAULT (now()),
  `updated_at` timestamp(0) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  KEY `idx_resource_reservations_resource_range` (`resource_id`, `start_date`, `end_date`),
  KEY `idx_resource_reservations_status` (`approval_status`),
  KEY `idx_resource_reservations_created_by` (`created_by`),
  KEY `idx_resource_reservations_assigned` (`assigned_approver_id`),
  CONSTRAINT `resource_reservations_resource_fk` FOREIGN KEY (`resource_id`) REFERENCES `calendar_resources` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `resource_reservations_created_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `resource_reservations_approver_fk` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `resource_reservations_assigned_fk` FOREIGN KEY (`assigned_approver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `resource_vehicle_approvers` (
  `id` int NOT NULL DEFAULT 1,
  `primary_user_id` int NOT NULL,
  `secondary_user_id` int DEFAULT NULL,
  `tertiary_user_id` int DEFAULT NULL,
  `created_at` timestamp(0) NOT NULL DEFAULT (now()),
  `updated_at` timestamp(0) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  CONSTRAINT `vehicle_approvers_primary_fk` FOREIGN KEY (`primary_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `vehicle_approvers_secondary_fk` FOREIGN KEY (`secondary_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `vehicle_approvers_tertiary_fk` FOREIGN KEY (`tertiary_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `roles` (`name`, `description`, `is_active`)
SELECT 'sprava_vozidel', 'Správa vozidel – schvalování rezervací aut', 1
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `name` = 'sprava_vozidel');
