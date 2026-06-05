ALTER TABLE `iml_products`
  ADD COLUMN `format_width_mm` DECIMAL(8, 2) NULL AFTER `product_format`,
  ADD COLUMN `format_height_mm` DECIMAL(8, 2) NULL AFTER `format_width_mm`,
  ADD COLUMN `has_print_proof` BOOLEAN NOT NULL DEFAULT false AFTER `has_print_sample`,
  ADD COLUMN `approval_date` DATE NULL AFTER `approval_status`,
  ADD COLUMN `color_count` INTEGER NULL AFTER `approval_date`,
  ADD COLUMN `print_colors_text` VARCHAR(255) NULL AFTER `color_count`,
  ADD COLUMN `label_type` VARCHAR(20) NULL AFTER `print_colors_text`;
