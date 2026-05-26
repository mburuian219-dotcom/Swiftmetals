// app/api/staff-inventory/[id]/adjust/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }  // Changed: params is now a Promise
) {
  try {
    const { id } = await params;  // Await the params first
    const inventoryId = parseInt(id);
    const body = await request.json();
    
    const { 
      action, // 'ADD' or 'REMOVE'
      quantity, 
      reason,
      adjustedBy 
    } = body;

    // Validate
    if (!inventoryId || isNaN(inventoryId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid inventory ID' },
        { status: 400 }
      );
    }

    if (!['ADD', 'REMOVE'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Action must be ADD or REMOVE' },
        { status: 400 }
      );
    }

    if (!quantity || quantity <= 0) {
      return NextResponse.json(
        { success: false, error: 'Quantity must be a positive number' },
        { status: 400 }
      );
    }

    // Get current inventory
    const inventory = await prisma.staffInventory.findUnique({
      where: { id: inventoryId },
      include: {
        product: {
          include: {
            stock: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        },
        staff: true
      }
    });

    if (!inventory) {
      return NextResponse.json(
        { success: false, error: 'Inventory not found' },
        { status: 404 }
      );
    }

    // Calculate current available (not sold or returned)
    const currentAvailable = inventory.quantityGiven - inventory.quantitySold - inventory.quantityReturned;
    
    // For REMOVE action, check if enough items available
    if (action === 'REMOVE' && quantity > currentAvailable) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot remove ${quantity} items. Only ${currentAvailable} available.` 
        },
        { status: 400 }
      );
    }

    // For ADD action, check stock availability
    if (action === 'ADD') {
      const stockItem = inventory.product.stock?.[0];
      const currentStock = stockItem ? stockItem.quantity : 0;
      
      if (currentStock < quantity) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Cannot add ${quantity} items. Only ${currentStock} available in stock.` 
          },
          { status: 400 }
        );
      }
    }

    // Perform adjustment
    const result = await prisma.$transaction(async (tx) => {
      let newQuantityGiven = inventory.quantityGiven;
      
      // Update inventory
      if (action === 'ADD') {
        newQuantityGiven = inventory.quantityGiven + quantity;
      } else if (action === 'REMOVE') {
        newQuantityGiven = inventory.quantityGiven - quantity;
      }

      const updatedInventory = await tx.staffInventory.update({
        where: { id: inventoryId },
        data: {
          quantityGiven: newQuantityGiven,
          updatedAt: new Date()
        }
      });

      // Adjust stock
      const stockAdjustment = action === 'ADD' ? -quantity : quantity; // ADD: take from stock, REMOVE: return to stock
      
      const stockItem = await tx.stock.findFirst({
        where: { productId: inventory.productId },
        orderBy: { createdAt: 'desc' }
      });

      let ledgerEntry = null;

      if (stockItem) {
        await tx.stock.update({
          where: { id: stockItem.id },
          data: {
            quantity: { increment: stockAdjustment },
            updatedAt: new Date()
          }
        });

        // Create ledger entry
        ledgerEntry = await tx.cashledger.create({
          data: {
            date: new Date(),
            description: `${action === 'ADD' ? 'Added' : 'Removed'} ${quantity} x ${inventory.product.name} ${action === 'ADD' ? 'to' : 'from'} ${inventory.staff.name}. ${reason ? `Reason: ${reason}` : ''}`,
            type: action === 'ADD' ? 'OUT' : 'IN', // OUT for adding to staff, IN for removing from staff
            category: 'STAFF_INVENTORY_ADJUSTMENT',
            amount: Math.abs(stockAdjustment) * (stockItem?.costPrice || inventory.product.productionCost || 0),
            relatedTo: 'STAFF_INVENTORY',
            affectedAccounts: 'STOCK',
            referenceId: inventoryId,
            referenceType: 'STAFF_INVENTORY',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      return { updatedInventory, ledgerEntry, stockItem };
    });

    // Calculate new available quantity after adjustment
    const newAvailable = result.updatedInventory.quantityGiven - inventory.quantitySold - inventory.quantityReturned;

    return NextResponse.json({
      success: true,
      data: {
        inventory: result.updatedInventory,
        adjustment: {
          action,
          quantity,
          previousQuantity: inventory.quantityGiven,
          newQuantity: result.updatedInventory.quantityGiven,
          previousAvailable: currentAvailable,
          newAvailable,
          reason,
          adjustedBy,
          adjustedAt: new Date()
        },
        stockInfo: {
          productId: inventory.productId,
          productName: inventory.product.name,
          stockBefore: result.stockItem ? result.stockItem.quantity - (action === 'ADD' ? -quantity : quantity) : 0,
          stockAfter: result.stockItem ? result.stockItem.quantity : 0,
          adjustment: action === 'ADD' ? -quantity : quantity
        }
      },
      message: `Successfully ${action === 'ADD' ? 'added' : 'removed'} ${quantity} items`
    });

  } catch (error: any) {
    console.error('Adjustment error:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Inventory not found' },
        { status: 404 }
      );
    }
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Database constraint violation' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to adjust inventory',
        details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}