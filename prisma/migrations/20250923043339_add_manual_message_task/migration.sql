/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `product` table. All the data in the column will be lost.
  - You are about to drop the column `stock` on the `product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `catalogproduct` ADD COLUMN `inStock` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `product` DROP COLUMN `imageUrl`,
    DROP COLUMN `stock`,
    ADD COLUMN `image` VARCHAR(191) NULL,
    ADD COLUMN `inStock` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `ManualMessageTask` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customerId` INTEGER NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `failureReason` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentAt` DATETIME(3) NULL,

    INDEX `ManualMessageTask_customerId_idx`(`customerId`),
    INDEX `ManualMessageTask_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ManualMessageTask` ADD CONSTRAINT `ManualMessageTask_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
