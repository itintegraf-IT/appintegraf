-- Notifikace u přiřazení testů: okamžité upozornění a připomínka před termínem.

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'test_assignments' AND COLUMN_NAME = 'notify_on_assign'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE test_assignments ADD COLUMN notify_on_assign TINYINT(1) NOT NULL DEFAULT 1 AFTER is_active',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'test_assignments' AND COLUMN_NAME = 'remind_days_before'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE test_assignments ADD COLUMN remind_days_before INT NULL AFTER notify_on_assign',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
