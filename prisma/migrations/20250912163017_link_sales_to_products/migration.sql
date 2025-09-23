/*
  Warnings:

  - You are about to drop the column `product` on the `sale` table. All the data in the column will be lost.
  - Added the required column `productId` to the `Sale` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `sale` DROP COLUMN `product`,
    ADD COLUMN `productId` INTEGER NOT NULL,
    MODIFY `amount` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
