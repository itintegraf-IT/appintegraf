-- Migrace: Vlastní pole v modulu IML
-- Spusťte v databázi appintegraf (např. mysql -u root -p appintegraf < add_iml_custom_fields.sql)

-- Sloupec custom_data u produktů (přeskočte, pokud již existuje)
ALTER TABLE iml_products ADD COLUMN custom_data JSON NULL;

-- Sloupec custom_data u objednávek (přeskočte, pokud již existuje)
ALTER TABLE iml_orders ADD COLUMN custom_data JSON NULL;

-- Tabulka definic vlastních polí
CREATE TABLE IF NOT EXISTS iml_custom_fields (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity VARCHAR(50) NOT NULL,
  field_key VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  field_type VARCHAR(20) NOT NULL DEFAULT 'text',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_entity_field (entity, field_key),
  KEY idx_entity (entity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
