-- IML newsec phase 1: nové tabulky + rozšíření iml_customers/iml_products/iml_orders
-- Generováno: prisma migrate diff (Prisma 7.5.0) proti schema.prisma
-- Datum: 2026-04-22
-- Záloha DB: backups/pre_iml_newsec_phase1_2026-04-22_0711.sql

SET FOREIGN_KEY_CHECKS=1;
SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";

-- AlterTable
ALTER TABLE `iml_customers` ADD COLUMN `billing_company` VARCHAR(255) NULL,
    ADD COLUMN `dic` VARCHAR(30) NULL,
    ADD COLUMN `ico` VARCHAR(20) NULL,
    ADD COLUMN `label_requirements` TEXT NULL,
    ADD COLUMN `pallet_packaging` TEXT NULL,
    ADD COLUMN `prepress_notes` TEXT NULL;

-- AlterTable
ALTER TABLE `iml_orders` ADD COLUMN `inquiry_id` INTEGER NULL,
    ADD COLUMN `shipping_address_id` INTEGER NULL,
    ADD COLUMN `shipping_snapshot_city` VARCHAR(100) NULL,
    ADD COLUMN `shipping_snapshot_country` VARCHAR(100) NULL,
    ADD COLUMN `shipping_snapshot_label` VARCHAR(100) NULL,
    ADD COLUMN `shipping_snapshot_postal_code` VARCHAR(20) NULL,
    ADD COLUMN `shipping_snapshot_recipient` VARCHAR(255) NULL,
    ADD COLUMN `shipping_snapshot_street` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `iml_products` ADD COLUMN `foil_id` INTEGER NULL,
    ADD COLUMN `labels_per_sheet` INTEGER NULL;

-- CreateTable
CREATE TABLE `iml_customer_shipping_addresses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_id` INTEGER NOT NULL,
    `label` VARCHAR(100) NULL,
    `recipient` VARCHAR(255) NULL,
    `street` VARCHAR(255) NULL,
    `city` VARCHAR(100) NULL,
    `postal_code` VARCHAR(20) NULL,
    `country` VARCHAR(100) NULL DEFAULT 'Česká republika',
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `label_requirements` TEXT NULL,
    `pallet_packaging` TEXT NULL,
    `prepress_notes` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `iml_customer_shipping_addresses_customer_id_idx`(`customer_id`),
    INDEX `iml_customer_shipping_addresses_customer_id_is_default_idx`(`customer_id`, `is_default`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `iml_foils` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `thickness` VARCHAR(50) NULL,
    `note` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `iml_foils_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `iml_pantone_colors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(100) NULL,
    `hex` VARCHAR(7) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `iml_pantone_colors_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `iml_product_colors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `pantone_id` INTEGER NOT NULL,
    `coverage_pct` DECIMAL(5, 2) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `iml_product_colors_product_id_idx`(`product_id`),
    INDEX `iml_product_colors_pantone_id_idx`(`pantone_id`),
    UNIQUE INDEX `iml_product_colors_product_id_pantone_id_key`(`product_id`, `pantone_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `iml_product_files` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `version` INTEGER NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `pdf_data` LONGBLOB NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT true,
    `uploaded_by` INTEGER NOT NULL,
    `uploaded_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `iml_product_files_product_id_is_primary_idx`(`product_id`, `is_primary`),
    INDEX `iml_product_files_uploaded_by_idx`(`uploaded_by`),
    UNIQUE INDEX `iml_product_files_product_id_version_key`(`product_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `iml_inquiries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_id` INTEGER NOT NULL,
    `inquiry_number` VARCHAR(50) NOT NULL,
    `inquiry_date` DATETIME(0) NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'nová',
    `notes` TEXT NULL,
    `converted_order_id` INTEGER NULL,
    `custom_data` JSON NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `iml_inquiries_inquiry_number_key`(`inquiry_number`),
    UNIQUE INDEX `iml_inquiries_converted_order_id_key`(`converted_order_id`),
    INDEX `iml_inquiries_customer_id_idx`(`customer_id`),
    INDEX `iml_inquiries_status_idx`(`status`),
    INDEX `iml_inquiries_inquiry_date_idx`(`inquiry_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `iml_inquiry_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inquiry_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DECIMAL(10, 2) NULL,
    `subtotal` DECIMAL(10, 2) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `iml_inquiry_items_inquiry_id_idx`(`inquiry_id`),
    INDEX `iml_inquiry_items_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `iml_orders_inquiry_id_key` ON `iml_orders`(`inquiry_id`);

-- CreateIndex
CREATE INDEX `iml_orders_shipping_address_id_idx` ON `iml_orders`(`shipping_address_id`);

-- CreateIndex
CREATE INDEX `iml_products_foil_id_idx` ON `iml_products`(`foil_id`);

-- AddForeignKey
ALTER TABLE `iml_products` ADD CONSTRAINT `iml_products_foil_id_fkey` FOREIGN KEY (`foil_id`) REFERENCES `iml_foils`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `iml_orders` ADD CONSTRAINT `iml_orders_shipping_address_id_fkey` FOREIGN KEY (`shipping_address_id`) REFERENCES `iml_customer_shipping_addresses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `iml_customer_shipping_addresses` ADD CONSTRAINT `iml_customer_shipping_addresses_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `iml_customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `iml_product_colors` ADD CONSTRAINT `iml_product_colors_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `iml_products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `iml_product_colors` ADD CONSTRAINT `iml_product_colors_pantone_id_fkey` FOREIGN KEY (`pantone_id`) REFERENCES `iml_pantone_colors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `iml_product_files` ADD CONSTRAINT `iml_product_files_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `iml_products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `iml_product_files` ADD CONSTRAINT `iml_product_files_uploaded_by_fkey` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `iml_inquiries` ADD CONSTRAINT `iml_inquiries_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `iml_customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `iml_inquiries` ADD CONSTRAINT `iml_inquiries_converted_order_id_fkey` FOREIGN KEY (`converted_order_id`) REFERENCES `iml_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `iml_inquiry_items` ADD CONSTRAINT `iml_inquiry_items_inquiry_id_fkey` FOREIGN KEY (`inquiry_id`) REFERENCES `iml_inquiries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `iml_inquiry_items` ADD CONSTRAINT `iml_inquiry_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `iml_products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

