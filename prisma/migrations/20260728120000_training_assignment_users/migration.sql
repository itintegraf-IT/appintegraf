-- Přiřazení testů: skupina NEBO konkrétní uživatel (group_id XOR user_id).

ALTER TABLE test_assignments MODIFY group_id INT NULL;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'test_assignments' AND COLUMN_NAME = 'user_id'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE test_assignments ADD COLUMN user_id INT NULL AFTER group_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'test_assignments' AND INDEX_NAME = 'idx_user'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_user ON test_assignments (user_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'test_assignments'
    AND CONSTRAINT_NAME = 'test_assignments_ibfk_user'
);
SET @sql := IF(
  @fk_exists = 0,
  'ALTER TABLE test_assignments ADD CONSTRAINT test_assignments_ibfk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
