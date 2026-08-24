-- Grafika: archiv až po potvrzení zápisu do IML
ALTER TABLE `makety`
  ADD COLUMN `iml_applied_at` DATETIME NULL AFTER `product_draft`;

-- Stávající finálně schválené zakázky zůstanou v archivu
UPDATE `makety`
  SET `iml_applied_at` = COALESCE(`updated_at`, NOW())
  WHERE `work_type` = 'grafika' AND `status` = 'approved' AND `iml_applied_at` IS NULL;
