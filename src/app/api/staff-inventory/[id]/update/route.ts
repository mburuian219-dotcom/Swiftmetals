import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper function to validate inventory exists
async function getInventoryWithDetails(id: number) {
  return await prisma.staffInventory.findUnique({
    where: { id },
    include: {
      product: {
        include: {
          stock: true
        }
      },
      staff: true
    }
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const inventoryId = parseInt(params.id);
    const body = await request.json();
    
    console.log('=== UPDATE REQUEST ===');
    console.log('Inventory ID:', inventoryId);
    console.log('Request body:', body);

    // Validate inventory ID
    if (!inventoryId || isNaN(inventoryId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid inventory ID' },
        { status: 400 }
      );
    }

    // Get existing inventory
    const existingInventory = await getInventoryWithDetails(inventoryId);
    if (!existingInventory) {
      return NextResponse.json(
        { success: false, error: 'Inventory assignment not found' },
        { status: 404 }
      );
    }

    // Check what type of update this is
    const isAdjustment = body.adjustType && body.adjustQuantity;
    const isReturn = body.quantityReturned !== undefined && body.quantityReturned !== null;
    const isFullUpdate = body.quantityGiven !== undefined;
    
    console.log('Update type:', { isAdjustment, isReturn, isFullUpdate });

    // Handle SIMPLE ADJUSTMENT (Add/Remove items)
    if (isAdjustment) {
      return await handleAdjustment(existingInventory, body, inventoryId);
    }
    
    // Handle RETURN items only
    if (isReturn && !isFullUpdate) {
      return await handleReturnOnly(existingInventory, body, inventoryId);
    }
    
    // Handle FULL UPDATE (all fields)
    return await handleFullUpdate(existingInventory, body, inventoryId);

  } catch (error: any) {
    console.error('Error in update:', error);
    
    // Handle specific errors
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Inventory not found' },
        { status: 404 }
      );
    }
    
    if (error.message?.includes('stock')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to update inventory',
        details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// ======================
// HANDLER FUNCTIONS
// ======================

// Handle simple add/remove adjustments
async function handleAdjustment(existingInventory: any, body: any, inventoryId: number) {
  const { adjustType, adjustQuantity, adjustReason } = body;
  const quantity = parseInt(adjustQuantity);
  
  console.log(`Handling ${adjustType} adjustment:`, { quantity, adjustReason });

  if (!['add', 'remove'].includes(adjustType)) {
    throw new Error('Adjustment type must be "add" or "remove"');
  }

  if (isNaN(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a positive number');
  }

  const currentGiven = existingInventory.quantityGiven;
  const currentSold = existingInventory.quantitySold;
  const currentReturned = existingInventory.quantityReturned;
  const availableToRemove = currentGiven - currentSold - currentReturned;

  // Validate adjustment
  if (adjustType === 'add') {
    // Check stock availability
    const stockItem = existingInventory.product.stock?.[0];
    const availableStock = stockItem ? stockItem.quantity : 0;
    
    if (availableStock < quantity) {
      throw new Error(`Cannot add ${quantity} items. Only ${availableStock} available in stock.`);
    }
  } else if (adjustType === 'remove') {
    if (quantity > availableToRemove) {
      throw new Error(`Cannot remove ${quantity} items. Only ${availableToRemove} available to remove.`);
    }
  }

  // Calculate new quantity
  const newQuantityGiven = adjustType === 'add' 
    ? currentGiven + quantity 
    : currentGiven - quantity;

  // Start transaction
  return await prisma.$transaction(async (tx) => {
    // 1. Update inventory
    const updatedInventory = await tx.staffInventory.update({
      where: { id: inventoryId },
      data: {
        quantityGiven: newQuantityGiven,
        updatedAt: new Date()
      },
      include: {
        product: true,
        staff: true
      }
    });

    // 2. Adjust stock
    const stockAdjustment = adjustType === 'add' ? -quantity : quantity; // Negative for add (take from stock)
    
    const stockItem = await tx.stock.findFirst({
      where: { productId: existingInventory.productId }
    });

    if (stockItem) {
      await tx.stock.update({
        where: { id: stockItem.id },
        data: {
          quantity: { increment: stockAdjustment },
          updatedAt: new Date()
        }
      });

      // 3. Create ledger entry
      const description = adjustType === 'add'
        ? `Added ${quantity} ${existingInventory.product.name} to ${existingInventory.staff.name}${adjustReason ? `: ${adjustReason}` : ''}`
        : `Removed ${quantity} ${existingInventory.product.name} from ${existingInventory.staff.name}${adjustReason ? `: ${adjustReason}` : ''}`;

      await tx.cashledger.create({
        data: {
          date: new Date(),
          description,
          type: adjustType === 'add' ? 'OUT' : 'IN',
          category: 'STAFF_INVENTORY_ADJUSTMENT',
          amount: Math.abs(quantity) * (stockItem.costPrice || existingInventory.product.productionCost || 0),
          relatedTo: 'STAFF_INVENTORY',
          affectedAccounts: 'STOCK',
          referenceId: inventoryId,
          referenceType: 'STAFF_INVENTORY',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    // Calculate remaining after update
    const remaining = newQuantityGiven - currentSold - currentReturned;

    return NextResponse.json({
      success: true,
      data: {
        ...updatedInventory,
        remaining,
        adjustment: {
          type: adjustType,
          quantity,
          previousQuantity: currentGiven,
          newQuantity: newQuantityGiven,
          reason: adjustReason
        }
      },
      message: `Successfully ${adjustType === 'add' ? 'added' : 'removed'} ${quantity} items`
    });
  });
}

// Handle return only (no quantityGiven change)
async function handleReturnOnly(existingInventory: any, body: any, inventoryId: number) {
  const { quantityReturned, returnReason } = body;
  const newReturned = parseInt(quantityReturned);
  
  console.log('Handling return only:', { newReturned, returnReason });

  if (isNaN(newReturned) || newReturned < 0) {
    throw new Error('Return quantity must be a non-negative number');
  }

  const currentGiven = existingInventory.quantityGiven;
  const currentSold = existingInventory.quantitySold;
  const currentReturned = existingInventory.quantityReturned;
  const maxReturnable = currentGiven - currentSold - currentReturned;

  // Validate
  if (newReturned > currentGiven) {
    throw new Error(`Return quantity (${newReturned}) cannot exceed assigned quantity (${currentGiven})`);
  }

  if (newReturned > maxReturnable) {
    throw new Error(`Cannot return ${newReturned} items. Maximum returnable: ${maxReturnable}`);
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Update inventory
    const updatedInventory = await tx.staffInventory.update({
      where: { id: inventoryId },
      data: {
        quantityReturned: newReturned,
        updatedAt: new Date()
      },
      include: {
        product: true,
        staff: true
      }
    });

    // 2. Adjust stock (return items to stock)
    const stockItem = await tx.stock.findFirst({
      where: { productId: existingInventory.productId }
    });

    if (stockItem) {
      const returnDifference = newReturned - currentReturned;
      
      if (returnDifference > 0) {
        await tx.stock.update({
          where: { id: stockItem.id },
          data: {
            quantity: { increment: returnDifference },
            updatedAt: new Date()
          }
        });

        // 3. Create ledger entry
        await tx.cashledger.create({
          data: {
            date: new Date(),
            description: `Returned ${returnDifference} ${existingInventory.product.name} from ${existingInventory.staff.name}${returnReason ? `: ${returnReason}` : ''}`,
            type: 'IN',
            category: 'STAFF_INVENTORY_RETURN',
            amount: returnDifference * (stockItem.costPrice || existingInventory.product.productionCost || 0),
            relatedTo: 'STAFF_INVENTORY',
            affectedAccounts: 'STOCK',
            referenceId: inventoryId,
            referenceType: 'STAFF_INVENTORY',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }
    }

    // Calculate remaining
    const remaining = currentGiven - currentSold - newReturned;

    return NextResponse.json({
      success: true,
      data: {
        ...updatedInventory,
        remaining
      },
      message: `Successfully updated return quantity to ${newReturned}`
    });
  });
}

// Handle full update (all fields)
async function handleFullUpdate(existingInventory: any, body: any, inventoryId: number) {
  const {
    quantityGiven,
    quantitySold,
    quantityReturned,
    weekStartDate,
    weekEndDate
  } = body;

  console.log('Handling full update:', { quantityGiven, quantitySold, quantityReturned });

  // Parse and validate
  const newGiven = quantityGiven !== undefined ? parseInt(quantityGiven) : existingInventory.quantityGiven;
  const newSold = quantitySold !== undefined ? parseInt(quantitySold) : existingInventory.quantitySold;
  const newReturned = quantityReturned !== undefined ? parseInt(quantityReturned) : existingInventory.quantityReturned;

  if (isNaN(newGiven) || isNaN(newSold) || isNaN(newReturned)) {
    throw new Error('All quantities must be valid numbers');
  }

  if (newGiven < 0 || newSold < 0 || newReturned < 0) {
    throw new Error('Quantities cannot be negative');
  }

  // Validate sold + returned doesn't exceed given
  if (newSold + newReturned > newGiven) {
    throw new Error(`Sold (${newSold}) + Returned (${newReturned}) cannot exceed Assigned (${newGiven})`);
  }

  // Calculate differences
  const givenDiff = newGiven - existingInventory.quantityGiven;
  const returnedDiff = newReturned - existingInventory.quantityReturned;
  const stockAdjustment = -givenDiff + returnedDiff; // Negative when taking from stock

  console.log('Calculated differences:', { givenDiff, returnedDiff, stockAdjustment });

  return await prisma.$transaction(async (tx) => {
    // 1. Update inventory
    const updateData: any = {
      quantityGiven: newGiven,
      quantitySold: newSold,
      quantityReturned: newReturned,
      updatedAt: new Date()
    };

    if (weekStartDate) updateData.weekStartDate = new Date(weekStartDate);
    if (weekEndDate) updateData.weekEndDate = new Date(weekEndDate);

    const updatedInventory = await tx.staffInventory.update({
      where: { id: inventoryId },
      data: updateData,
      include: {
        product: true,
        staff: true
      }
    });

    // 2. Adjust stock if needed
    if (stockAdjustment !== 0) {
      const stockItem = await tx.stock.findFirst({
        where: { productId: existingInventory.productId }
      });

      if (stockItem) {
        // Validate stock availability if we're taking from stock
        if (stockAdjustment < 0 && Math.abs(stockAdjustment) > stockItem.quantity) {
          throw new Error(`Insufficient stock. Need ${Math.abs(stockAdjustment)}, only ${stockItem.quantity} available.`);
        }

        await tx.stock.update({
          where: { id: stockItem.id },
          data: {
            quantity: { increment: stockAdjustment },
            updatedAt: new Date()
          }
        });

        // 3. Create ledger entry
        const description = stockAdjustment < 0
          ? `Stock assigned: ${Math.abs(stockAdjustment)} x ${existingInventory.product.name} to ${existingInventory.staff.name}`
          : `Stock returned: ${Math.abs(stockAdjustment)} x ${existingInventory.product.name} from ${existingInventory.staff.name}`;

        await tx.cashledger.create({
          data: {
            date: new Date(),
            description,
            type: stockAdjustment < 0 ? 'OUT' : 'IN',
            category: 'INVENTORY_ADJUSTMENT',
            amount: Math.abs(stockAdjustment) * (stockItem.costPrice || existingInventory.product.productionCost || 0),
            relatedTo: 'STAFF_INVENTORY',
            affectedAccounts: 'STOCK',
            referenceId: inventoryId,
            referenceType: 'STAFF_INVENTORY',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }
    }

    // Calculate remaining
    const remaining = newGiven - newSold - newReturned;

    return NextResponse.json({
      success: true,
      data: {
        ...updatedInventory,
        remaining
      },
      message: 'Inventory updated successfully'
    });
  });
}

// DELETE endpoint
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const inventoryId = parseInt(params.id);
    
    if (!inventoryId || isNaN(inventoryId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid inventory ID' },
        { status: 400 }
      );
    }

    // Get inventory details
    const inventory = await prisma.staffInventory.findUnique({
      where: { id: inventoryId },
      include: {
        product: true,
        staff: true
      }
    });

    if (!inventory) {
      return NextResponse.json(
        { success: false, error: 'Inventory assignment not found' },
        { status: 404 }
      );
    }

    // Check if there are sales
    if (inventory.quantitySold > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot delete assignment with sales. Please use the return function instead.' 
        },
        { status: 400 }
      );
    }

    // Calculate remaining items to return to stock
    const remaining = inventory.quantityGiven - inventory.quantitySold - inventory.quantityReturned;
    
    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Return remaining items to stock
      if (remaining > 0) {
        const stockItem = await tx.stock.findFirst({
          where: { productId: inventory.productId }
        });

        if (stockItem) {
          await tx.stock.update({
            where: { id: stockItem.id },
            data: {
              quantity: { increment: remaining },
              updatedAt: new Date()
            }
          });
        } else {
          await tx.stock.create({
            data: {
              productId: inventory.productId,
              name: inventory.product?.name || 'Product',
              quantity: remaining,
              costPrice: inventory.product?.productionCost || 0,
              sellingPrice: inventory.product?.price || 0,
              supplier: 'Return from Staff',
              notes: `Returned from deleted assignment (ID: ${inventoryId})`,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
        }

        // Create ledger entry
        await tx.cashledger.create({
          data: {
            date: new Date(),
            description: `Stock returned from deleted assignment: ${remaining} x ${inventory.product?.name || 'Product'} from ${inventory.staff?.name || 'Staff'}`,
            type: 'IN',
            category: 'INVENTORY_RETURN',
            amount: remaining * (inventory.product?.productionCost || 0),
            relatedTo: 'STAFF_INVENTORY',
            affectedAccounts: 'STOCK',
            referenceId: inventoryId,
            referenceType: 'STAFF_INVENTORY',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Delete the inventory assignment
      await tx.staffInventory.delete({
        where: { id: inventoryId }
      });

      return { deleted: true, itemsReturned: remaining };
    });

    return NextResponse.json({
      success: true,
      message: `Assignment deleted successfully. ${remaining} items returned to stock.`,
      data: result
    });

  } catch (error: any) {
    console.error('Error deleting inventory:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Inventory assignment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete inventory' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET endpoint
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const inventoryId = parseInt(params.id);
    
    if (!inventoryId || isNaN(inventoryId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid inventory ID' },
        { status: 400 }
      );
    }

    const inventory = await prisma.staffInventory.findUnique({
      where: { id: inventoryId },
      include: {
        product: {
          include: {
            stock: true
          }
        },
        staff: true,
        saleItems: {
          include: {
            sale: true
          }
        }
      }
    });

    if (!inventory) {
      return NextResponse.json(
        { success: false, error: 'Inventory assignment not found' },
        { status: 404 }
      );
    }

    // Calculate remaining and available stock
    const remaining = inventory.quantityGiven - inventory.quantitySold - inventory.quantityReturned;
    const availableStock = inventory.product?.stock?.[0]?.quantity || 0;

    return NextResponse.json({
      success: true,
      data: {
        ...inventory,
        remaining,
        availableStock,
        totalValue: inventory.quantityGiven * (inventory.product?.price || 0)
      }
    });

  } catch (error: any) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch inventory' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}