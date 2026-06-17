-- =============================================================================
-- Diagnostika DB pro modul IML (spustit na serveru proti databázi appintegraf)
-- Použití: mysql -u USER -p appintegraf < scripts/diagnose-iml-db.sql
--    nebo: zkopírovat do phpMyAdmin / Adminer a spustit celý soubor
-- =============================================================================

SELECT '=== 1) Aplikované Prisma migrace (posledních 15) ===' AS section;
SELECT migration_name, finished_at, applied_steps_count
FROM _prisma_migrations
ORDER BY finished_at DESC
LIMIT 15;

SELECT '=== 2) Očekávaná migrace IML formuláře (MUSÍ být v seznamu výše) ===' AS section;
SELECT migration_name, finished_at
FROM _prisma_migrations
WHERE migration_name = '20260605120000_iml_product_form_print_fields';

SELECT '=== 3) Tabulky modulu IML ===' AS section;
SELECT TABLE_NAME, TABLE_ROWS, CREATE_TIME, UPDATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME LIKE 'iml_%'
ORDER BY TABLE_NAME;

SELECT '=== 4) Sloupce iml_products – nové z poslední aktualizace ===' AS section;
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'iml_products'
  AND COLUMN_NAME IN (
    'format_width_mm',
    'format_height_mm',
    'has_print_proof',
    'approval_date',
    'color_count',
    'print_colors_text',
    'label_type',
    'labels_per_sheet'
  )
ORDER BY ORDINAL_POSITION;

SELECT '=== 5) CHYBĚJÍCÍ sloupce (očekáváno 8 řádků výše, prázdné = problém) ===' AS section;
SELECT expected.col AS missing_column
FROM (
  SELECT 'format_width_mm' AS col UNION ALL
  SELECT 'format_height_mm' UNION ALL
  SELECT 'has_print_proof' UNION ALL
  SELECT 'approval_date' UNION ALL
  SELECT 'color_count' UNION ALL
  SELECT 'print_colors_text' UNION ALL
  SELECT 'label_type' UNION ALL
  SELECT 'labels_per_sheet'
) AS expected
LEFT JOIN information_schema.COLUMNS c
  ON c.TABLE_SCHEMA = DATABASE()
 AND c.TABLE_NAME = 'iml_products'
 AND c.COLUMN_NAME = expected.col
WHERE c.COLUMN_NAME IS NULL;

SELECT '=== 6) Všechny sloupce iml_products (kontrola celkového stavu) ===' AS section;
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'iml_products'
ORDER BY ORDINAL_POSITION;

SELECT '=== 7) Tabulka iml_product_colors (Pantone / spotřeba) ===' AS section;
SELECT COUNT(*) AS row_count FROM iml_product_colors;

SELECT '=== 8) TEST INSERT (rollback – nic se neuloží) ===' AS section;
START TRANSACTION;
INSERT INTO iml_products (
  ig_code, ig_short_name, client_code, client_name,
  format_width_mm, format_height_mm,
  has_print_proof, has_print_sample,
  approval_status, item_status,
  last_edited_by, is_active
) VALUES (
  CONCAT('DIAG-', UNIX_TIMESTAMP()),
  'Diagnostika',
  'DIAG',
  'Test DB',
  45.00, 30.00,
  0, 0,
  'máme', 'aktivní',
  'diagnose-script', 1
);
SELECT LAST_INSERT_ID() AS test_insert_id, 'INSERT OK' AS result;
ROLLBACK;
SELECT 'ROLLBACK OK – testovací řádek smazán' AS result;
