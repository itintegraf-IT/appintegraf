-- Druh produktu: IML (plast) vs etikety (papír)
-- Legacy data v modulu IML jsou převážně IML; etikety jen u záznamů s papírovým materiálem bez fólie.

ALTER TABLE `iml_products`
    ADD COLUMN `product_kind` VARCHAR(20) NOT NULL DEFAULT 'iml';

UPDATE `iml_products`
SET `product_kind` = 'iml';

UPDATE `iml_products`
SET `product_kind` = 'etikety'
WHERE `paper_material_id` IS NOT NULL
  AND `foil_material_id` IS NULL
  AND `foil_id` IS NULL
  AND (`foil_type` IS NULL OR TRIM(`foil_type`) = '');

CREATE INDEX `iml_products_product_kind_idx` ON `iml_products`(`product_kind`);
