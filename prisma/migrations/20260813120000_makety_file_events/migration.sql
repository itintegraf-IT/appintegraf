-- Audit stopa souborů a workflow u makety/grafiky
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `makety_file_events` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `maketa_id` INT NOT NULL,
  `file_id` INT NULL,
  `event_type` VARCHAR(40) NOT NULL,
  `user_id` INT NULL,
  `meta` JSON NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  INDEX `idx_makety_file_events_maketa` (`maketa_id`),
  INDEX `idx_makety_file_events_file` (`file_id`),
  INDEX `idx_makety_file_events_created` (`created_at`),
  CONSTRAINT `makety_file_events_maketa_fk`
    FOREIGN KEY (`maketa_id`) REFERENCES `makety`(`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `makety_file_events_user_fk`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
