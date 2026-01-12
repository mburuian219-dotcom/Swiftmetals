import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{
    id: string;
  }>;
}

// Helper: Get current week dates (Monday to Sunday)
function getCurrentWeekDates() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // If it's Sunday (0), we need to get previous Monday
  let diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { weekStartDate: monday, weekEndDate: sunday };
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: "Valid staff ID is required" },
        { status: 400 }
      );
    }

    const staffId = parseInt(id);
    
    // Get staff info
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, name: true, email: true }
    });

    if (!staff) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      );
    }

    // Get current week dates
    const { weekStartDate, weekEndDate } = getCurrentWeekDates();
    
    console.log(`📅 Closing week for staff ${staff.name} (ID: ${staffId})`, {
      weekStartDate,
      weekEndDate,
      weekRange: `${weekStartDate.toISOString().split('T')[0]} to ${weekEndDate.toISOString().split('T')[0]}`
    });

    // Find all inventory assignments for current week
    const currentWeekInventory = await prisma.staffInventory.findMany({
      where: {
        staffId,
        weekStartDate: { lte: weekEndDate },
        weekEndDate: { gte: weekStartDate }
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            productionCost: true
          }
        }
      }
    });

    console.log(`📊 Found ${currentWeekInventory.length} inventory assignments for current week`);

    if (currentWeekInventory.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No current week inventory found to close",
        staff: {
          id: staff.id,
          name: staff.name
        },
        weekInfo: {
          weekStartDate,
          weekEndDate
        },
        closedAssignments: 0,
        totalItemsReturned: 0
      });
    }

    const updates = [];
    const closedAssignments = [];
    let totalItemsReturned = 0;

    // Process each inventory assignment
    for (const inventory of currentWeekInventory) {
      const remaining = inventory.quantityGiven - inventory.quantitySold - inventory.quantityReturned;
      
      if (remaining > 0) {
        // Update inventory to mark remaining as returned
        const updatedInventory = await prisma.staffInventory.update({
          where: { id: inventory.id },
          data: {
            quantityReturned: inventory.quantityReturned + remaining,
            updatedAt: new Date()
          }
        });

        totalItemsReturned += remaining;
        
        closedAssignments.push({
          inventoryId: inventory.id,
          productId: inventory.productId,
          productName: inventory.product.name,
          quantityGiven: inventory.quantityGiven,
          quantitySold: inventory.quantitySold,
          quantityReturnedBefore: inventory.quantityReturned,
          quantityReturnedNow: remaining,
          newTotalReturned: updatedInventory.quantityReturned,
          remainingBefore: remaining
        });

        console.log(`✅ Closed inventory ${inventory.id}: Returned ${remaining} ${inventory.product.name}`);
      }
    }

    // Get updated summary for the closed week
    const updatedWeekInventory = await prisma.staffInventory.findMany({
      where: {
        staffId,
        weekStartDate: { lte: weekEndDate },
        weekEndDate: { gte: weekStartDate }
      },
      include: {
        product: {
          select: {
            name: true,
            productionCost: true,
            price: true
          }
        }
      }
    });

    const weekSummary = {
      totalAssignments: updatedWeekInventory.length,
      totalGiven: updatedWeekInventory.reduce((sum, a) => sum + a.quantityGiven, 0),
      totalSold: updatedWeekInventory.reduce((sum, a) => sum + a.quantitySold, 0),
      totalReturned: updatedWeekInventory.reduce((sum, a) => sum + a.quantityReturned, 0),
      totalRemaining: updatedWeekInventory.reduce((sum, a) => sum + (a.quantityGiven - a.quantitySold - a.quantityReturned), 0),
      // Calculate values
      inventoryCost: updatedWeekInventory.reduce((sum, a) => {
        const cost = a.product?.productionCost || a.product?.price * 0.7 || 0;
        return sum + (cost * a.quantityGiven);
      }, 0),
      salesValue: updatedWeekInventory.reduce((sum, a) => {
        return sum + (a.product?.price || 0) * a.quantitySold;
      }, 0),
      sellThroughRate: updatedWeekInventory.reduce((sum, a) => sum + a.quantityGiven, 0) > 0
        ? (updatedWeekInventory.reduce((sum, a) => sum + a.quantitySold, 0) / 
           updatedWeekInventory.reduce((sum, a) => sum + a.quantityGiven, 0)) * 100
        : 0
    };

    console.log(`📊 Week closed successfully for staff ${staff.name}:`, {
      assignmentsClosed: closedAssignments.length,
      totalItemsReturned,
      weekSummary
    });

    return NextResponse.json({
      success: true,
      message: `Successfully closed current week for ${staff.name}. ${closedAssignments.length} assignments updated, ${totalItemsReturned} items returned.`,
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email
      },
      weekInfo: {
        weekStartDate,
        weekEndDate,
        weekRange: `${weekStartDate.toLocaleDateString()} - ${weekEndDate.toLocaleDateString()}`
      },
      closedAssignments,
      totalItemsReturned,
      weekSummary,
      performance: {
        efficiency: weekSummary.sellThroughRate.toFixed(2) + '%',
        inventoryTurnover: weekSummary.totalSold > 0 ? (weekSummary.salesValue / weekSummary.inventoryCost).toFixed(2) : '0.00'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("❌ Error closing week:", error);
    return NextResponse.json(
      { 
        error: "Failed to close week", 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check current week status
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: "Valid staff ID is required" },
        { status: 400 }
      );
    }

    const staffId = parseInt(id);
    
    // Get staff info
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, name: true, email: true }
    });

    if (!staff) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      );
    }

    // Get current week dates
    const { weekStartDate, weekEndDate } = getCurrentWeekDates();
    
    // Find all inventory assignments for current week
    const currentWeekInventory = await prisma.staffInventory.findMany({
      where: {
        staffId,
        weekStartDate: { lte: weekEndDate },
        weekEndDate: { gte: weekStartDate }
      },
      include: {
        product: {
          select: {
            name: true,
            productionCost: true,
            price: true
          }
        }
      }
    });

    // Calculate week summary
    const totalGiven = currentWeekInventory.reduce((sum, a) => sum + a.quantityGiven, 0);
    const totalSold = currentWeekInventory.reduce((sum, a) => sum + a.quantitySold, 0);
    const totalReturned = currentWeekInventory.reduce((sum, a) => sum + a.quantityReturned, 0);
    const totalRemaining = totalGiven - totalSold - totalReturned;
    
    // Calculate values
    const inventoryCost = currentWeekInventory.reduce((sum, a) => {
      const cost = a.product?.productionCost || a.product?.price * 0.7 || 0;
      return sum + (cost * a.quantityGiven);
    }, 0);
    
    const salesValue = currentWeekInventory.reduce((sum, a) => {
      return sum + (a.product?.price || 0) * a.quantitySold;
    }, 0);
    
    const sellThroughRate = totalGiven > 0 ? (totalSold / totalGiven) * 100 : 0;

    // Check if week can be closed (has remaining inventory)
    const canCloseWeek = totalRemaining > 0 && currentWeekInventory.length > 0;

    return NextResponse.json({
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email
      },
      weekInfo: {
        weekStartDate,
        weekEndDate,
        weekRange: `${weekStartDate.toLocaleDateString()} - ${weekEndDate.toLocaleDateString()}`,
        isCurrentWeek: true
      },
      inventory: {
        assignments: currentWeekInventory.length,
        totalGiven,
        totalSold,
        totalReturned,
        totalRemaining,
        inventoryCost,
        salesValue,
        sellThroughRate: sellThroughRate.toFixed(2) + '%',
        canCloseWeek
      },
      assignments: currentWeekInventory.map(inv => ({
        id: inv.id,
        productId: inv.productId,
        productName: inv.product?.name,
        quantityGiven: inv.quantityGiven,
        quantitySold: inv.quantitySold,
        quantityReturned: inv.quantityReturned,
        remaining: inv.quantityGiven - inv.quantitySold - inv.quantityReturned,
        weekStartDate: inv.weekStartDate,
        weekEndDate: inv.weekEndDate
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Error getting week status:", error);
    return NextResponse.json(
      { error: "Failed to get week status", details: error.message },
      { status: 500 }
    );
  }
}