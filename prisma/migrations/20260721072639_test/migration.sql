-- AlterTable
ALTER TABLE `payment` ADD COLUMN `creditorId` INTEGER NULL,
    ADD COLUMN `paymentDate` DATETIME(3) NULL,
    ADD COLUMN `paymentType` VARCHAR(191) NOT NULL DEFAULT 'sale',
    ADD COLUMN `recordedBy` VARCHAR(191) NULL,
    ADD COLUMN `recordedByEmail` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `payment_creditorId_idx` ON `payment`(`creditorId`);

-- CreateIndex
CREATE INDEX `payment_paymentType_idx` ON `payment`(`paymentType`);

-- AddForeignKey
ALTER TABLE `payment` ADD CONSTRAINT `payment_creditorId_fkey` FOREIGN KEY (`creditorId`) REFERENCES `creditor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
