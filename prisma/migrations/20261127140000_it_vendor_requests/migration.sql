-- IT požadavky externích dodavatelů (síť / firewall / servis)
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `it_vendor_requests` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `request_number` VARCHAR(24) NOT NULL,
  `status` ENUM('draft', 'sent', 'submitted', 'in_review', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'draft',
  `request_date` DATE NULL,
  `due_date` DATE NULL,
  `project_name` VARCHAR(255) NULL,
  `vendor_company` VARCHAR(255) NULL,
  `contact_name` VARCHAR(150) NULL,
  `contact_phone` VARCHAR(50) NULL,
  `contact_email` VARCHAR(190) NULL,
  `device_vendor_type` VARCHAR(255) NULL,
  `install_location` VARCHAR(255) NULL,
  `preferred_network_placement` VARCHAR(255) NULL,
  `purpose` TEXT NULL,
  `tech_description` TEXT NULL,
  `requested_services` TEXT NULL,
  `connection_type` VARCHAR(100) NULL,
  `devices_needing_ip` INT NULL,
  `dhcp_mode` VARCHAR(50) NULL,
  `requested_ip_range` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `requested_vlan` VARCHAR(255) NULL,
  `vlan_reason` TEXT NULL,
  `remote_access_needed` VARCHAR(50) NULL,
  `remote_access_method` VARCHAR(100) NULL,
  `vendor_public_ips` TEXT NULL,
  `has_own_router` VARCHAR(50) NULL,
  `internal_notes` TEXT NULL,
  `assigned_vlan` VARCHAR(255) NULL,
  `it_network_notes` TEXT NULL,
  `rejection_reason` TEXT NULL,
  `vendor_signer_name` VARCHAR(150) NULL,
  `vendor_signed_at` DATETIME(0) NULL,
  `pm_name` VARCHAR(150) NULL,
  `pm_signed_at` DATETIME(0) NULL,
  `it_name` VARCHAR(150) NULL,
  `it_signed_at` DATETIME(0) NULL,
  `created_by` INT NOT NULL,
  `submitted_at` DATETIME(0) NULL,
  `approved_at` DATETIME(0) NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `it_vendor_requests_request_number_key` (`request_number`),
  KEY `idx_it_vendor_req_status` (`status`),
  KEY `idx_it_vendor_req_created_by` (`created_by`),
  KEY `idx_it_vendor_req_created` (`created_at`),
  KEY `idx_it_vendor_req_vendor` (`vendor_company`),
  CONSTRAINT `it_vendor_requests_created_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `it_vendor_request_interfaces` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `request_id` INT NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `device_group` VARCHAR(255) NULL,
  `interface_type` VARCHAR(150) NULL,
  `speed_mbps` INT NULL,
  `port_count` INT NULL,
  `poe` VARCHAR(20) NULL,
  `requested_vlan` VARCHAR(150) NULL,
  `connection_place` VARCHAR(255) NULL,
  `max_distance_m` INT NULL,
  `note` TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_it_vendor_if_request` (`request_id`),
  CONSTRAINT `it_vendor_if_req_fk` FOREIGN KEY (`request_id`) REFERENCES `it_vendor_requests` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `it_vendor_request_ips` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `request_id` INT NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `device_service` VARCHAR(255) NULL,
  `allocation_mode` VARCHAR(80) NULL,
  `ip_count` INT NULL,
  `ip_from` VARCHAR(100) NULL,
  `ip_to` VARCHAR(100) NULL,
  `mask_cidr` VARCHAR(50) NULL,
  `gateway` VARCHAR(100) NULL,
  `dns` VARCHAR(100) NULL,
  `mac_address` VARCHAR(50) NULL,
  `note` TEXT NULL,
  `assigned_ip_from` VARCHAR(100) NULL,
  `assigned_ip_to` VARCHAR(100) NULL,
  `assigned_note` TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_it_vendor_ip_request` (`request_id`),
  CONSTRAINT `it_vendor_ip_req_fk` FOREIGN KEY (`request_id`) REFERENCES `it_vendor_requests` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `it_vendor_request_firewall_rules` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `request_id` INT NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `service_name` VARCHAR(255) NULL,
  `source_kind` VARCHAR(150) NULL,
  `source_host` VARCHAR(255) NULL,
  `target_kind` VARCHAR(150) NULL,
  `target_host` VARCHAR(255) NULL,
  `protocol` VARCHAR(50) NULL,
  `target_ports` VARCHAR(100) NULL,
  `direction` VARCHAR(80) NULL,
  `purpose` TEXT NULL,
  `encrypted` VARCHAR(50) NULL,
  `validity` VARCHAR(80) NULL,
  `note` TEXT NULL,
  `implemented` TINYINT(1) NOT NULL DEFAULT 0,
  `assigned_note` TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_it_vendor_fw_request` (`request_id`),
  CONSTRAINT `it_vendor_fw_req_fk` FOREIGN KEY (`request_id`) REFERENCES `it_vendor_requests` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `it_vendor_request_protocols` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `request_id` INT NOT NULL,
  `protocol_key` VARCHAR(50) NOT NULL,
  `used` VARCHAR(20) NULL,
  `used_ports` VARCHAR(100) NULL,
  `note` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `it_vendor_proto_unique` (`request_id`, `protocol_key`),
  KEY `idx_it_vendor_proto_request` (`request_id`),
  CONSTRAINT `it_vendor_proto_req_fk` FOREIGN KEY (`request_id`) REFERENCES `it_vendor_requests` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `it_vendor_request_security` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `request_id` INT NOT NULL,
  `question_key` VARCHAR(50) NOT NULL,
  `answer` VARCHAR(50) NULL,
  `note` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `it_vendor_sec_unique` (`request_id`, `question_key`),
  KEY `idx_it_vendor_sec_request` (`request_id`),
  CONSTRAINT `it_vendor_sec_req_fk` FOREIGN KEY (`request_id`) REFERENCES `it_vendor_requests` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `it_vendor_request_docs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `request_id` INT NOT NULL,
  `doc_key` VARCHAR(50) NOT NULL,
  `delivered` VARCHAR(50) NULL,
  `file_ref` VARCHAR(500) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `it_vendor_doc_unique` (`request_id`, `doc_key`),
  KEY `idx_it_vendor_doc_request` (`request_id`),
  CONSTRAINT `it_vendor_doc_req_fk` FOREIGN KEY (`request_id`) REFERENCES `it_vendor_requests` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `it_vendor_request_links` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `request_id` INT NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL,
  `sent_to_email` VARCHAR(190) NOT NULL,
  `expires_at` DATETIME(0) NOT NULL,
  `revoked_at` DATETIME(0) NULL,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `it_vendor_links_token_hash` (`token_hash`),
  KEY `idx_it_vendor_link_request` (`request_id`),
  KEY `idx_it_vendor_link_expires` (`expires_at`),
  CONSTRAINT `it_vendor_link_req_fk` FOREIGN KEY (`request_id`) REFERENCES `it_vendor_requests` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `it_vendor_link_user_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
