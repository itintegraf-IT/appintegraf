-- Typy krabic + rozšíření katalogu výseků

CREATE TABLE IF NOT EXISTS `iml_box_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `iml_box_types_code_key`(`code`),
    INDEX `iml_box_types_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `iml_die_cuts`
    ADD COLUMN `internal_name` VARCHAR(255) NULL,
    ADD COLUMN `die_cut_format` VARCHAR(100) NULL,
    ADD COLUMN `customer_id` INTEGER NULL,
    ADD COLUMN `primary_machine` VARCHAR(100) NULL,
    ADD COLUMN `box_type_id` INTEGER NULL,
    ADD COLUMN `note_prepress` TEXT NULL,
    ADD COLUMN `mat_eup_60` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `mat_eup_60_weight` VARCHAR(50) NULL,
    ADD COLUMN `mat_eup_50` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `mat_eup_50_weight` VARCHAR(50) NULL,
    ADD COLUMN `mat_eth_55` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `mat_eth_55_weight` VARCHAR(50) NULL,
    ADD COLUMN `mat_elr_70` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `mat_elr_70_weight` VARCHAR(50) NULL;

CREATE INDEX `iml_die_cuts_customer_id_idx` ON `iml_die_cuts`(`customer_id`);
CREATE INDEX `iml_die_cuts_box_type_id_idx` ON `iml_die_cuts`(`box_type_id`);

ALTER TABLE `iml_die_cuts`
    ADD CONSTRAINT `iml_die_cuts_customer_id_fkey`
    FOREIGN KEY (`customer_id`) REFERENCES `iml_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `iml_die_cuts`
    ADD CONSTRAINT `iml_die_cuts_box_type_id_fkey`
    FOREIGN KEY (`box_type_id`) REFERENCES `iml_box_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
