-- Audit log přesměrování schvalování požadavků na techniku
SET NAMES utf8mb4;

CREATE TABLE `equipment_request_workflow_log` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `request_id` INT NOT NULL,
  `action` ENUM('reassign', 'return_to_it') NOT NULL,
  `actor_user_id` INT NOT NULL,
  `from_user_id` INT NULL,
  `to_user_id` INT NULL,
  `comment` TEXT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  INDEX `idx_equipment_workflow_request` (`request_id`),
  INDEX `idx_equipment_workflow_created` (`created_at`),
  CONSTRAINT `equipment_workflow_log_request_fk`
    FOREIGN KEY (`request_id`) REFERENCES `equipment_requests` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `equipment_workflow_log_actor_fk`
    FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON UPDATE NO ACTION,
  CONSTRAINT `equipment_workflow_log_from_fk`
    FOREIGN KEY (`from_user_id`) REFERENCES `users` (`id`) ON UPDATE NO ACTION,
  CONSTRAINT `equipment_workflow_log_to_fk`
    FOREIGN KEY (`to_user_id`) REFERENCES `users` (`id`) ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
