/*
  Warnings:

  - Added the required column `balance` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `generatedBy` to the `Invoice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `invoice` ADD COLUMN `balance` DOUBLE NOT NULL,
    ADD COLUMN `generatedBy` INTEGER NOT NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'UNPAID';
