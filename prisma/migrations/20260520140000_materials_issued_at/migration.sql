-- Datum vystavení dokumentu / materiálu
SET NAMES utf8mb4;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'materials'
    AND COLUMN_NAME = 'issued_at'
);

SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE `materials` ADD COLUMN `issued_at` DATETIME NULL AFTER `valid_until`',
  'SELECT 1'
);
PREPARE stmt_issued FROM @ddl;
EXECUTE stmt_issued;
DEALLOCATE PREPARE stmt_issued;
