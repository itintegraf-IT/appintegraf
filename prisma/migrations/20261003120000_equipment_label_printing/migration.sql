-- Majetek, vlna 2: evidence vytištěných štítků a skupiny bez štítků.
-- Jen přidání sloupců; idempotentní (přeskočí, co už existuje) — bezpečné i po ručním spuštění.

SET @add_item_label := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `equipment_items` ADD COLUMN `label_printed_at` TIMESTAMP NULL DEFAULT NULL AFTER `qr_code`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'equipment_items'
    AND COLUMN_NAME = 'label_printed_at'
);
PREPARE stmt FROM @add_item_label;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_room_label := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `equipment_rooms` ADD COLUMN `label_printed_at` TIMESTAMP NULL DEFAULT NULL AFTER `qr_code`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'equipment_rooms'
    AND COLUMN_NAME = 'label_printed_at'
);
PREPARE stmt FROM @add_room_label;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_category_label := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `equipment_categories` ADD COLUMN `label_required` TINYINT(1) NOT NULL DEFAULT 1 AFTER `responsible_user_id`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'equipment_categories'
    AND COLUMN_NAME = 'label_required'
);
PREPARE stmt FROM @add_category_label;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
