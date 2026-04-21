import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST /api/deleted-sales/[id]/restore
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deletedSaleId = parseInt(id);
    const body = await req.json();
    const { restoredBy, restoredByEmail, ipAddress } = body;

    if (isNaN(deletedSaleId)) {
      return NextResponse.json(
        { error: "Invalid deleted sale ID" },
        { status: 400 }
      );
    }

    // Get the deleted sale record
    const deletedSale = await prisma.deletedsale.findUnique({
      where: { id: deletedSaleId }
    });

    if (!deletedSale) {
      return NextResponse.json(
        { error: "Deleted sale not found" },
        { status: 404 }
      );
    }

    if (deletedSale.restoredAt) {
      return NextResponse.json(
        { error: "This sale has already been restored" },
        { status: 400 }
      );
    }

    if (deletedSale.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This sale has expired and cannot be restored" },
        { status: 400 }
      );
    }

    const saleData = deletedSale.saleData as any;

    // Check if original sale ID still exists
    const existingSale = await prisma.sale.findUnique({
      where: { id: deletedSale.originalSaleId }
    });

    let restoredSale;

    if (existingSale) {
      // If sale exists, update it
      restoredSale = await prisma.sale.update({
        where: { id: deletedSale.originalSaleId },
        data: {
          status: deletedSale.statusAtDeletion,
          amount: deletedSale.totalAmount,
          updatedAt: new Date(),
          updatedBy: restoredBy,
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          deletionReason: null
        }
      });
    } else {
      // Recreate the sale with original ID
      restoredSale = await prisma.sale.create({
        data: {
          id: deletedSale.originalSaleId,
          customerId: saleData.customerId,
          amount: saleData.amount,
          date: new Date(saleData.date),
          dueDate: saleData.dueDate ? new Date(saleData.dueDate) : null,
          status: saleData.status,
          createdAt: new Date(saleData.createdAt),
          updatedAt: new Date(),
          updatedBy: restoredBy,
          createdBy: saleData.createdBy,
          createdById: saleData.createdById,
          paymentMethod: saleData.paymentMethod || "CASH",
          saleitem: {
            create: saleData.saleitem?.map((item: any) => ({
              quantity: item.quantity,
              productId: item.productId,
              price: item.price,
              total: item.quantity * item.price
            })) || []
          },
          payment: {
            create: saleData.payment?.map((payment: any) => ({
              amount: payment.amount,
              method: payment.method,
              referenceId: payment.referenceId,
              checkDate: payment.checkDate ? new Date(payment.checkDate) : null,
              checkDepositDate: payment.checkDepositDate ? new Date(payment.checkDepositDate) : null,
              paidAt: new Date(payment.paidAt || payment.date),
              status: payment.status || "CLEARED"
            })) || []
          }
        }
      });
    }

    // Mark as restored in deleted_sales table
    await prisma.deletedsale.update({
      where: { id: deletedSaleId },
      data: {
        restoredAt: new Date(),
        restoredBy: restoredBy || restoredByEmail,
        restoredByEmail: restoredByEmail
      }
    });

    // Create audit log for restoration
    await prisma.saleauditlog.create({
      data: {
        saleId: restoredSale.id,
        action: "RESTORE",
        changedBy: restoredBy || "SYSTEM",
        changedByEmail: restoredByEmail,
        ipAddress: ipAddress,
        notes: `Sale restored from deleted archive. Original deletion: ${deletedSale.deletedAt} by ${deletedSale.deletedBy}. Reason: ${deletedSale.deletionReason || "Not provided"}`,
        snapshot: {
          before: { deleted: true, deletedAt: deletedSale.deletedAt },
          after: { restored: true, restoredAt: new Date() }
        }
      }
    });

    // If items were restocked, decrement stock (they were added back during deletion)
    if (deletedSale.restockedItems) {
      for (const item of saleData.saleitem || []) {
        const stockItem = await prisma.stock.findFirst({
          where: { productId: item.productId }
        });
        
        if (stockItem) {
          await prisma.stock.update({
            where: { id: stockItem.id },
            data: {
              quantity: Math.max(0, stockItem.quantity - item.quantity),
              updatedAt: new Date()
            }
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Sale restored successfully",
      sale: restoredSale,
      restoredFrom: {
        deletedSaleId: deletedSale.id,
        deletedAt: deletedSale.deletedAt,
        deletedBy: deletedSale.deletedBy,
        deletionReason: deletedSale.deletionReason
      }
    });
  } catch (error: any) {
    console.error("❌ Error restoring sale:", error);
    return NextResponse.json(
      { error: error.message || "Failed to restore sale" },
      { status: 500 }
    );
  }
}