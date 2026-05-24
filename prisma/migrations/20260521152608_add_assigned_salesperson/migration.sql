-- AlterTable
ALTER TABLE `sale` ADD COLUMN `assignedStaffId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `sale_assignedStaffId_idx` ON `sale`(`assignedStaffId`);

-- AddForeignKey
ALTER TABLE `sale` ADD CONSTRAINT `sale_assignedStaffId_fkey` FOREIGN KEY (`assignedStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `sale` RENAME INDEX `sale_createdById_fkey` TO `sale_createdById_idx`;
