-- IML: archivace PDF na filesystem + šablony exportu produktů

ALTER TABLE `iml_products`
  ADD COLUMN `archived_at` DATETIME NULL AFTER `die_cut_id`,
  ADD COLUMN `pdf_archive_path` VARCHAR(500) NULL AFTER `archived_at`;

CREATE INDEX `idx_iml_products_archived_at` ON `iml_products`(`archived_at`);

ALTER TABLE `iml_product_files`
  MODIFY COLUMN `pdf_data` LONGBLOB NULL,
  ADD COLUMN `last_accessed_at` DATETIME NULL AFTER `uploaded_at`,
  ADD COLUMN `archived_at` DATETIME NULL AFTER `last_accessed_at`,
  ADD COLUMN `archive_path` VARCHAR(500) NULL AFTER `archived_at`;

CREATE INDEX `idx_iml_product_files_archived_at` ON `iml_product_files`(`archived_at`);

CREATE TABLE `iml_export_templates` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `entity` VARCHAR(50) NOT NULL DEFAULT 'products',
  `format` VARCHAR(10) NOT NULL DEFAULT 'csv',
  `columns` JSON NOT NULL,
  `filters` JSON NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_iml_export_templates_user_entity` (`user_id`, `entity`),
  CONSTRAINT `iml_export_templates_user_fk`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
