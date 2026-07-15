-- CMYK přepínače (idempotentní – bezpečné i po ručním npm run db:iml-cmyk-flags)
SET @add_cmyk := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `iml_products`
      ADD COLUMN `cmyk_c_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `print_colors_text`,
      ADD COLUMN `cmyk_m_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `cmyk_c_enabled`,
      ADD COLUMN `cmyk_y_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `cmyk_m_enabled`,
      ADD COLUMN `cmyk_k_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `cmyk_y_enabled`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'iml_products'
    AND COLUMN_NAME = 'cmyk_c_enabled'
);
PREPARE stmt FROM @add_cmyk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
