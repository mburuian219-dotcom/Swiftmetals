/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `creditor` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE `cashledger` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `description` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `runningBalance` DOUBLE NOT NULL DEFAULT 0,
    `relatedTo` VARCHAR(191) NULL,
    `affectedAccounts` VARCHAR(191) NULL,
    `referenceId` INTEGER NULL,
    `referenceType` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `saleId` INTEGER NULL,
    `expenseId` INTEGER NULL,
    `restockId` INTEGER NULL,

    INDEX `cashledger_date_idx`(`date`),
    INDEX `cashledger_type_idx`(`type`),
    INDEX `cashledger_category_idx`(`category`),
    INDEX `cashledger_referenceType_idx`(`referenceType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `creditor_name_key` ON `creditor`(`name`);

-- AddForeignKey
ALTER TABLE `cashledger` ADD CONSTRAINT `cashledger_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sale`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashledger` ADD CONSTRAINT `cashledger_expenseId_fkey` FOREIGN KEY (`expenseId`) REFERENCES `expense`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashledger` ADD CONSTRAINT `cashledger_restockId_fkey` FOREIGN KEY (`restockId`) REFERENCES `restock`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
