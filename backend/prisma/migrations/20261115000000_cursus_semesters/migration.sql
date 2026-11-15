-- Semestres du cursus en présentiel, propres à chaque mention et à chaque niveau
CREATE TABLE `CursusSemester` (
    `id` VARCHAR(191) NOT NULL,
    `mentionId` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `description` TEXT NULL,
    `startMonth` INTEGER NOT NULL,
    `endMonth` INTEGER NOT NULL,
    `createdById` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CursusSemester_mentionId_level_idx`(`mentionId`, `level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CursusSemester` ADD CONSTRAINT `CursusSemester_mentionId_fkey` FOREIGN KEY (`mentionId`) REFERENCES `Mention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
