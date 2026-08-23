-- CreateTable
CREATE TABLE `creditorPaymentDetail` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `paymentId` INTEGER NOT NULL,
    `creditorId` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `description` VARCHAR(191) NULL,
    `invoiceNumber` VARCHAR(191) NULL,
    `paymentReference` VARCHAR(191) NULL,
    `dueDate` DATETIME(3) NULL,
    `bankName` VARCHAR(191) NULL,
    `accountNumber` VARCHAR(191) NULL,
    `checkNumber` VARCHAR(191) NULL,
    `checkDate` DATETIME(3) NULL,
    `transactionId` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `attachments` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `creditorPaymentDetail_paymentId_idx`(`paymentId`),
    INDEX `creditorPaymentDetail_creditorId_idx`(`creditorId`),
    INDEX `creditorPaymentDetail_paymentReference_idx`(`paymentReference`),
    INDEX `creditorPaymentDetail_invoiceNumber_idx`(`invoiceNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `creditorPaymentDetail` ADD CONSTRAINT `creditorPaymentDetail_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `creditorPaymentDetail` ADD CONSTRAINT `creditorPaymentDetail_creditorId_fkey` FOREIGN KEY (`creditorId`) REFERENCES `creditor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
