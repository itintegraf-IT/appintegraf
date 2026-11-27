-- IT přidělená IP u firewall pravidla (více portů může sdílet jednu IP)
SET NAMES utf8mb4;

ALTER TABLE `it_vendor_request_firewall_rules`
  ADD COLUMN `assigned_ip` VARCHAR(100) NULL AFTER `implemented`;
