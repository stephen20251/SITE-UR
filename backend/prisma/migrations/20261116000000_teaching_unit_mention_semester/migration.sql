-- Une UE se range dans un semestre de sa mention (l'ancien semestre général devient facultatif)
-- AlterTable
ALTER TABLE `TeachingUnit` ADD COLUMN `cursusSemesterId` VARCHAR(191) NULL,
    MODIFY `semesterId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `TeachingUnit` ADD CONSTRAINT `TeachingUnit_cursusSemesterId_fkey` FOREIGN KEY (`cursusSemesterId`) REFERENCES `CursusSemester`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

