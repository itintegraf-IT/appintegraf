-- Modul Helpdesk – IT servis tickety
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `helpdesk_tickets` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `ticket_number` VARCHAR(20) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `category` ENUM('hardware', 'software', 'pristup', 'sit', 'jine') NOT NULL DEFAULT 'jine',
  `priority` ENUM('nizka', 'stredni', 'vysoka') NOT NULL DEFAULT 'stredni',
  `status` ENUM('novy', 'prirazeno', 'resi_se', 'vyreseno', 'uzavreno') NOT NULL DEFAULT 'novy',
  `requester_id` INT NOT NULL,
  `assigned_to_id` INT NULL,
  `resolved_at` TIMESTAMP(0) NULL,
  `closed_at` TIMESTAMP(0) NULL,
  `resolution_note` TEXT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `helpdesk_tickets_ticket_number_key` (`ticket_number`),
  KEY `idx_helpdesk_requester` (`requester_id`),
  KEY `idx_helpdesk_assigned` (`assigned_to_id`),
  KEY `idx_helpdesk_status` (`status`),
  KEY `idx_helpdesk_created` (`created_at`),
  CONSTRAINT `helpdesk_tickets_requester_fk` FOREIGN KEY (`requester_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `helpdesk_tickets_assigned_fk` FOREIGN KEY (`assigned_to_id`) REFERENCES `users` (`id`) ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `helpdesk_comments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `ticket_id` INT NOT NULL,
  `author_id` INT NOT NULL,
  `body` TEXT NOT NULL,
  `is_internal` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_helpdesk_comments_ticket` (`ticket_id`),
  KEY `idx_helpdesk_comments_author` (`author_id`),
  CONSTRAINT `helpdesk_comments_ticket_fk` FOREIGN KEY (`ticket_id`) REFERENCES `helpdesk_tickets` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `helpdesk_comments_author_fk` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
