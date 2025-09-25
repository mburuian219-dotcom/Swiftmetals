-- DropForeignKey
ALTER TABLE `payment` DROP FOREIGN KEY `Payment_saleId_fkey`;

-- DropForeignKey
ALTER TABLE `saleitem` DROP FOREIGN KEY `SaleItem_saleId_fkey`;

-- AlterTable
ALTER TABLE `payment` ADD COLUMN `bankName` VARCHAR(191) NULL,
    ADD COLUMN `checkDate` DATETIME(3) NULL,
    ADD COLUMN `checkNumber` VARCHAR(191) NULL,
    ADD COLUMN `isVerified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `referenceId` VARCHAR(191) NULL,
    ADD COLUMN `verifiedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `sale` ADD COLUMN `checkDepositDate` DATETIME(3) NULL,
    ADD COLUMN `isCheckDeposited` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `lastReminderDate` DATETIME(3) NULL,
    ADD COLUMN `paymentMethod` VARCHAR(191) NOT NULL DEFAULT 'CASH',
    ADD COLUMN `referenceNumber` VARCHAR(191) NULL,
    ADD COLUMN `remindersSent` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `SmsReminder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `saleId` INTEGER NOT NULL,
    `customerId` INTEGER NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'SENT',
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deliveredAt` DATETIME(3) NULL,

    INDEX `SmsReminder_saleId_idx`(`saleId`),
    INDEX `SmsReminder_customerId_idx`(`customerId`),
    INDEX `SmsReminder_type_idx`(`type`),
    INDEX `SmsReminder_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentSchedule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `saleId` INTEGER NOT NULL,
    `installmentNumber` INTEGER NOT NULL,
    `dueAmount` DOUBLE NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `isPaid` BOOLEAN NOT NULL DEFAULT false,
    `paidAmount` DOUBLE NOT NULL DEFAULT 0,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PaymentSchedule_saleId_idx`(`saleId`),
    INDEX `PaymentSchedule_dueDate_idx`(`dueDate`),
    INDEX `PaymentSchedule_isPaid_idx`(`isPaid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemSetting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SystemSetting_key_key`(`key`),
    INDEX `SystemSetting_key_idx`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Payment_method_idx` ON `Payment`(`method`);

-- CreateIndex
CREATE INDEX `Payment_isVerified_idx` ON `Payment`(`isVerified`);

-- CreateIndex
CREATE INDEX `Sale_status_idx` ON `Sale`(`status`);

-- CreateIndex
CREATE INDEX `Sale_paymentMethod_idx` ON `Sale`(`paymentMethod`);

-- CreateIndex
CREATE INDEX `Sale_dueDate_idx` ON `Sale`(`dueDate`);

-- CreateIndex
CREATE INDEX `Sale_checkDepositDate_idx` ON `Sale`(`checkDepositDate`);

-- AddForeignKey
ALTER TABLE `SaleItem` ADD CONSTRAINT `SaleItem_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SmsReminder` ADD CONSTRAINT `SmsReminder_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SmsReminder` ADD CONSTRAINT `SmsReminder_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentSchedule` ADD CONSTRAINT `PaymentSchedule_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `saleitem` RENAME INDEX `SaleItem_saleId_fkey` TO `SaleItem_saleId_idx`;

-- RenameIndex
ALTER TABLE `stock` RENAME INDEX `Stock_productId_fkey` TO `Stock_productId_idx`;
