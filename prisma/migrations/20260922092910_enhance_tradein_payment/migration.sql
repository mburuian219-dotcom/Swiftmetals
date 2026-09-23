/*
  Warnings:

  - A unique constraint covering the columns `[tradeInPaymentId]` on the table `payment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `payment` ADD COLUMN `tradeInPaymentId` INTEGER NULL,
    MODIFY `status` ENUM('PENDING', 'CLEARED', 'BOUNCED', 'COMPLETED', 'APPLIED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `tradein` ADD COLUMN `images` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `tradeinPayment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tradeinId` INTEGER NOT NULL,
    `saleId` INTEGER NOT NULL,
    `customerId` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `tradeinValue` DOUBLE NOT NULL,
    `remainingBalance` DOUBLE NOT NULL,
    `itemName` VARCHAR(191) NOT NULL,
    `itemDescription` VARCHAR(191) NULL,
    `itemCategory` VARCHAR(191) NULL,
    `itemCondition` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `appliedAt` DATETIME(3) NULL,
    `voidedAt` DATETIME(3) NULL,
    `voidReason` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tradeinPayment_tradeinId_key`(`tradeinId`),
    INDEX `tradeinPayment_tradeinId_idx`(`tradeinId`),
    INDEX `tradeinPayment_saleId_idx`(`saleId`),
    INDEX `tradeinPayment_customerId_idx`(`customerId`),
    INDEX `tradeinPayment_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `payment_tradeInPaymentId_key` ON `payment`(`tradeInPaymentId`);

-- CreateIndex
CREATE INDEX `payment_tradeInPaymentId_idx` ON `payment`(`tradeInPaymentId`);

-- CreateIndex
CREATE INDEX `tradein_condition_idx` ON `tradein`(`condition`);

-- AddForeignKey
ALTER TABLE `payment` ADD CONSTRAINT `payment_tradeInPaymentId_fkey` FOREIGN KEY (`tradeInPaymentId`) REFERENCES `tradeinPayment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tradeinPayment` ADD CONSTRAINT `tradeinPayment_tradeinId_fkey` FOREIGN KEY (`tradeinId`) REFERENCES `tradein`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tradeinPayment` ADD CONSTRAINT `tradeinPayment_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tradeinPayment` ADD CONSTRAINT `tradeinPayment_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
