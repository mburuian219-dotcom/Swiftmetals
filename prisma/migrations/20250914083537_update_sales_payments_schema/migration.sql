/*
  Warnings:

  - You are about to drop the column `productId` on the `sale` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `sale` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.

*/
-- DropForeignKey
ALTER TABLE `sale` DROP FOREIGN KEY `Sale_productId_fkey`;

-- DropIndex
DROP INDEX `Sale_productId_fkey` ON `sale`;

-- AlterTable
ALTER TABLE `product` ADD COLUMN `image` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `sale` DROP COLUMN `productId`,
    MODIFY `amount` DOUBLE NOT NULL,
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING';
