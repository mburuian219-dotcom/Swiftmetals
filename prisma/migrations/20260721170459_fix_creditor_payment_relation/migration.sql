-- DropForeignKey
ALTER TABLE `payment` DROP FOREIGN KEY `payment_saleId_fkey`;

-- AlterTable
ALTER TABLE `payment` MODIFY `saleId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `payment` ADD CONSTRAINT `payment_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sale`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
