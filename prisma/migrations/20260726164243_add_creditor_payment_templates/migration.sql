-- CreateTable
CREATE TABLE `creditorPaymentTemplate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `creditorId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `bankName` VARCHAR(191) NULL,
    `accountNumber` VARCHAR(191) NULL,
    `accountName` VARCHAR(191) NULL,
    `bankBranch` VARCHAR(191) NULL,
    `swiftCode` VARCHAR(191) NULL,
    `defaultPaymentMethod` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `creditorPaymentTemplate_creditorId_idx`(`creditorId`),
    INDEX `creditorPaymentTemplate_isDefault_idx`(`isDefault`),
    UNIQUE INDEX `creditorPaymentTemplate_creditorId_name_key`(`creditorId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `creditorPaymentTemplate` ADD CONSTRAINT `creditorPaymentTemplate_creditorId_fkey` FOREIGN KEY (`creditorId`) REFERENCES `creditor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
