// @ts-nocheck
// // app/api/restock/[id]/delete/route.ts - OPTIMIZED VERSION
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Increase transaction timeout
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  // Increase transaction timeout to 30 seconds
  transactionOptions: {
    maxWait: 10000, // Maximum time to wait for a transaction
    timeout: 30000, // Maximum time the transaction can run
  }
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔄 Restock DELETE API called');
    
    // Await the params promise
    const { id } = await context.params;
    
    console.log('Received ID:', id);
    
    if (!id) {
      return NextResponse.json(
        { error: 'Restock ID is required' },
        { status: 400 }
      );
    }

    const restockId = parseInt(id);
    
    if (isNaN(restockId)) {
      return NextResponse.json(
        { error: 'Invalid restock ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json(
        { error: 'Reason is required for deleting a restock' },
        { status: 400 }
      );
    }

    // Get minimal data first
    const restock = await prisma.restock.findUnique({
      where: { id: restockId },
      select: {
        id: true,
        productId: true,
        quantity: true,
        totalCost: true,
        creditorId: true,
        product: {
          select: {
            name: true
          }
        }
      }
    });

    if (!restock) {
      return NextResponse.json(
        { error: 'Restock not found' },
        { status: 404 }
      );
    }

    console.log('✅ Restock found:', restock.product?.name);

    // Start a transaction with explicit timeout
    const result = await prisma.$transaction(async (tx) => {
      console.log('🔄 Transaction started');
      
      // 1. Remove stock from inventory (simplified approach)
      console.log('📦 Removing stock...');
      
      // Get current stock for the product
      const currentStock = await tx.stock.findFirst({
        where: { productId: restock.productId },
        orderBy: { createdAt: 'desc' }
      });

      if (currentStock) {
        const newQuantity = Math.max(0, currentStock.quantity - restock.quantity);
        
        if (newQuantity === 0) {
          // Delete the stock entry if quantity becomes zero
          await tx.stock.delete({
            where: { id: currentStock.id }
          });
        } else {
          // Update the stock entry
          await tx.stock.update({
            where: { id: currentStock.id },
            data: {
              quantity: newQuantity,
              updatedAt: new Date()
            }
          });
        }

        // Update product inStock status
        await tx.product.update({
          where: { id: restock.productId },
          data: { 
            inStock: newQuantity > 0,
            updatedAt: new Date()
          }
        });
        
        console.log(`Stock updated: ${currentStock.quantity} -> ${newQuantity}`);
      }

      // 2. Update creditor balance if applicable
      if (restock.creditorId) {
        console.log('👤 Updating creditor...');
        await tx.creditor.update({
          where: { id: restock.creditorId },
          data: {
            totalOwed: {
              decrement: restock.totalCost
            },
            updatedAt: new Date()
          }
        });
      }

      // 3. Delete associated cash ledger entries
      console.log('💰 Deleting cash ledger entries...');
      await tx.cashledger.deleteMany({
        where: {
          restockId: restockId
        }
      });

      // 4. Delete the restock record
      console.log('🗑️ Deleting restock record...');
      await tx.restock.delete({
        where: { id: restockId }
      });

      // 5. Create audit log (outside transaction for speed)
      console.log('📝 Creating audit log...');
      
      return {
        deletedRestockId: restockId,
        productName: restock.product?.name || 'Unknown',
        quantityRemoved: restock.quantity,
        totalCost: restock.totalCost,
        creditorUpdated: restock.creditorId ? true : false
      };
    }, {
      maxWait: 10000,
      timeout: 30000
    });

    console.log('✅ Transaction completed');
    
    // Create audit log outside transaction for better performance
    await prisma.systemsetting.create({
      data: {
        key: `audit_restock_delete_${restockId}_${Date.now()}`,
        value: JSON.stringify({
          restockId,
          reason,
          productId: restock.productId,
          productName: restock.product?.name,
          quantity: restock.quantity,
          totalCost: restock.totalCost,
          deletedAt: new Date().toISOString(),
          deletedBy: 'Cash Flow Tracker',
          creditorId: restock.creditorId,
          creditorUpdated: restock.creditorId ? true : false
        }),
        description: `Restock ${restockId} deleted from history`,
        updatedAt: new Date()
      }
    });

    console.log('✅ Audit log created');
    
    return NextResponse.json({
      success: true,
      message: `Restock #${restockId} deleted from history`,
      data: result
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Error deleting restock:', error);
    
    // Handle specific transaction timeout error
    if (error.code === 'P2028') {
      return NextResponse.json(
        { 
          error: 'Transaction timed out',
          details: 'The operation took too long. Please try again or delete in smaller batches.',
          code: error.code
        },
        { status: 408 } // 408 Request Timeout
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to delete restock', 
        details: error.message,
        code: error.code || 'UNKNOWN_ERROR'
      },
      { status: 500 }
    );
  }
}