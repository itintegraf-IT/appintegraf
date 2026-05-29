ALTER TABLE `iml_customers` DROP INDEX `iml_customers_email_key`;

ALTER TABLE `iml_customers` MODIFY `ico` VARCHAR(32) NULL,
    MODIFY `dic` VARCHAR(32) NULL;

ALTER TABLE `iml_customers` ADD COLUMN `tax_country` VARCHAR(2) NULL,
    ADD COLUMN `parent_id` INTEGER NULL,
    ADD COLUMN `unit_type` VARCHAR(20) NOT NULL DEFAULT 'standalone',
    ADD COLUMN `sort_order` INTEGER NOT NULL DEFAULT 0;

CREATE INDEX `iml_customers_parent_id_idx` ON `iml_customers`(`parent_id`);
CREATE INDEX `iml_customers_unit_type_idx` ON `iml_customers`(`unit_type`);

ALTER TABLE `iml_customers` ADD CONSTRAINT `iml_customers_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `iml_customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `iml_customer_shipping_addresses` ADD COLUMN `expedition_note` TEXT NULL;

CREATE TABLE `iml_customer_emails` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_id` INTEGER NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `kind` VARCHAR(30) NOT NULL DEFAULT 'general',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    INDEX `iml_customer_emails_customer_id_idx`(`customer_id`),
    INDEX `iml_customer_emails_customer_id_kind_idx`(`customer_id`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `iml_customer_contacts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_id` INTEGER NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `email` VARCHAR(255) NULL,
    `role` VARCHAR(100) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    INDEX `iml_customer_contacts_customer_id_idx`(`customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `iml_customer_emails` ADD CONSTRAINT `iml_customer_emails_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `iml_customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `iml_customer_contacts` ADD CONSTRAINT `iml_customer_contacts_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `iml_customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
