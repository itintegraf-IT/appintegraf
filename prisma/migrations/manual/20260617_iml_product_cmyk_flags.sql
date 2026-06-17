-- CMYK přepínače na produktu (výchozí: všechny procesní barvy zapnuté)
ALTER TABLE `iml_products`
  ADD COLUMN `cmyk_c_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `print_colors_text`,
  ADD COLUMN `cmyk_m_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `cmyk_c_enabled`,
  ADD COLUMN `cmyk_y_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `cmyk_m_enabled`,
  ADD COLUMN `cmyk_k_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `cmyk_y_enabled`;
