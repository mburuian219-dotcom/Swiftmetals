-- AlterTable
ALTER TABLE `expense` ADD COLUMN `createdById` INTEGER NULL,
    ADD COLUMN `updatedById` INTEGER NULL;

-- CreateIndex
CREATE INDEX `expense_createdById_idx` ON `expense`(`createdById`);

-- CreateIndex
CREATE INDEX `expense_updatedById_idx` ON `expense`(`updatedById`);

-- AddForeignKey
ALTER TABLE `expense` ADD CONSTRAINT `expense_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense` ADD CONSTRAINT `expense_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
