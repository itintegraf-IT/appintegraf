-- Grafika: název produktu pro přenos do IML (client_name)
ALTER TABLE `makety`
  ADD COLUMN `product_name` VARCHAR(255) NULL AFTER `label_code`;
