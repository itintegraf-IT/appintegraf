-- Vazba požadavku na techniku na přihlášeného uživatele
SET NAMES utf8mb4;

ALTER TABLE `equipment_requests`
  ADD COLUMN `requester_user_id` INT NULL AFTER `processed_at`,
  ADD INDEX `idx_requester_user_id` (`requester_user_id`),
  ADD CONSTRAINT `equipment_requests_requester_fk`
    FOREIGN KEY (`requester_user_id`) REFERENCES `users` (`id`) ON UPDATE NO ACTION;
