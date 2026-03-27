-- Evidence smluv – Fáze 1: tabulky contract_types, contract_workflow_steps, contracts, contract_approvals
-- Spusťte ručně v MySQL (phpMyAdmin / klient), pokud nepoužíváte `prisma db push`.
-- Charset odpovídá zbytku aplikace (utf8mb4).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `contract_types` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) NULL,
  `description` TEXT NULL,
  `sort_order` INT NULL DEFAULT 0,
  `is_active` BOOLEAN NULL DEFAULT TRUE,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_contract_types_code` (`code`),
  KEY `idx_contract_types_active` (`is_active`),
  KEY `idx_contract_types_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contract_workflow_steps` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `contract_type_id` INT NOT NULL,
  `step_order` INT NOT NULL,
  `resolver` VARCHAR(50) NOT NULL,
  `fixed_user_id` INT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_contract_workflow_type_step` (`contract_type_id`, `step_order`),
  KEY `idx_contract_workflow_steps_type` (`contract_type_id`),
  KEY `idx_contract_workflow_steps_resolver` (`resolver`),
  KEY `contract_workflow_steps_fixed_fk` (`fixed_user_id`),
  CONSTRAINT `contract_workflow_steps_type_fk` FOREIGN KEY (`contract_type_id`) REFERENCES `contract_types` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `contract_workflow_steps_fixed_fk` FOREIGN KEY (`fixed_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contracts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(500) NOT NULL,
  `contract_number` VARCHAR(100) NULL,
  `party_company` VARCHAR(255) NULL,
  `party_contact` VARCHAR(255) NULL,
  `contract_type_id` INT NOT NULL,
  `description` TEXT NULL,
  `approval_status` VARCHAR(30) NOT NULL DEFAULT 'draft',
  `value_amount` DECIMAL(15,2) NULL,
  `value_currency` VARCHAR(10) NULL DEFAULT 'CZK',
  `effective_from` DATETIME(0) NULL,
  `valid_until` DATETIME(0) NULL,
  `expires_at` DATETIME(0) NULL,
  `signed_at` DATETIME(0) NULL,
  `created_by` INT NOT NULL,
  `responsible_user_id` INT NULL,
  `department_id` INT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contracts_type` (`contract_type_id`),
  KEY `idx_contracts_approval_status` (`approval_status`),
  KEY `idx_contracts_created_by` (`created_by`),
  KEY `idx_contracts_responsible` (`responsible_user_id`),
  KEY `idx_contracts_department` (`department_id`),
  KEY `idx_contracts_valid_until` (`valid_until`),
  KEY `idx_contracts_number` (`contract_number`),
  CONSTRAINT `contracts_contract_type_fk` FOREIGN KEY (`contract_type_id`) REFERENCES `contract_types` (`id`) ON UPDATE NO ACTION,
  CONSTRAINT `contracts_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON UPDATE NO ACTION,
  CONSTRAINT `contracts_responsible_fk` FOREIGN KEY (`responsible_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `contracts_department_fk` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contract_approvals` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `contract_id` INT NOT NULL,
  `approver_id` INT NOT NULL,
  `approval_type` VARCHAR(50) NULL DEFAULT 'step',
  `approval_order` INT NULL DEFAULT 1,
  `status` VARCHAR(20) NULL DEFAULT 'pending',
  `comment` TEXT NULL,
  `approved_at` DATETIME(0) NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contract_approvals_contract` (`contract_id`),
  KEY `idx_contract_approvals_approver` (`approver_id`),
  KEY `idx_contract_approvals_order` (`approval_order`),
  KEY `idx_contract_approvals_status` (`status`),
  CONSTRAINT `contract_approvals_contract_fk` FOREIGN KEY (`contract_id`) REFERENCES `contracts` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `contract_approvals_approver_fk` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
