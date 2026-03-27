-- Vazba příloh na záznam (např. smlouvu): file_uploads.record_id + module = 'contracts'
SET NAMES utf8mb4;

ALTER TABLE `file_uploads`
  ADD COLUMN `record_id` INT NULL AFTER `module`;

CREATE INDEX `idx_file_uploads_module_record` ON `file_uploads` (`module`, `record_id`);
