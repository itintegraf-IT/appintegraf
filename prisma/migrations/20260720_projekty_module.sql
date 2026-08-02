-- Modul Projekty (port z integraf-pm) — tabulky projekty_*
-- Generováno z prisma/schema.prisma (prisma migrate diff). FK míří na users(id).
-- Aplikovat jednou: mysql -u root -p appintegraf < prisma/migrations/20260720_projekty_module.sql

-- CreateTable
CREATE TABLE `projekty_workspace` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projekty_board` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `background` VARCHAR(191) NULL,
    `ownerId` INTEGER NOT NULL,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `projekty_board_workspaceId_idx`(`workspaceId`),
    INDEX `projekty_board_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projekty_board_member` (
    `boardId` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `role` ENUM('ADMIN', 'MEMBER', 'OBSERVER') NOT NULL DEFAULT 'MEMBER',

    INDEX `projekty_board_member_userId_idx`(`userId`),
    PRIMARY KEY (`boardId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projekty_board_list` (
    `id` VARCHAR(191) NOT NULL,
    `boardId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NULL,
    `position` DOUBLE NOT NULL,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `projekty_board_list_boardId_position_idx`(`boardId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projekty_card` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `listId` VARCHAR(191) NOT NULL,
    `boardId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `position` DOUBLE NOT NULL,
    `dueDate` DATETIME(3) NULL,
    `startDate` DATETIME(3) NULL,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `cover` VARCHAR(191) NULL,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `projekty_card_number_key`(`number`),
    INDEX `projekty_card_boardId_listId_position_idx`(`boardId`, `listId`, `position`),
    INDEX `projekty_card_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projekty_card_member` (
    `cardId` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,

    INDEX `projekty_card_member_userId_idx`(`userId`),
    PRIMARY KEY (`cardId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projekty_label` (
    `id` VARCHAR(191) NOT NULL,
    `boardId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL,

    INDEX `projekty_label_boardId_idx`(`boardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projekty_card_label` (
    `cardId` VARCHAR(191) NOT NULL,
    `labelId` VARCHAR(191) NOT NULL,

    INDEX `projekty_card_label_labelId_idx`(`labelId`),
    PRIMARY KEY (`cardId`, `labelId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projekty_checklist` (
    `id` VARCHAR(191) NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `position` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `projekty_checklist_cardId_position_idx`(`cardId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projekty_checklist_item` (
    `id` VARCHAR(191) NOT NULL,
    `checklistId` VARCHAR(191) NOT NULL,
    `text` VARCHAR(191) NOT NULL,
    `done` BOOLEAN NOT NULL DEFAULT false,
    `position` DOUBLE NOT NULL,
    `assigneeId` INTEGER NULL,
    `dueDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `projekty_checklist_item_checklistId_position_idx`(`checklistId`, `position`),
    INDEX `projekty_checklist_item_assigneeId_idx`(`assigneeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projekty_note` (
    `id` VARCHAR(191) NOT NULL,
    `parentType` ENUM('CARD') NOT NULL,
    `parentId` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `authorId` INTEGER NULL,
    `mentions` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `projekty_note_parentType_parentId_idx`(`parentType`, `parentId`),
    INDEX `projekty_note_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projekty_attachment` (
    `id` VARCHAR(191) NOT NULL,
    `parentType` ENUM('CARD') NOT NULL,
    `parentId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `data` LONGBLOB NOT NULL,
    `size` INTEGER NOT NULL,
    `mime` VARCHAR(191) NOT NULL,
    `uploadedBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `projekty_attachment_parentType_parentId_idx`(`parentType`, `parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projekty_audit_log` (
    `id` VARCHAR(191) NOT NULL,
    `userId` INTEGER NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `action` ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL,
    `diff` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `projekty_audit_log_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `projekty_audit_log_userId_idx`(`userId`),
    INDEX `projekty_audit_log_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `projekty_board` ADD CONSTRAINT `projekty_board_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `projekty_workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projekty_board` ADD CONSTRAINT `projekty_board_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projekty_board_member` ADD CONSTRAINT `projekty_board_member_boardId_fkey` FOREIGN KEY (`boardId`) REFERENCES `projekty_board`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projekty_board_member` ADD CONSTRAINT `projekty_board_member_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projekty_board_list` ADD CONSTRAINT `projekty_board_list_boardId_fkey` FOREIGN KEY (`boardId`) REFERENCES `projekty_board`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projekty_card` ADD CONSTRAINT `projekty_card_listId_fkey` FOREIGN KEY (`listId`) REFERENCES `projekty_board_list`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projekty_card_member` ADD CONSTRAINT `projekty_card_member_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `projekty_card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projekty_card_member` ADD CONSTRAINT `projekty_card_member_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projekty_label` ADD CONSTRAINT `projekty_label_boardId_fkey` FOREIGN KEY (`boardId`) REFERENCES `projekty_board`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projekty_card_label` ADD CONSTRAINT `projekty_card_label_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `projekty_card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projekty_card_label` ADD CONSTRAINT `projekty_card_label_labelId_fkey` FOREIGN KEY (`labelId`) REFERENCES `projekty_label`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projekty_checklist` ADD CONSTRAINT `projekty_checklist_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `projekty_card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projekty_checklist_item` ADD CONSTRAINT `projekty_checklist_item_checklistId_fkey` FOREIGN KEY (`checklistId`) REFERENCES `projekty_checklist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projekty_checklist_item` ADD CONSTRAINT `projekty_checklist_item_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projekty_note` ADD CONSTRAINT `projekty_note_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projekty_attachment` ADD CONSTRAINT `projekty_attachment_uploadedBy_fkey` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projekty_audit_log` ADD CONSTRAINT `projekty_audit_log_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: výchozí (globální) workspace. Všechny nástěnky na něj odkazují přes
-- DEFAULT_WORKSPACE_ID (lib/projekty/constants.ts). Idempotentní – při opakovaném
-- spuštění migrace se řádek nepřepíše.
INSERT IGNORE INTO `projekty_workspace` (`id`, `name`, `createdAt`)
VALUES ('default-workspace', 'Integraf', NOW(3));
