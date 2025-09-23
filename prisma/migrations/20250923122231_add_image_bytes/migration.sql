/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `catalogproduct` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `catalogproduct` DROP COLUMN `imageUrl`,
    ADD COLUMN `image` LONGBLOB NULL,
    MODIFY `isPublic` BOOLEAN NOT NULL DEFAULT false;
