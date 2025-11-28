-- AlterTable
ALTER TABLE `cashledger` ADD COLUMN `dailyOpeningBalanceId` INTEGER NULL,
    ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `token` VARCHAR(191) NULL,
    MODIFY `runningBalance` DOUBLE NULL;

-- CreateTable
CREATE TABLE `dailyopeningbalance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `amount` DOUBLE NOT NULL,
    `description` VARCHAR(191) NULL,
    `recordedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cashledger` ADD CONSTRAINT `cashledger_dailyOpeningBalanceId_fkey` FOREIGN KEY (`dailyOpeningBalanceId`) REFERENCES `dailyopeningbalance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
