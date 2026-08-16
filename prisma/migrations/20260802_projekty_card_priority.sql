-- Vlna 5A modulu Projekty: priorita karty + časové razítko přiřazení člena.
-- Spouštět přes `npm run db:projekty-migrate` (NE přes prisma migrate).

-- Priorita karty. NULL = bez priority (výchozí stav existujících karet);
-- záměrně bez DEFAULT, aby stovky historických karet nedostaly chip.
ALTER TABLE `projekty_card` ADD COLUMN `priority` ENUM('URGENT', 'HIGH', 'MEDIUM', 'LOW') NULL;

ALTER TABLE `projekty_card` ADD INDEX `projekty_card_boardId_priority_idx`(`boardId`, `priority`);

-- Kdy byl člen ke kartě přiřazen — potřebné pro odznak „Nové" na stránce Moje práce.
--
-- Sloupec se přidává jako NULL a teprve nakonec zpřísní na NOT NULL. Jen tak jde
-- backfill omezit na řádky, které hodnotu ještě nemají. Runner nemá evidenci už
-- aplikovaných migrací a projíždí všechny SQL soubory při každém spuštění, takže
-- UPDATE bez WHERE by při každém dalším nasazení přepsal skutečné časy přiřazení
-- zpátky na datum vzniku karty — a ta informace už se nedá získat zpět.
ALTER TABLE `projekty_card_member` ADD COLUMN `assignedAt` DATETIME(3) NULL;

-- Backfill: bez něj by všechna existující přiřazení nesla čas migrace a stránka
-- Moje práce by je jednorázově označila za čerstvá. createdAt karty je nejbližší
-- dostupná aproximace. WHERE ... IS NULL dělá z příkazu no-op při opakovaném běhu.
UPDATE `projekty_card_member` `m` JOIN `projekty_card` `c` ON `c`.`id` = `m`.`cardId` SET `m`.`assignedAt` = `c`.`createdAt` WHERE `m`.`assignedAt` IS NULL;

-- Zpřísnění až po backfillu. Na databázi, kde sloupec vznikl dřívější verzí tohoto
-- souboru (NOT NULL DEFAULT rovnou), je to no-op se stejnou definicí.
ALTER TABLE `projekty_card_member` MODIFY COLUMN `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
