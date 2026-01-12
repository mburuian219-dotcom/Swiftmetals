import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: "Valid inventory ID is required" },
        { status: 400 }
      );
    }

    const inventoryId = parseInt(id);
    const body = await req.json();
    const { quantityReturned } = body;

    if (!quantityReturned || isNaN(parseInt(quantityReturned))) {
      return NextResponse.json(
        { error: "Valid return quantity is required" },
        { status: 400 }
      );
    }

    const returnQuantity = parseInt(quantityReturned);

    if (returnQuantity <= 0) {
      return NextResponse.json(
        { error: "Return quantity must be greater than 0" },
        { status: 400 }
      );
    }

    // Get current inventory assignment
    const inventory = await prisma.staffInventory.findUnique({
      where: { id: inventoryId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            productionCost: true
          }
        },
        staff: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!inventory) {
      return NextResponse.json(
        { error: "Inventory assignment not found" },
        { status: 404 }
      );
    }

    // Calculate remaining quantity
    const remaining = inventory.quantityGiven - inventory.quantitySold - inventory.quantityReturned;
    
    if (returnQuantity > remaining) {
      return NextResponse.json(
        { 
          error: `Cannot return more than remaining quantity`,
          details: {
            requested: returnQuantity,
            available: remaining,
            suggestion: remaining > 0 ? `You can return up to ${remaining} items` : 'No items available for return'
          }
        },
        { status: 400 }
      );
    }

    // Check if this is for current week
    const isCurrentWeek = inventory.weekStartDate && inventory.weekEndDate;
    let weekInfo = null;
    
    if (isCurrentWeek) {
      const now = new Date();
      weekInfo = {
        isCurrentWeek: now >= new Date(inventory.weekStartDate!) && now <= new Date(inventory.weekEndDate!),
        weekRange: `${inventory.weekStartDate?.toLocaleDateString()} - ${inventory.weekEndDate?.toLocaleDateString()}`
      };
    }

    // Update inventory record
    const updatedInventory = await prisma.staffInventory.update({
      where: { id: inventoryId },
      data: {
        quantityReturned: inventory.quantityReturned + returnQuantity,
        updatedAt: new Date()
      },
      include: {
        product: {
          select: {
            name: true
          }
        },
        staff: {
          select: {
            name: true
          }
        }
      }
    });

    // Get updated inventory summary for the staff
    const staffInventories = await prisma.staffInventory.findMany({
      where: { staffId: inventory.staffId },
      include: {
        product: {
          select: {
            name: true
          }
        }
      }
    });

    const inventorySummary = {
      totalAssignments: staffInventories.length,
      totalGiven: staffInventories.reduce((sum, inv) => sum + inv.quantityGiven, 0),
      totalSold: staffInventories.reduce((sum, inv) => sum + inv.quantitySold, 0),
      totalReturned: staffInventories.reduce((sum, inv) => sum + inv.quantityReturned, 0),
      totalRemaining: staffInventories.reduce((sum, inv) => sum + (inv.quantityGiven - inv.quantitySold - inv.quantityReturned), 0)
    };

    console.log(`🔄 Inventory return processed:`, {
      staff: inventory.staff.name,
      product: inventory.product.name,
      quantityReturned: returnQuantity,
      previousReturned: inventory.quantityReturned,
      newTotalReturned: updatedInventory.quantityReturned,
      weekInfo: weekInfo || 'No week specified'
    });

    return NextResponse.json({
      success: true,
      message: `Successfully returned ${returnQuantity} ${inventory.product.name}(s)`,
      data: {
        inventory: updatedInventory,
        staff: inventory.staff,
        product: inventory.product,
        returnDetails: {
          quantity: returnQuantity,
          previousReturned: inventory.quantityReturned,
          newTotal: updatedInventory.quantityReturned,
          remainingAfterReturn: remaining - returnQuantity
        },
        weekInfo,
        inventorySummary
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("❌ Error processing inventory return:", error);
    
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Inventory assignment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        error: "Failed to process inventory return", 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check return status
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: "Valid inventory ID is required" },
        { status: 400 }
      );
    }

    const inventoryId = parseInt(id);

    const inventory = await prisma.staffInventory.findUnique({
      where: { id: inventoryId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            productionCost: true
          }
        },
        staff: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        saleItems: {
          select: {
            id: true,
            quantity: true,
            sale: {
              select: {
                id: true,
                amount: true,
                date: true
              }
            }
          }
        }
      }
    });

    if (!inventory) {
      return NextResponse.json(
        { error: "Inventory assignment not found" },
        { status: 404 }
      );
    }

    // Calculate statistics
    const remaining = inventory.quantityGiven - inventory.quantitySold - inventory.quantityReturned;
    const sellThroughRate = inventory.quantityGiven > 0 ? (inventory.quantitySold / inventory.quantityGiven) * 100 : 0;
    
    // Calculate values
    const productCost = inventory.product?.productionCost || inventory.product?.price * 0.7 || 0;
    const totalCost = productCost * inventory.quantityGiven;
    const salesValue = inventory.saleItems.reduce((sum, item) => sum + item.sale.amount, 0);

    // Check if this is for current week
    const isCurrentWeek = inventory.weekStartDate && inventory.weekEndDate;
    let weekInfo = null;
    
    if (isCurrentWeek) {
      const now = new Date();
      weekInfo = {
        weekStartDate: inventory.weekStartDate,
        weekEndDate: inventory.weekEndDate,
        isCurrentWeek: now >= new Date(inventory.weekStartDate!) && now <= new Date(inventory.weekEndDate!),
        weekRange: `${inventory.weekStartDate?.toLocaleDateString()} - ${inventory.weekEndDate?.toLocaleDateString()}`
      };
    }

    return NextResponse.json({
      inventory,
      statistics: {
        quantityGiven: inventory.quantityGiven,
        quantitySold: inventory.quantitySold,
        quantityReturned: inventory.quantityReturned,
        remaining,
        sellThroughRate: sellThroughRate.toFixed(2) + '%',
        financials: {
          productCost,
          totalInventoryCost: totalCost,
          estimatedSalesValue: salesValue
        }
      },
      canReturn: remaining > 0,
      maxReturnQuantity: remaining,
      weekInfo,
      linkedSales: inventory.saleItems.map(item => ({
        saleId: item.sale.id,
        saleAmount: item.sale.amount,
        saleDate: item.sale.date,
        quantity: item.quantity
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Error fetching inventory return status:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory return status", details: error.message },
      { status: 500 }
    );
  }
}