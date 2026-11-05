-- Sdílené šablony exportu IML (viditelné pro všechny uživatele modulu)
ALTER TABLE `iml_export_templates`
  ADD COLUMN `is_shared` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `idx_iml_export_templates_entity_shared`
  ON `iml_export_templates`(`entity`, `is_shared`);
