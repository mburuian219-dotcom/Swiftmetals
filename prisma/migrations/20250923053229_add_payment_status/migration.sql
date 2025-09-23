-- AlterTable
ALTER TABLE `payment` ADD COLUMN `status` ENUM('PENDING', 'CLEARED', 'BOUNCED', 'COMPLETED') NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX `Payment_status_idx` ON `Payment`(`status`);
