-- Schvalovatelé ve workflow grafiky
ALTER TABLE `makety`
  ADD COLUMN `prepress_user_id` INT NULL AFTER `product_draft`,
  ADD COLUMN `final_approver_user_id` INT NULL AFTER `prepress_user_id`;

CREATE INDEX `idx_makety_prepress` ON `makety`(`prepress_user_id`);
CREATE INDEX `idx_makety_final_approver` ON `makety`(`final_approver_user_id`);

ALTER TABLE `makety`
  ADD CONSTRAINT `makety_prepress_fk` FOREIGN KEY (`prepress_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  ADD CONSTRAINT `makety_final_approver_fk` FOREIGN KEY (`final_approver_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
