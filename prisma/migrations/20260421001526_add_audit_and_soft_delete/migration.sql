-- AlterTable
ALTER TABLE `sale` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedBy` VARCHAR(191) NULL,
    ADD COLUMN `deletionReason` VARCHAR(191) NULL,
    ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `saleauditlog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `saleId` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `fieldName` VARCHAR(191) NULL,
    `oldValue` VARCHAR(191) NULL,
    `newValue` VARCHAR(191) NULL,
    `difference` VARCHAR(191) NULL,
    `changedBy` VARCHAR(191) NOT NULL,
    `changedByEmail` VARCHAR(191) NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `snapshot` JSON NULL,
    `notes` VARCHAR(191) NULL,

    INDEX `saleauditlog_saleId_idx`(`saleId`),
    INDEX `saleauditlog_action_idx`(`action`),
    INDEX `saleauditlog_changedAt_idx`(`changedAt`),
    INDEX `saleauditlog_changedBy_idx`(`changedBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deletedsale` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `originalSaleId` INTEGER NOT NULL,
    `saleData` JSON NOT NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(191) NULL,
    `customerId` INTEGER NULL,
    `totalAmount` DOUBLE NOT NULL,
    `saleDate` DATETIME(3) NOT NULL,
    `statusAtDeletion` VARCHAR(191) NOT NULL,
    `dueDate` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedBy` VARCHAR(191) NOT NULL,
    `deletedByEmail` VARCHAR(191) NULL,
    `deletionReason` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `restoredAt` DATETIME(3) NULL,
    `restoredBy` VARCHAR(191) NULL,
    `restoredByEmail` VARCHAR(191) NULL,
    `saleItemsSummary` VARCHAR(191) NOT NULL,
    `paymentsSummary` VARCHAR(191) NULL,
    `restockedItems` BOOLEAN NOT NULL DEFAULT false,
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `deletedsale_originalSaleId_key`(`originalSaleId`),
    INDEX `deletedsale_deletedAt_idx`(`deletedAt`),
    INDEX `deletedsale_expiresAt_idx`(`expiresAt`),
    INDEX `deletedsale_originalSaleId_idx`(`originalSaleId`),
    INDEX `deletedsale_customerName_idx`(`customerName`),
    INDEX `deletedsale_deletedBy_idx`(`deletedBy`),
    INDEX `deletedsale_statusAtDeletion_idx`(`statusAtDeletion`),
    INDEX `deletedsale_customerId_idx`(`customerId`),
    INDEX `deletedsale_restoredAt_idx`(`restoredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `sale_isDeleted_idx` ON `sale`(`isDeleted`);

-- CreateIndex
CREATE INDEX `sale_deletedAt_idx` ON `sale`(`deletedAt`);

-- AddForeignKey
ALTER TABLE `saleauditlog` ADD CONSTRAINT `saleauditlog_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deletedsale` ADD CONSTRAINT `deletedsale_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
