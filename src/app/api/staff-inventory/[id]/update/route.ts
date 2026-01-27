import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // IMPORTANT: Await the params promise
    const { id } = await context.params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Assignment ID is required' },
        { status: 400 }
      );
    }

    const assignmentId = parseInt(id);
    
    if (isNaN(assignmentId)) {
      return NextResponse.json(
        { error: 'Invalid assignment ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { quantityGiven, quantitySold, quantityReturned, weekStartDate, weekEndDate } = body;

    // Get current assignment
    const currentAssignment = await prisma.staffInventory.findUnique({
      where: { id: assignmentId },
      include: { product: true }
    });

    if (!currentAssignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    const updates: any = { 
      updatedAt: new Date(),
      weekStartDate: weekStartDate ? new Date(weekStartDate) : null,
      weekEndDate: weekEndDate ? new Date(weekEndDate) : null
    };
    
    // Track stock changes
    let stockAdjustment = 0;
    
    // Handle quantityGiven changes
    if (quantityGiven !== undefined && quantityGiven !== currentAssignment.quantityGiven) {
      const quantityChange = quantityGiven - currentAssignment.quantityGiven;
      stockAdjustment = -quantityChange; // Negative because assigning items reduces stock
      updates.quantityGiven = quantityGiven;
    }

    // Handle quantityReturned changes
    if (quantityReturned !== undefined && quantityReturned !== currentAssignment.quantityReturned) {
      const returnChange = quantityReturned - currentAssignment.quantityReturned;
      stockAdjustment += returnChange; // Positive because returns add back to stock
      updates.quantityReturned = quantityReturned;
    }

    // Update quantitySold if provided
    if (quantitySold !== undefined) {
      updates.quantitySold = quantitySold;
    }

    // Update stock if needed
    if (stockAdjustment !== 0) {
      await updateProductStock(currentAssignment.productId, stockAdjustment);
    }

    // Update the assignment
    const updatedAssignment = await prisma.staffInventory.update({
      where: { id: assignmentId },
      data: updates,
      include: {
        product: true,
        staff: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Assignment updated successfully',
      data: updatedAssignment
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error updating assignment:', error);
    return NextResponse.json(
      { error: 'Failed to update assignment', details: error.message },
      { status: 500 }
    );
  }
}

async function updateProductStock(productId: number, adjustment: number) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { stock: true }
    });

    if (!product) throw new Error('Product not found');

    if (adjustment > 0) {
      // Adding items back to stock (returns or reducing assignment)
      const stockEntry = await prisma.stock.findFirst({
        where: { productId },
        orderBy: { createdAt: 'asc' }
      });

      if (stockEntry) {
        await prisma.stock.update({
          where: { id: stockEntry.id },
          data: {
            quantity: stockEntry.quantity + adjustment
          }
        });
      } else {
        // Create new stock entry
        await prisma.stock.create({
          data: {
            productId,
            name: product.name,
            quantity: adjustment,
            costPrice: product.productionCost || 0,
            sellingPrice: product.price,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }
    } else if (adjustment < 0) {
      // Removing items from stock (increasing assignment)
      const amountToRemove = Math.abs(adjustment);
      const stockEntries = await prisma.stock.findMany({
        where: { productId },
        orderBy: { createdAt: 'asc' }
      });

      let remainingToRemove = amountToRemove;
      
      for (const stockEntry of stockEntries) {
        if (remainingToRemove <= 0) break;
        
        const deductAmount = Math.min(stockEntry.quantity, remainingToRemove);
        
        await prisma.stock.update({
          where: { id: stockEntry.id },
          data: {
            quantity: stockEntry.quantity - deductAmount
          }
        });
        
        remainingToRemove -= deductAmount;
      }

      // If all stock entries are empty, delete them
      await prisma.stock.deleteMany({
        where: {
          productId,
          quantity: 0
        }
      });
    }

    // Update product inStock status
    const updatedStock = await prisma.stock.aggregate({
      where: { productId },
      _sum: { quantity: true }
    });

    const totalStock = updatedStock._sum.quantity || 0;
    
    await prisma.product.update({
      where: { id: productId },
      data: { 
        inStock: totalStock > 0 
      }
    });

  } catch (error) {
    console.error('Error updating product stock:', error);
    throw error;
  }
}