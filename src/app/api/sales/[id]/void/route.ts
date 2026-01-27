import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, payment_status } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Await the params promise
    const { id } = await context.params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Sale ID is required' },
        { status: 400 }
      );
    }

    const saleId = parseInt(id);
    
    if (isNaN(saleId)) {
      return NextResponse.json(
        { error: 'Invalid sale ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { reason, voidAmount } = body;

    if (!reason) {
      return NextResponse.json(
        { error: 'Reason is required for voiding a sale' },
        { status: 400 }
      );
    }

    // Get the sale with related data
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        customer: true,
        saleitem: {
          include: {
            product: true,
            staffInventory: true
          }
        },
        invoice: true,
        payment: true,
        cashledger: true,
        paymentschedule: true
      }
    });

    if (!sale) {
      return NextResponse.json(
        { error: 'Sale not found' },
        { status: 404 }
      );
    }

    // Check if sale can be voided
    if (sale.status === 'VOIDED' || sale.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Sale is already voided or cancelled' },
        { status: 400 }
      );
    }

    // Start a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update sale status to VOIDED
      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          status: 'VOIDED',
          updatedBy: 'System (Voided from Cash Flow)'
        }
      });

      // 2. Void all associated invoices
      if (sale.invoice && sale.invoice.length > 0) {
        await Promise.all(
          sale.invoice.map(invoice =>
            tx.invoice.update({
              where: { id: invoice.id },
              data: {
                status: 'VOIDED',
                balance: 0
              }
            })
          )
        );
      }

      // 3. Update payments - mark as PENDING (since VOIDED is not in the enum)
      if (sale.payment && sale.payment.length > 0) {
        await Promise.all(
          sale.payment.map(payment =>
            tx.payment.update({
              where: { id: payment.id },
              data: {
                status: payment_status.PENDING,
                isVerified: false,
                note: payment.note ? `${payment.note} | VOIDED: ${reason}` : `VOIDED: ${reason}`
              }
            })
          )
        );
      }

      // 4. Void payment schedules
      if (sale.paymentschedule && sale.paymentschedule.length > 0) {
        await Promise.all(
          sale.paymentschedule.map(schedule =>
            tx.paymentschedule.update({
              where: { id: schedule.id },
              data: {
                isPaid: false,
                paidAmount: 0,
                paidAt: null
              }
            })
          )
        );
      }

      // 5. Return inventory to stock
      if (sale.saleitem && sale.saleitem.length > 0) {
        for (const item of sale.saleitem) {
          // Find product stock
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            include: { stock: true }
          });

          if (product) {
            const stockEntry = await tx.stock.findFirst({
              where: { productId: item.productId },
              orderBy: { createdAt: 'asc' }
            });

            if (stockEntry) {
              await tx.stock.update({
                where: { id: stockEntry.id },
                data: {
                  quantity: stockEntry.quantity + item.quantity
                }
              });
            } else {
              await tx.stock.create({
                data: {
                  productId: item.productId,
                  name: product.name,
                  quantity: item.quantity,
                  costPrice: product.productionCost || 0,
                  sellingPrice: product.price
                }
              });
            }

            // Update product inStock status
            await tx.product.update({
              where: { id: item.productId },
              data: { inStock: true }
            });
          }

          // Update staff inventory if applicable
          if (item.staffInventoryId) {
            await tx.staffInventory.update({
              where: { id: item.staffInventoryId },
              data: {
                quantitySold: {
                  decrement: item.quantity
                }
              }
            });
          }
        }
      }

      // 6. Create cash ledger entry for reversal
      const cashledgerEntry = await tx.cashledger.create({
        data: {
          date: new Date(),
          description: `Sale Voided: ${saleId} - ${reason}`,
          type: 'OUTFLOW',
          category: 'SALE_VOID',
          amount: voidAmount || sale.amount,
          relatedTo: 'Sale Void',
          affectedAccounts: 'Cash Account',
          referenceId: saleId,
          referenceType: 'Sale',
          saleId: saleId
        }
      });

      // 7. Create system log for audit trail - REMOVED updatedAt from here
      await tx.systemsetting.create({
        data: {
          key: `audit_sale_void_${saleId}_${Date.now()}`,
          value: JSON.stringify({
            saleId,
            originalSale: {
              amount: sale.amount,
              status: sale.status,
              date: sale.date,
              customerId: sale.customerId
            },
            reason,
            voidAmount: voidAmount || sale.amount,
            voidedAt: new Date().toISOString(),
            voidedBy: 'Cash Flow Tracker',
            inventoryReturned: sale.saleitem?.length || 0,
            paymentsUpdated: sale.payment?.length || 0
          }),
          description: `Sale ${saleId} voided from cash flow tracker`,
          updatedAt: new Date()  // Add this if updatedAt is required
        }
      });

      return {
        sale: updatedSale,
        cashledger: cashledgerEntry,
        itemsAffected: sale.saleitem?.length || 0,
        amountReversed: voidAmount || sale.amount,
        paymentsUpdated: sale.payment?.length || 0,
        invoicesVoided: sale.invoice?.length || 0
      };
    });

    return NextResponse.json({
      success: true,
      message: `Sale #${saleId} voided successfully`,
      data: result
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error voiding sale:', error);
    return NextResponse.json(
      { error: 'Failed to void sale', details: error.message },
      { status: 500 }
    );
  }
}