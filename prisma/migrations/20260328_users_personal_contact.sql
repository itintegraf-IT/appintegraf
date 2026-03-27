-- Kontakty: osobní telefon a e-mail (tabulka users)
-- Spusťte na produkci jednou. Pokud sloupec už existuje, příslušný ALTER přeskočte / ignorujte chybu „Duplicate column“.

SET NAMES utf8mb4;

ALTER TABLE `users`
  ADD COLUMN `personal_phone` VARCHAR(20) NULL AFTER `landline2`;

ALTER TABLE `users`
  ADD COLUMN `personal_email` VARCHAR(100) NULL AFTER `personal_phone`;
