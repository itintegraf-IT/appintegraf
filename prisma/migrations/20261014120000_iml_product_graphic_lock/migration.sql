-- Zámek produktu při úpravě grafiky (makety data_kind=uprava_dat)
ALTER TABLE `iml_products`
  ADD COLUMN `is_locked` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `locked_maketa_id` INT NULL;

CREATE INDEX `idx_iml_products_is_locked` ON `iml_products`(`is_locked`);
CREATE INDEX `idx_iml_products_locked_maketa` ON `iml_products`(`locked_maketa_id`);

ALTER TABLE `iml_products`
  ADD CONSTRAINT `iml_products_locked_maketa_fk`
  FOREIGN KEY (`locked_maketa_id`) REFERENCES `makety`(`id`)
  ON DELETE SET NULL ON UPDATE NO ACTION;
