-- Vlna 5A modulu Projekty: priorita karty + časové razítko přiřazení člena.
-- Spouštět přes `npm run db:projekty-migrate` (NE přes prisma migrate).

-- Priorita karty. NULL = bez priority (výchozí stav existujících karet);
-- záměrně bez DEFAULT, aby stovky historických karet nedostaly chip.
ALTER TABLE `projekty_card` ADD COLUMN `priority` ENUM('URGENT', 'HIGH', 'MEDIUM', 'LOW') NULL;

ALTER TABLE `projekty_card` ADD INDEX `projekty_card_boardId_priority_idx`(`boardId`, `priority`);

-- Kdy byl člen ke kartě přiřazen — potřebné pro odznak „Nové" na stránce Moje práce.
ALTER TABLE `projekty_card_member` ADD COLUMN `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- Backfill: bez něj by všechna existující přiřazení nesla čas migrace a stránka
-- Moje práce by je jednorázově označila jako čerstvá. createdAt karty je nejbližší
-- dostupná aproximace. Přepis na stejnou hodnotu je no-op → opakované spuštění neuškodí.
UPDATE `projekty_card_member` `m` JOIN `projekty_card` `c` ON `c`.`id` = `m`.`cardId` SET `m`.`assignedAt` = `c`.`createdAt`;
