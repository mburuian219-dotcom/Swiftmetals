/*
  Warnings:

  - You are about to drop the column `createdByName` on the `sale` table. All the data in the column will be lost.
  - You are about to drop the column `updatedByName` on the `sale` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `sale` DROP COLUMN `createdByName`,
    DROP COLUMN `updatedByName`;
