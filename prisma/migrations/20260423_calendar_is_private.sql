-- Soukromé události: nezobrazují se v globálním (firemním) kalendáři.
-- Spusťte proti produkci / lokální DB, pokud `prisma db push` nejde použít.

ALTER TABLE `calendar_events`
  ADD COLUMN `is_private` TINYINT(1) NULL DEFAULT 0;
