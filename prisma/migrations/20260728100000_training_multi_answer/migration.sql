-- Podpora otázek s více správnými odpověďmi v modulu IT Školení.
-- correct_answers / user_answers obsahují setříděný seznam písmen oddělený čárkou, např. "A,B".
-- Původní enum sloupce zůstávají kvůli zpětné kompatibilitě (obsahují první správnou odpověď).

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'questions' AND COLUMN_NAME = 'correct_answers'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE questions ADD COLUMN correct_answers VARCHAR(20) NULL AFTER correct_answer',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'test_answers' AND COLUMN_NAME = 'user_answers'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE test_answers ADD COLUMN user_answers VARCHAR(20) NULL AFTER user_answer',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE questions SET correct_answers = correct_answer WHERE correct_answers IS NULL;
