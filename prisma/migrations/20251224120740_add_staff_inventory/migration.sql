-- DropForeignKey
ALTER TABLE `invoice` DROP FOREIGN KEY `Invoice_saleId_fkey`;

-- DropForeignKey
ALTER TABLE `manualmessagetask` DROP FOREIGN KEY `ManualMessageTask_customerId_fkey`;

-- DropForeignKey
ALTER TABLE `order` DROP FOREIGN KEY `Order_customerId_fkey`;

-- DropForeignKey
ALTER TABLE `order` DROP FOREIGN KEY `Order_productId_fkey`;

-- DropForeignKey
ALTER TABLE `payment` DROP FOREIGN KEY `Payment_saleId_fkey`;

-- DropForeignKey
ALTER TABLE `paymentschedule` DROP FOREIGN KEY `PaymentSchedule_saleId_fkey`;

-- DropForeignKey
ALTER TABLE `restock` DROP FOREIGN KEY `Restock_productId_fkey`;

-- DropForeignKey
ALTER TABLE `sale` DROP FOREIGN KEY `Sale_customerId_fkey`;

-- DropForeignKey
ALTER TABLE `saleitem` DROP FOREIGN KEY `SaleItem_productId_fkey`;

-- DropForeignKey
ALTER TABLE `saleitem` DROP FOREIGN KEY `SaleItem_saleId_fkey`;

-- DropForeignKey
ALTER TABLE `smsreminder` DROP FOREIGN KEY `SmsReminder_customerId_fkey`;

-- DropForeignKey
ALTER TABLE `smsreminder` DROP FOREIGN KEY `SmsReminder_saleId_fkey`;

-- DropForeignKey
ALTER TABLE `stock` DROP FOREIGN KEY `Stock_productId_fkey`;

-- AlterTable
ALTER TABLE `sale` ADD COLUMN `createdById` INTEGER NULL;

-- AlterTable
ALTER TABLE `saleitem` ADD COLUMN `staffInventoryId` INTEGER NULL;

-- CreateTable
CREATE TABLE `staff` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staffInventory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `staffId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `quantityGiven` INTEGER NOT NULL,
    `quantitySold` INTEGER NOT NULL DEFAULT 0,
    `quantityReturned` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `staffInventory_staffId_idx`(`staffId`),
    INDEX `staffInventory_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `saleitem_staffInventoryId_idx` ON `saleitem`(`staffInventoryId`);

-- AddForeignKey
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manualmessagetask` ADD CONSTRAINT `manualmessagetask_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order` ADD CONSTRAINT `order_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order` ADD CONSTRAINT `order_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment` ADD CONSTRAINT `payment_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paymentschedule` ADD CONSTRAINT `paymentschedule_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock` ADD CONSTRAINT `stock_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `restock` ADD CONSTRAINT `restock_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale` ADD CONSTRAINT `sale_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale` ADD CONSTRAINT `sale_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saleitem` ADD CONSTRAINT `saleitem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saleitem` ADD CONSTRAINT `saleitem_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saleitem` ADD CONSTRAINT `saleitem_staffInventoryId_fkey` FOREIGN KEY (`staffInventoryId`) REFERENCES `staffInventory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staffInventory` ADD CONSTRAINT `staffInventory_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staffInventory` ADD CONSTRAINT `staffInventory_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `smsreminder` ADD CONSTRAINT `smsreminder_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `smsreminder` ADD CONSTRAINT `smsreminder_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `invoice` RENAME INDEX `Invoice_invoiceNumber_key` TO `invoice_invoiceNumber_key`;

-- RenameIndex
ALTER TABLE `invoice` RENAME INDEX `Invoice_saleId_fkey` TO `invoice_saleId_idx`;

-- RenameIndex
ALTER TABLE `manualmessagetask` RENAME INDEX `ManualMessageTask_customerId_idx` TO `manualmessagetask_customerId_idx`;

-- RenameIndex
ALTER TABLE `manualmessagetask` RENAME INDEX `ManualMessageTask_status_idx` TO `manualmessagetask_status_idx`;

-- RenameIndex
ALTER TABLE `order` RENAME INDEX `Order_customerId_fkey` TO `order_customerId_idx`;

-- RenameIndex
ALTER TABLE `order` RENAME INDEX `Order_productId_fkey` TO `order_productId_idx`;

-- RenameIndex
ALTER TABLE `payment` RENAME INDEX `Payment_isVerified_idx` TO `payment_isVerified_idx`;

-- RenameIndex
ALTER TABLE `payment` RENAME INDEX `Payment_method_idx` TO `payment_method_idx`;

-- RenameIndex
ALTER TABLE `payment` RENAME INDEX `Payment_saleId_idx` TO `payment_saleId_idx`;

-- RenameIndex
ALTER TABLE `payment` RENAME INDEX `Payment_status_idx` TO `payment_status_idx`;

-- RenameIndex
ALTER TABLE `paymentschedule` RENAME INDEX `PaymentSchedule_dueDate_idx` TO `paymentschedule_dueDate_idx`;

-- RenameIndex
ALTER TABLE `paymentschedule` RENAME INDEX `PaymentSchedule_isPaid_idx` TO `paymentschedule_isPaid_idx`;

-- RenameIndex
ALTER TABLE `paymentschedule` RENAME INDEX `PaymentSchedule_saleId_idx` TO `paymentschedule_saleId_idx`;

-- RenameIndex
ALTER TABLE `sale` RENAME INDEX `Sale_checkDepositDate_idx` TO `sale_checkDepositDate_idx`;

-- RenameIndex
ALTER TABLE `sale` RENAME INDEX `Sale_customerId_fkey` TO `sale_customerId_idx`;

-- RenameIndex
ALTER TABLE `sale` RENAME INDEX `Sale_dueDate_idx` TO `sale_dueDate_idx`;

-- RenameIndex
ALTER TABLE `sale` RENAME INDEX `Sale_paymentMethod_idx` TO `sale_paymentMethod_idx`;

-- RenameIndex
ALTER TABLE `sale` RENAME INDEX `Sale_status_idx` TO `sale_status_idx`;

-- RenameIndex
ALTER TABLE `saleitem` RENAME INDEX `SaleItem_productId_fkey` TO `saleitem_productId_idx`;

-- RenameIndex
ALTER TABLE `saleitem` RENAME INDEX `SaleItem_saleId_idx` TO `saleitem_saleId_idx`;

-- RenameIndex
ALTER TABLE `smsreminder` RENAME INDEX `SmsReminder_customerId_idx` TO `smsreminder_customerId_idx`;

-- RenameIndex
ALTER TABLE `smsreminder` RENAME INDEX `SmsReminder_saleId_idx` TO `smsreminder_saleId_idx`;

-- RenameIndex
ALTER TABLE `smsreminder` RENAME INDEX `SmsReminder_status_idx` TO `smsreminder_status_idx`;

-- RenameIndex
ALTER TABLE `smsreminder` RENAME INDEX `SmsReminder_type_idx` TO `smsreminder_type_idx`;

-- RenameIndex
ALTER TABLE `stock` RENAME INDEX `Stock_productId_idx` TO `stock_productId_idx`;

-- RenameIndex
ALTER TABLE `systemsetting` RENAME INDEX `SystemSetting_key_idx` TO `systemsetting_key_idx`;

-- RenameIndex
ALTER TABLE `systemsetting` RENAME INDEX `SystemSetting_key_key` TO `systemsetting_key_key`;
