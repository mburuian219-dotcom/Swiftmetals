// app/api/staff-inventory/[id]/adjust/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const inventoryId = parseInt(params.id);
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
            stock: true
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
    return await prisma.$transaction(async (tx) => {
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
          // You could add an adjustmentNotes field
          // adjustmentNotes: `${action === 'ADD' ? 'Added' : 'Removed'} ${quantity} items. Reason: ${reason || 'No reason provided'}`
        }
      });

      // Adjust stock
      const stockAdjustment = action === 'ADD' ? -quantity : quantity; // ADD: take from stock, REMOVE: return to stock
      
      const stockItem = await tx.stock.findFirst({
        where: { productId: inventory.productId }
      });

      if (stockItem) {
        await tx.stock.update({
          where: { id: stockItem.id },
          data: {
            quantity: { increment: stockAdjustment },
            updatedAt: new Date()
          }
        });
      }

      // Create ledger entry
      await tx.cashledger.create({
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

      return NextResponse.json({
        success: true,
        data: {
          inventory: updatedInventory,
          adjustment: {
            action,
            quantity,
            previousQuantity: inventory.quantityGiven,
            newQuantity: newQuantityGiven,
            reason,
            adjustedBy,
            adjustedAt: new Date()
          }
        },
        message: `Successfully ${action === 'ADD' ? 'added' : 'removed'} ${quantity} items`
      });
    });

  } catch (error: any) {
    console.error('Adjustment error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to adjust inventory' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}