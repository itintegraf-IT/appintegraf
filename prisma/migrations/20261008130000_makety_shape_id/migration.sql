-- Tvar etikety na maketě/grafice (povinný před apply do IML)

ALTER TABLE `makety`
  ADD COLUMN `shape_id` INT NULL AFTER `die_cut_id`;

CREATE INDEX `idx_makety_shape` ON `makety` (`shape_id`);

ALTER TABLE `makety`
  ADD CONSTRAINT `makety_shape_fk`
    FOREIGN KEY (`shape_id`) REFERENCES `iml_shape_catalog` (`id`)
    ON DELETE SET NULL ON UPDATE NO ACTION;
