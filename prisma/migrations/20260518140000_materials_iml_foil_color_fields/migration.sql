-- Rozšíření materiálů pro IML číselníky (fólie, Pantone, CMYK)
ALTER TABLE `materials`
  ADD COLUMN `thickness_label` VARCHAR(80) NULL AFTER `certificate_valid_until`,
  ADD COLUMN `hex_color` VARCHAR(7) NULL AFTER `thickness_label`,
  ADD COLUMN `cmyk_c` INT NULL AFTER `hex_color`,
  ADD COLUMN `cmyk_m` INT NULL AFTER `cmyk_c`,
  ADD COLUMN `cmyk_y` INT NULL AFTER `cmyk_m`,
  ADD COLUMN `cmyk_k` INT NULL AFTER `cmyk_y`;

-- Podtyp CMYK pro kategorii COLOR (Pantone zůstává samostatný podtyp)
INSERT INTO `material_subcategories` (`category_code`, `parent_id`, `name`, `sort_order`, `is_active`)
SELECT 'COLOR', NULL, 'CMYK', 2, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM `material_subcategories`
  WHERE `category_code` = 'COLOR' AND `name` = 'CMYK' AND `parent_id` IS NULL
);
