-- Modul CRM: tabulky pro firmy, kontakty, obchody, aktivity, AI a Graph sync
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `crm_companies` (
  `id` VARCHAR(30) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `ico` VARCHAR(20) NULL,
  `dic` VARCHAR(20) NULL,
  `address` TEXT NULL,
  `segment` VARCHAR(100) NULL,
  `tags` JSON NULL,
  `owner_id` INT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `crm_companies_ico_key` (`ico`),
  KEY `idx_crm_companies_name` (`name`),
  KEY `idx_crm_companies_owner` (`owner_id`),
  CONSTRAINT `crm_companies_owner_fk` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_contacts` (
  `id` VARCHAR(30) NOT NULL,
  `company_id` VARCHAR(30) NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `role` VARCHAR(100) NULL,
  `email` VARCHAR(255) NULL,
  `phone` VARCHAR(50) NULL,
  `is_decision_maker` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `crm_contacts_email_key` (`email`),
  KEY `idx_crm_contacts_company` (`company_id`),
  CONSTRAINT `crm_contacts_company_fk` FOREIGN KEY (`company_id`) REFERENCES `crm_companies` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_deal_categories` (
  `id` VARCHAR(30) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `label` VARCHAR(100) NOT NULL,
  `color` VARCHAR(20) NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `crm_deal_categories_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_lost_reasons` (
  `id` VARCHAR(30) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `label` VARCHAR(100) NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `crm_lost_reasons_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_deals` (
  `id` VARCHAR(30) NOT NULL,
  `number` VARCHAR(50) NOT NULL,
  `company_id` VARCHAR(30) NOT NULL,
  `owner_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `stage` ENUM('LEAD','QUALIFIED','NABIDKA','JEDNANI','WON','LOST','CANCELLED') NOT NULL DEFAULT 'LEAD',
  `value` DECIMAL(12,2) NOT NULL,
  `probability` INT NOT NULL DEFAULT 10,
  `close_date` DATETIME(0) NULL,
  `lost_reason` VARCHAR(100) NULL,
  `category_id` VARCHAR(30) NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `crm_deals_number_key` (`number`),
  KEY `idx_crm_deals_company` (`company_id`),
  KEY `idx_crm_deals_owner` (`owner_id`),
  KEY `idx_crm_deals_stage` (`stage`),
  KEY `idx_crm_deals_category` (`category_id`),
  KEY `idx_crm_deals_close_date` (`close_date`),
  CONSTRAINT `crm_deals_company_fk` FOREIGN KEY (`company_id`) REFERENCES `crm_companies` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `crm_deals_owner_fk` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT `crm_deals_category_fk` FOREIGN KEY (`category_id`) REFERENCES `crm_deal_categories` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_deal_contacts` (
  `deal_id` VARCHAR(30) NOT NULL,
  `contact_id` VARCHAR(30) NOT NULL,
  `role_in_deal` VARCHAR(100) NULL,
  PRIMARY KEY (`deal_id`, `contact_id`),
  KEY `idx_crm_deal_contacts_contact` (`contact_id`),
  CONSTRAINT `crm_deal_contacts_deal_fk` FOREIGN KEY (`deal_id`) REFERENCES `crm_deals` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `crm_deal_contacts_contact_fk` FOREIGN KEY (`contact_id`) REFERENCES `crm_contacts` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_activities` (
  `id` VARCHAR(30) NOT NULL,
  `parent_type` ENUM('COMPANY','CONTACT','DEAL') NOT NULL,
  `parent_id` VARCHAR(30) NOT NULL,
  `type` ENUM('CALL','MEETING','EMAIL','REMINDER','NOTE') NOT NULL,
  `date` DATETIME(0) NOT NULL,
  `duration` INT NULL,
  `note` TEXT NULL,
  `outcome` TEXT NULL,
  `next_action_date` DATETIME(0) NULL,
  `owner_id` INT NOT NULL,
  `assignee_id` INT NULL,
  `external_id` VARCHAR(255) NULL,
  `external_source` VARCHAR(50) NULL,
  `completed_at` DATETIME(0) NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `crm_activities_external_id_key` (`external_id`),
  KEY `idx_crm_activities_parent` (`parent_type`, `parent_id`),
  KEY `idx_crm_activities_owner` (`owner_id`),
  KEY `idx_crm_activities_assignee` (`assignee_id`),
  KEY `idx_crm_activities_date` (`date`),
  CONSTRAINT `crm_activities_owner_fk` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT `crm_activities_assignee_fk` FOREIGN KEY (`assignee_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_notes` (
  `id` VARCHAR(30) NOT NULL,
  `parent_type` ENUM('COMPANY','CONTACT','DEAL') NOT NULL,
  `parent_id` VARCHAR(30) NOT NULL,
  `content` TEXT NOT NULL,
  `author_id` INT NULL,
  `mentions` JSON NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_crm_notes_parent` (`parent_type`, `parent_id`),
  KEY `idx_crm_notes_author` (`author_id`),
  CONSTRAINT `crm_notes_author_fk` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_attachments` (
  `id` VARCHAR(30) NOT NULL,
  `parent_type` ENUM('COMPANY','CONTACT','DEAL') NOT NULL,
  `parent_id` VARCHAR(30) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `path` VARCHAR(500) NOT NULL,
  `size` INT NOT NULL,
  `mime` VARCHAR(100) NOT NULL,
  `uploaded_by` INT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_crm_attachments_parent` (`parent_type`, `parent_id`),
  CONSTRAINT `crm_attachments_uploader_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_audit_log` (
  `id` VARCHAR(30) NOT NULL,
  `user_id` INT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` VARCHAR(30) NOT NULL,
  `action` ENUM('CREATE','UPDATE','DELETE') NOT NULL,
  `diff` JSON NOT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_crm_audit_entity` (`entity_type`, `entity_id`),
  KEY `idx_crm_audit_user` (`user_id`),
  KEY `idx_crm_audit_created` (`created_at`),
  CONSTRAINT `crm_audit_log_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_notifications` (
  `id` VARCHAR(30) NOT NULL,
  `user_id` INT NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `payload` JSON NOT NULL,
  `read_at` DATETIME(0) NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_crm_notifications_user_read` (`user_id`, `read_at`),
  CONSTRAINT `crm_notifications_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_ai_insights` (
  `id` VARCHAR(30) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` VARCHAR(30) NOT NULL,
  `insight_type` VARCHAR(50) NOT NULL,
  `content` TEXT NOT NULL,
  `model` VARCHAR(50) NOT NULL,
  `tokens` INT NOT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `invalidated_at` DATETIME(0) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_crm_ai_insights_entity` (`entity_type`, `entity_id`, `insight_type`),
  KEY `idx_crm_ai_insights_invalidated` (`invalidated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_ai_usage` (
  `id` VARCHAR(30) NOT NULL,
  `user_id` INT NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `tokens` INT NOT NULL DEFAULT 0,
  `model` VARCHAR(50) NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_crm_ai_usage_user_action` (`user_id`, `action`, `created_at`),
  KEY `idx_crm_ai_usage_created` (`created_at`),
  CONSTRAINT `crm_ai_usage_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_graph_sync_state` (
  `id` VARCHAR(30) NOT NULL,
  `user_id` INT NOT NULL,
  `inbox_delta` TEXT NULL,
  `sent_delta` TEXT NULL,
  `last_sync_at` DATETIME(0) NULL,
  `last_error_at` DATETIME(0) NULL,
  `last_error_msg` TEXT NULL,
  `error_count` INT NOT NULL DEFAULT 0,
  `backoff_until` DATETIME(0) NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `crm_graph_sync_state_user_id_key` (`user_id`),
  KEY `idx_crm_graph_sync_backoff` (`backoff_until`),
  KEY `idx_crm_graph_sync_last` (`last_sync_at`),
  CONSTRAINT `crm_graph_sync_state_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_graph_accounts` (
  `id` VARCHAR(30) NOT NULL,
  `user_id` INT NOT NULL,
  `provider` VARCHAR(50) NOT NULL,
  `provider_account_id` VARCHAR(255) NOT NULL,
  `access_token` TEXT NULL,
  `refresh_token` TEXT NULL,
  `expires_at` INT NULL,
  `token_type` VARCHAR(50) NULL,
  `scope` TEXT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_crm_graph_accounts_provider` (`provider`, `provider_account_id`),
  KEY `idx_crm_graph_accounts_user` (`user_id`),
  CONSTRAINT `crm_graph_accounts_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
