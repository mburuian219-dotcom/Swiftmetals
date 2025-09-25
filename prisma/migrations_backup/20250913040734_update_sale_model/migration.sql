/*
  Warnings:

  - Added the required column `price` to the `SaleItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total` to the `SaleItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `saleitem` ADD COLUMN `price` DOUBLE NOT NULL,
    ADD COLUMN `total` DOUBLE NOT NULL;
