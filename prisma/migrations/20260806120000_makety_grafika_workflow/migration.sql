-- Grafika workflow: IML vazby, prepress stavy, audit log, archiv souborů

ALTER TABLE `makety`
  MODIFY COLUMN `status` VARCHAR(30) NOT NULL DEFAULT 'open',
  ADD COLUMN `customer_id` INT NULL AFTER `work_type`,
  ADD COLUMN `product_id` INT NULL AFTER `customer_id`,
  ADD COLUMN `die_cut_id` INT NULL AFTER `product_id`,
  ADD COLUMN `label_code` VARCHAR(100) NULL AFTER `die_cut_id`,
  ADD COLUMN `job_number` VARCHAR(50) NULL AFTER `label_code`,
  ADD COLUMN `product_draft` JSON NULL AFTER `job_number`;

CREATE INDEX `idx_makety_customer` ON `makety`(`customer_id`);
CREATE INDEX `idx_makety_product` ON `makety`(`product_id`);
CREATE INDEX `idx_makety_job_number` ON `makety`(`job_number`);

ALTER TABLE `makety`
  ADD CONSTRAINT `makety_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `iml_customers`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  ADD CONSTRAINT `makety_product_fk` FOREIGN KEY (`product_id`) REFERENCES `iml_products`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  ADD CONSTRAINT `makety_die_cut_fk` FOREIGN KEY (`die_cut_id`) REFERENCES `iml_die_cuts`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE TABLE `makety_status_log` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `maketa_id` INT NOT NULL,
  `from_status` VARCHAR(30) NULL,
  `to_status` VARCHAR(30) NOT NULL,
  `user_id` INT NOT NULL,
  `comment` TEXT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  INDEX `idx_makety_status_log_maketa` (`maketa_id`),
  INDEX `idx_makety_status_log_user` (`user_id`),
  CONSTRAINT `makety_status_log_maketa_fk` FOREIGN KEY (`maketa_id`) REFERENCES `makety`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `makety_status_log_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
);

ALTER TABLE `file_uploads`
  ADD COLUMN `last_accessed_at` TIMESTAMP(0) NULL AFTER `is_public`,
  ADD COLUMN `archived_at` TIMESTAMP(0) NULL AFTER `last_accessed_at`,
  ADD COLUMN `archive_path` VARCHAR(500) NULL AFTER `archived_at`;
