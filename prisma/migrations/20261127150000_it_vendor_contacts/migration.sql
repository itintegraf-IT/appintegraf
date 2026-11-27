-- Kontaktní osoby u IT požadavků externích dodavatelů
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `it_vendor_request_contacts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `request_id` INT NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `role` VARCHAR(100) NULL,
  `name` VARCHAR(150) NULL,
  `phone` VARCHAR(50) NULL,
  `email` VARCHAR(190) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_it_vendor_contact_request` (`request_id`),
  CONSTRAINT `it_vendor_contact_req_fk` FOREIGN KEY (`request_id`) REFERENCES `it_vendor_requests` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
