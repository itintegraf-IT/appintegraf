-- Druh produktu: IML (plast) vs etikety (papír)

ALTER TABLE `iml_products`
    ADD COLUMN `product_kind` VARCHAR(20) NOT NULL DEFAULT 'etikety';

UPDATE `iml_products`
SET `product_kind` = 'etikety'
WHERE `product_kind` IS NULL OR `product_kind` = '';

CREATE INDEX `iml_products_product_kind_idx` ON `iml_products`(`product_kind`);
