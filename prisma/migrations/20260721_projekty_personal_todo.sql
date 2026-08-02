-- Modul Projekty — fáze 2, vlna 2: osobní To-Do list (Personal Todo).
-- Aplikuje se po 20260720_projekty_module.sql (vyžaduje tabulky users + projekty_card).
-- Spuštění: npm run db:projekty-migrate  (runner je idempotentní — přeskočí už existující).

-- CreateTable
CREATE TABLE `projekty_personal_todo` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` INTEGER NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'DONE') NOT NULL DEFAULT 'NOT_STARTED',
    `completedAt` DATETIME(3) NULL,
    `dueDate` DATETIME(3) NULL,
    `archivedAt` DATETIME(3) NULL,
    `promotedToCardId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `projekty_personal_todo_promotedToCardId_key`(`promotedToCardId`),
    INDEX `projekty_personal_todo_ownerId_archivedAt_status_idx`(`ownerId`, `archivedAt`, `status`),
    INDEX `projekty_personal_todo_ownerId_dueDate_idx`(`ownerId`, `dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey (owner → users; přiřazení uživatele mizí s uživatelem)
ALTER TABLE `projekty_personal_todo` ADD CONSTRAINT `projekty_personal_todo_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (promotedToCard → projekty_card; smazání karty jen odpojí, úkol zůstane archivovaný)
ALTER TABLE `projekty_personal_todo` ADD CONSTRAINT `projekty_personal_todo_promotedToCardId_fkey` FOREIGN KEY (`promotedToCardId`) REFERENCES `projekty_card`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
