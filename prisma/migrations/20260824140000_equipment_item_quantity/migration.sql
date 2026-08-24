-- Množství kusů na jednom inventárním čísle (import z Excelu)
ALTER TABLE `equipment_items`
  ADD COLUMN `quantity` INT NOT NULL DEFAULT 1 AFTER `status`;
