-- AlterTable
ALTER TABLE `saleitem` ADD COLUMN `costAtSale` DOUBLE NULL,
    ADD COLUMN `costSnapshot` JSON NULL,
    ADD COLUMN `profitMargin` DOUBLE NULL,
    ADD COLUMN `totalCost` DOUBLE NULL;

-- CreateTable
CREATE TABLE `productCostHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `costPrice` DOUBLE NOT NULL,
    `effectiveDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `productCostHistory_productId_idx`(`productId`),
    INDEX `productCostHistory_effectiveDate_idx`(`effectiveDate`),
    UNIQUE INDEX `productCostHistory_productId_effectiveDate_key`(`productId`, `effectiveDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `saleitem_costAtSale_idx` ON `saleitem`(`costAtSale`);

-- AddForeignKey
ALTER TABLE `productCostHistory` ADD CONSTRAINT `productCostHistory_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
