-- IT zpracovatel / schvalovatel u požadavku
SET NAMES utf8mb4;

ALTER TABLE `it_vendor_requests`
  ADD COLUMN `assigned_it_user_id` INT NULL AFTER `it_signed_at`;

ALTER TABLE `it_vendor_requests`
  ADD KEY `idx_it_vendor_req_assigned_it` (`assigned_it_user_id`);

ALTER TABLE `it_vendor_requests`
  ADD CONSTRAINT `it_vendor_assigned_it_fk`
  FOREIGN KEY (`assigned_it_user_id`) REFERENCES `users` (`id`)
  ON DELETE SET NULL ON UPDATE NO ACTION;
