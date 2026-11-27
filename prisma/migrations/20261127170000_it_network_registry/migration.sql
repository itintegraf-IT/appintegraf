-- Registr VLAN / subnet / IP / porty napojený na IT vendor requests
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `it_network_vlans` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `vlan_number` INT NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `it_network_vlans_number_unique` (`vlan_number`),
  KEY `idx_it_network_vlans_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `it_network_subnets` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `vlan_id` INT NOT NULL,
  `cidr` VARCHAR(50) NOT NULL,
  `gateway` VARCHAR(50) NULL,
  `note` TEXT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `it_network_subnets_cidr_unique` (`cidr`),
  KEY `idx_it_network_subnet_vlan` (`vlan_id`),
  CONSTRAINT `it_network_subnet_vlan_fk` FOREIGN KEY (`vlan_id`) REFERENCES `it_network_vlans` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `it_network_ips` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `subnet_id` INT NOT NULL,
  `ip_address` VARCHAR(50) NOT NULL,
  `status` ENUM('free', 'allocated') NOT NULL DEFAULT 'free',
  `request_id` INT NULL,
  `note` VARCHAR(255) NULL,
  `allocated_at` DATETIME(0) NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `it_network_ips_address_unique` (`ip_address`),
  KEY `idx_it_network_ip_subnet` (`subnet_id`),
  KEY `idx_it_network_ip_status` (`status`),
  KEY `idx_it_network_ip_request` (`request_id`),
  CONSTRAINT `it_network_ip_subnet_fk` FOREIGN KEY (`subnet_id`) REFERENCES `it_network_subnets` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `it_network_ip_request_fk` FOREIGN KEY (`request_id`) REFERENCES `it_vendor_requests` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `it_network_ip_ports` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `ip_id` INT NOT NULL,
  `request_id` INT NULL,
  `protocol` VARCHAR(50) NULL,
  `port` VARCHAR(100) NULL,
  `service_name` VARCHAR(255) NULL,
  `direction` VARCHAR(80) NULL,
  `purpose` TEXT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_it_network_port_ip` (`ip_id`),
  KEY `idx_it_network_port_request` (`request_id`),
  CONSTRAINT `it_network_port_ip_fk` FOREIGN KEY (`ip_id`) REFERENCES `it_network_ips` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `it_network_port_request_fk` FOREIGN KEY (`request_id`) REFERENCES `it_vendor_requests` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `it_vendor_requests`
  ADD COLUMN `assigned_vlan_id` INT NULL AFTER `assigned_vlan`;

ALTER TABLE `it_vendor_requests`
  ADD KEY `idx_it_vendor_req_vlan` (`assigned_vlan_id`);

ALTER TABLE `it_vendor_requests`
  ADD CONSTRAINT `it_vendor_assigned_vlan_fk`
  FOREIGN KEY (`assigned_vlan_id`) REFERENCES `it_network_vlans` (`id`)
  ON DELETE SET NULL ON UPDATE NO ACTION;
