/*
  Warnings:

  - Added the required column `updatedAt` to the `Sale` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `sale` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    ALTER COLUMN `status` DROP DEFAULT;
