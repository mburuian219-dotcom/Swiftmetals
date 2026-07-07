// @ts-nocheck
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
    const body = await req.json();
    
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

    // Get dates from request body, or use current week if not provided
    let weekStartDate: Date;
    let weekEndDate: Date;
    let closeAllWeeks = body.closeAllWeeks || false;
    
    if (body.weekStart && body.weekEnd && !closeAllWeeks) {
      weekStartDate = new Date(body.weekStart);
      weekEndDate = new Date(body.weekEnd);
      // Set to start/end of day
      weekStartDate.setHours(0, 0, 0, 0);
      weekEndDate.setHours(23, 59, 59, 999);
    } else {
      // Use current week as fallback
      const currentWeek = getCurrentWeekDates();
      weekStartDate = currentWeek.weekStartDate;
      weekEndDate = currentWeek.weekEndDate;
    }
    
    console.log(`📅 Closing week for staff ${staff.name} (ID: ${staffId})`, {
      weekStartDate,
      weekEndDate,
      weekRange: `${weekStartDate.toISOString().split('T')[0]} to ${weekEndDate.toISOString().split('T')[0]}`,
      closeAllWeeks
    });

    // Build the where clause
    let whereClause: any = {
      staffId,
    };

    if (!closeAllWeeks) {
      // Find inventory for specific week - using overlapping date range
      whereClause = {
        ...whereClause,
        OR: [
          // Exact match
          {
            weekStartDate: {
              gte: weekStartDate,
              lte: weekEndDate
            },
            weekEndDate: {
              gte: weekStartDate,
              lte: weekEndDate
            }
          },
          // Overlapping
          {
            weekStartDate: {
              lte: weekEndDate
            },
            weekEndDate: {
              gte: weekStartDate
            }
          }
        ]
      };
    }

    // Find all inventory assignments
    const inventoryAssignments = await prisma.staffInventory.findMany({
      where: whereClause,
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

    console.log(`📊 Found ${inventoryAssignments.length} inventory assignments`);

    if (inventoryAssignments.length === 0) {
      // If closing all weeks, check if there's any inventory at all
      if (closeAllWeeks) {
        const anyInventory = await prisma.staffInventory.findMany({
          where: { staffId },
          include: {
            product: {
              select: {
                name: true
              }
            }
          }
        });

        if (anyInventory.length === 0) {
          return NextResponse.json({
            success: true,
            message: "No inventory found for this staff member",
            staff: {
              id: staff.id,
              name: staff.name
            },
            closedAssignments: 0,
            totalItemsReturned: 0
          });
        }

        // Process all inventory with remaining items
        const closedAssignments = [];
        let totalItemsReturned = 0;

        for (const inventory of anyInventory) {
          const remaining = inventory.quantityGiven - inventory.quantitySold - inventory.quantityReturned;
          
          if (remaining > 0) {
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
              remainingBefore: remaining,
              weekStart: inventory.weekStartDate,
              weekEnd: inventory.weekEndDate
            });

            console.log(`✅ Closed inventory ${inventory.id}: Returned ${remaining} ${inventory.product.name}`);
          }
        }

        return NextResponse.json({
          success: true,
          message: `Closed all weeks for ${staff.name}. ${closedAssignments.length} assignments updated, ${totalItemsReturned} items returned.`,
          staff: {
            id: staff.id,
            name: staff.name,
            email: staff.email
          },
          closedAssignments,
          totalItemsReturned,
          timestamp: new Date().toISOString()
        });
      }

      return NextResponse.json({
        success: true,
        message: "No inventory found for the specified week",
        staff: {
          id: staff.id,
          name: staff.name
        },
        weekInfo: {
          weekStartDate,
          weekEndDate,
          weekRange: `${weekStartDate.toLocaleDateString()} - ${weekEndDate.toLocaleDateString()}`
        },
        closedAssignments: 0,
        totalItemsReturned: 0
      });
    }

    const closedAssignments = [];
    let totalItemsReturned = 0;

    // Process each inventory assignment
    for (const inventory of inventoryAssignments) {
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
          remainingBefore: remaining,
          weekStart: inventory.weekStartDate,
          weekEnd: inventory.weekEndDate
        });

        console.log(`✅ Closed inventory ${inventory.id}: Returned ${remaining} ${inventory.product.name}`);
      }
    }

    // Get updated summary
    const updatedInventory = await prisma.staffInventory.findMany({
      where: {
        staffId,
        ...(closeAllWeeks ? {} : {
          OR: [
            {
              weekStartDate: {
                gte: weekStartDate,
                lte: weekEndDate
              },
              weekEndDate: {
                gte: weekStartDate,
                lte: weekEndDate
              }
            },
            {
              weekStartDate: {
                lte: weekEndDate
              },
              weekEndDate: {
                gte: weekStartDate
              }
            }
          ]
        })
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
      totalAssignments: updatedInventory.length,
      totalGiven: updatedInventory.reduce((sum, a) => sum + a.quantityGiven, 0),
      totalSold: updatedInventory.reduce((sum, a) => sum + a.quantitySold, 0),
      totalReturned: updatedInventory.reduce((sum, a) => sum + a.quantityReturned, 0),
      totalRemaining: updatedInventory.reduce((sum, a) => sum + (a.quantityGiven - a.quantitySold - a.quantityReturned), 0),
      inventoryCost: updatedInventory.reduce((sum, a) => {
        const cost = a.product?.productionCost || a.product?.price * 0.7 || 0;
        return sum + (cost * a.quantityGiven);
      }, 0),
      salesValue: updatedInventory.reduce((sum, a) => {
        return sum + (a.product?.price || 0) * a.quantitySold;
      }, 0),
      sellThroughRate: updatedInventory.reduce((sum, a) => sum + a.quantityGiven, 0) > 0
        ? (updatedInventory.reduce((sum, a) => sum + a.quantitySold, 0) / 
           updatedInventory.reduce((sum, a) => sum + a.quantityGiven, 0)) * 100
        : 0
    };

    console.log(`📊 Week closed successfully for staff ${staff.name}:`, {
      assignmentsClosed: closedAssignments.length,
      totalItemsReturned,
      weekSummary
    });

    return NextResponse.json({
      success: true,
      message: `Successfully closed week(s) for ${staff.name}. ${closedAssignments.length} assignments updated, ${totalItemsReturned} items returned.`,
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

    // Get all inventory for this staff
    const allInventory = await prisma.staffInventory.findMany({
      where: {
        staffId,
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

    // Calculate totals
    const totalGiven = allInventory.reduce((sum, a) => sum + a.quantityGiven, 0);
    const totalSold = allInventory.reduce((sum, a) => sum + a.quantitySold, 0);
    const totalReturned = allInventory.reduce((sum, a) => sum + a.quantityReturned, 0);
    const totalRemaining = totalGiven - totalSold - totalReturned;

    // Get current week dates
    const { weekStartDate, weekEndDate } = getCurrentWeekDates();
    
    // Find current week inventory
    const currentWeekInventory = allInventory.filter(inv => {
      if (!inv.weekStartDate || !inv.weekEndDate) return false;
      const start = new Date(inv.weekStartDate);
      const end = new Date(inv.weekEndDate);
      return start <= weekEndDate && end >= weekStartDate;
    });

    const currentWeekGiven = currentWeekInventory.reduce((sum, a) => sum + a.quantityGiven, 0);
    const currentWeekSold = currentWeekInventory.reduce((sum, a) => sum + a.quantitySold, 0);
    const currentWeekReturned = currentWeekInventory.reduce((sum, a) => sum + a.quantityReturned, 0);
    const currentWeekRemaining = currentWeekGiven - currentWeekSold - currentWeekReturned;

    // Get all weeks with remaining items
    const weeksWithRemaining = [];
    const weekMap = new Map();

    allInventory.forEach(inv => {
      if (!inv.weekStartDate || !inv.weekEndDate) return;
      const key = `${inv.weekStartDate.toISOString().split('T')[0]}_${inv.weekEndDate.toISOString().split('T')[0]}`;
      if (!weekMap.has(key)) {
        weekMap.set(key, {
          weekStart: inv.weekStartDate,
          weekEnd: inv.weekEndDate,
          given: 0,
          sold: 0,
          returned: 0
        });
      }
      const week = weekMap.get(key);
      week.given += inv.quantityGiven;
      week.sold += inv.quantitySold;
      week.returned += inv.quantityReturned;
    });

    weekMap.forEach((week, key) => {
      const remaining = week.given - week.sold - week.returned;
      if (remaining > 0) {
        weeksWithRemaining.push({
          weekStart: week.weekStart,
          weekEnd: week.weekEnd,
          given: week.given,
          sold: week.sold,
          returned: week.returned,
          remaining: remaining
        });
      }
    });

    return NextResponse.json({
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email
      },
      summary: {
        totalAssignments: allInventory.length,
        totalGiven,
        totalSold,
        totalReturned,
        totalRemaining,
        weeksWithRemaining: weeksWithRemaining.length
      },
      currentWeek: {
        weekStartDate,
        weekEndDate,
        weekRange: `${weekStartDate.toLocaleDateString()} - ${weekEndDate.toLocaleDateString()}`,
        assignments: currentWeekInventory.length,
        given: currentWeekGiven,
        sold: currentWeekSold,
        returned: currentWeekReturned,
        remaining: currentWeekRemaining,
        canClose: currentWeekRemaining > 0 && currentWeekInventory.length > 0
      },
      weeksWithRemaining: weeksWithRemaining,
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