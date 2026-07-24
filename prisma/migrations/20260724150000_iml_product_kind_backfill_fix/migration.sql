-- Oprava backfillu product_kind: stávající produkty nejsou všechny etikety (převážně IML).

UPDATE `iml_products`
SET `product_kind` = 'iml';

UPDATE `iml_products`
SET `product_kind` = 'etikety'
WHERE `paper_material_id` IS NOT NULL
  AND `foil_material_id` IS NULL
  AND `foil_id` IS NULL
  AND (`foil_type` IS NULL OR TRIM(`foil_type`) = '');

ALTER TABLE `iml_products`
    MODIFY COLUMN `product_kind` VARCHAR(20) NOT NULL DEFAULT 'iml';
