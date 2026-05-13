CREATE TABLE IF NOT EXISTS `shared_mails` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(100) NOT NULL,
  `label` varchar(150) NOT NULL,
  `sort_order` int DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp(0) NOT NULL DEFAULT (now()),
  `updated_at` timestamp(0) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_shared_mails_email` (`email`),
  KEY `idx_shared_mails_active` (`is_active`),
  KEY `idx_shared_mails_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_shared_mails` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `shared_mail_id` int NOT NULL,
  `created_at` timestamp(0) NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_shared_mail` (`user_id`, `shared_mail_id`),
  KEY `idx_user_shared_mails_shared` (`shared_mail_id`),
  KEY `idx_user_shared_mails_user` (`user_id`),
  CONSTRAINT `user_shared_mails_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `user_shared_mails_shared_fk` FOREIGN KEY (`shared_mail_id`) REFERENCES `shared_mails` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
