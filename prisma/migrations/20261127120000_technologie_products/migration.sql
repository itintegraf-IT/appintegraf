-- Produktové řádky pod jedním kódem rozkresu (název / formát / poznámka)

CREATE TABLE `technologie_products` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `technologie_id` INTEGER NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `format_text` VARCHAR(64) NULL,
  `note` TEXT NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `idx_technologie_products_tech_sort` ON `technologie_products`(`technologie_id`, `sort_order`);
CREATE INDEX `idx_technologie_products_name` ON `technologie_products`(`name`);

ALTER TABLE `technologie_products`
  ADD CONSTRAINT `technologie_products_technologie_fk`
  FOREIGN KEY (`technologie_id`) REFERENCES `technologie`(`id`)
  ON DELETE CASCADE ON UPDATE NO ACTION;

-- Backfill: stávající název/formát/poznámka → 1 produkt
INSERT INTO `technologie_products` (`technologie_id`, `name`, `format_text`, `note`, `sort_order`)
SELECT `id`, `name`, `format_text`, `note`, 0 FROM `technologie`;

DROP INDEX `idx_technologie_name` ON `technologie`;

ALTER TABLE `technologie`
  DROP COLUMN `name`,
  DROP COLUMN `format_text`,
  DROP COLUMN `note`;
