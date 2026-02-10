import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Helper: Get current week dates (Monday to Sunday)
function getCurrentWeekDates() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { weekStartDate: monday, weekEndDate: sunday };
}

// Helper: Check if date is in current week
function isDateInCurrentWeek(date: Date) {
  const { weekStartDate, weekEndDate } = getCurrentWeekDates();
  return date >= weekStartDate && date <= weekEndDate;
}

// Helper: Calculate assignment status
function calculateAssignmentStatus(assignment: any) {
  const remaining = assignment.quantityGiven - assignment.quantitySold - assignment.quantityReturned;
  
  if (remaining === 0) return 'COMPLETED';
  
  const now = new Date();
  const weekEnd = assignment.weekEndDate ? new Date(assignment.weekEndDate) : null;
  
  // Check if week is over
  if (weekEnd && now > weekEnd) {
    return 'OVERDUE';
  }
  
  if (assignment.quantitySold === 0) return 'PENDING';
  return 'ACTIVE';
}

// GET all staff inventory assignments
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const staffId = url.searchParams.get("staffId");
    const includeWeek = url.searchParams.get("includeWeek");
    const weekStart = url.searchParams.get("weekStart");
    const weekEnd = url.searchParams.get("weekEnd");
    const includeAllWeeks = url.searchParams.get("includeAllWeeks") === "true";
    
    let whereClause: any = {};
    
    // Filter by staff
    if (staffId) {
      whereClause.staffId = parseInt(staffId);
    }
    
    // Filter by week dates if provided
    if (weekStart && weekEnd) {
      const startDate = new Date(weekStart);
      const endDate = new Date(weekEnd);
      
      whereClause.AND = [
        { weekStartDate: { lte: endDate } },
        { weekEndDate: { gte: startDate } }
      ];
    }
    // Filter by current week if requested
    else if (includeWeek === "current") {
      const { weekStartDate, weekEndDate } = getCurrentWeekDates();
      whereClause.OR = [
        {
          AND: [
            { weekStartDate: { lte: weekEndDate } },
            { weekEndDate: { gte: weekStartDate } }
          ]
        },
        {
          AND: [
            { weekStartDate: null },
            { weekEndDate: null }
          ]
        }
      ];
    }
    // If includeAllWeeks is true, show all assignments
    // Otherwise, default to showing current week assignments
    else if (!includeAllWeeks) {
      const { weekStartDate, weekEndDate } = getCurrentWeekDates();
      whereClause.OR = [
        {
          AND: [
            { weekStartDate: { lte: weekEndDate } },
            { weekEndDate: { gte: weekStartDate } }
          ]
        },
        {
          weekStartDate: null,
          weekEndDate: null
        }
      ];
    }

    const staffInventory = await prisma.staffInventory.findMany({
      where: whereClause,
      include: {
        staff: true,
        product: true,
        saleItems: {
          include: {
            sale: {
              include: {
                customer: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    // Add calculated fields
    const enrichedInventory = staffInventory.map(assignment => {
      const remaining = assignment.quantityGiven - assignment.quantitySold - assignment.quantityReturned;
      const sellThroughRate = assignment.quantityGiven > 0 
        ? (assignment.quantitySold / assignment.quantityGiven) * 100 
        : 0;
      
      const isCurrentWeek = assignment.weekStartDate && assignment.weekEndDate
        ? isDateInCurrentWeek(new Date(assignment.weekStartDate))
        : false;
      
      return {
        ...assignment,
        remaining,
        sellThroughRate,
        isCurrentWeek,
        totalSalesAmount: assignment.quantitySold * (assignment.product?.price || 0),
        status: calculateAssignmentStatus(assignment)
      };
    });

    return NextResponse.json(enrichedInventory);
  } catch (error: any) {
    console.error("Error fetching staff inventory:", error);
    return NextResponse.json(
      { error: "Failed to fetch staff inventory data", details: error.message },
      { status: 500 }
    );
  }
}

// POST assign inventory to staff (single or multiple items)
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    console.log('Batch assignment request received:', data);
    
    // Check the request type
    const isReturnRequest = data.action === 'return' && data.inventoryId;
    const isBulkReturnRequest = data.action === 'return-bulk' && data.items;
    const isCloseWeekRequest = data.action === 'close-week';
    
    // NEW: Check if this is a batch assignment request (with items array)
    if (data.items && Array.isArray(data.items)) {
      return handleBatchAssignment(data);
    } else if (isReturnRequest) {
      // Handle single inventory return
      return handleReturnInventory(data);
    } else if (isBulkReturnRequest) {
      // Handle bulk inventory return
      return handleBulkReturnInventory(data);
    } else if (isCloseWeekRequest) {
      // Handle close week request
      return handleCloseWeek(data);
    } else {
      // Handle single inventory assignment
      return handleAssignInventory(data);
    }
  } catch (error: any) {
    console.error("Error in staff inventory POST:", error);
    return NextResponse.json(
      { error: "Failed to process request", details: error.message },
      { status: 500 }
    );
  }
}

// NEW: Handle batch assignment (for the /api/staff-inventory/batch endpoint)
async function handleBatchAssignment(data: any) {
  console.log('Processing batch assignment:', data);
  
  // Validation
  if (!data.staffId || !data.items || !Array.isArray(data.items) || data.items.length === 0) {
    return NextResponse.json(
      { error: "Staff and at least one item are required" },
      { status: 400 }
    );
  }

  const staffId = parseInt(data.staffId);

  // Check if staff exists
  const staff = await prisma.staff.findUnique({
    where: { id: staffId }
  });

  if (!staff) {
    return NextResponse.json(
      { error: "Staff member not found" },
      { status: 404 }
    );
  }

  const weekStartDate = data.weekStartDate ? new Date(data.weekStartDate) : null;
  const weekEndDate = data.weekEndDate ? new Date(data.weekEndDate) : null;

  // Validate all items
  const validatedItems = [];
  const validationErrors = [];
  
  for (const item of data.items) {
    const productId = parseInt(item.productId);
    const quantityGiven = parseInt(item.quantityGiven);

    if (isNaN(productId) || isNaN(quantityGiven)) {
      validationErrors.push(`Invalid data for item: ${JSON.stringify(item)}`);
      continue;
    }

    if (quantityGiven <= 0) {
      validationErrors.push(`Quantity must be greater than 0 for item ${productId}`);
      continue;
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { stock: true }
    });

    if (!product) {
      validationErrors.push(`Product with ID ${productId} not found`);
      continue;
    }

    // Check stock availability
    const totalStock = product.stock.reduce((sum, s) => sum + s.quantity, 0);
    if (totalStock < quantityGiven) {
      validationErrors.push(`Insufficient stock for product "${product.name}". Available: ${totalStock}, Requested: ${quantityGiven}`);
      continue;
    }

    validatedItems.push({
      productId,
      quantityGiven,
      productName: product.name,
      price: product.price,
      costPrice: product.productionCost || 0
    });
  }

  if (validatedItems.length === 0) {
    return NextResponse.json({
      success: false,
      error: "No valid items to assign after validation",
      validationErrors
    }, { status: 400 });
  }

  // Process assignments in transaction
  const results = [];
  const errors = [];
  let totalValue = 0;
  
  try {
    for (const item of validatedItems) {
      try {
        console.log(`Processing item: ${item.productName} x ${item.quantityGiven}`);
        
        // Check for existing assignment in the same week
        const existingAssignment = await prisma.staffInventory.findFirst({
          where: {
            staffId,
            productId: item.productId,
            weekStartDate: weekStartDate || null,
            weekEndDate: weekEndDate || null
          }
        });

        let assignment;
        
        if (existingAssignment) {
          console.log(`Updating existing assignment ID: ${existingAssignment.id}`);
          // Update existing assignment
          assignment = await prisma.staffInventory.update({
            where: { id: existingAssignment.id },
            data: {
              quantityGiven: existingAssignment.quantityGiven + item.quantityGiven,
              updatedAt: new Date()
            },
            include: {
              staff: true,
              product: true
            }
          });
        } else {
          console.log(`Creating new assignment for ${item.productName}`);
          // Create new assignment
          assignment = await prisma.staffInventory.create({
            data: {
              staffId,
              productId: item.productId,
              quantityGiven: item.quantityGiven,
              quantitySold: 0,
              quantityReturned: 0,
              weekStartDate,
              weekEndDate,
              createdAt: new Date(),
              updatedAt: new Date()
            },
            include: {
              staff: true,
              product: true
            }
          });
        }

        // Update stock
        const stockItem = await prisma.stock.findFirst({
          where: { productId: item.productId }
        });

        if (stockItem) {
          await prisma.stock.update({
            where: { id: stockItem.id },
            data: {
              quantity: {
                decrement: item.quantityGiven
              },
              updatedAt: new Date()
            }
          });
        }

        // Create ledger entry
        await prisma.cashledger.create({
          data: {
            date: new Date(),
            description: `Inventory assigned: ${item.quantityGiven} x ${item.productName} to ${staff.name}`,
            type: 'OUT',
            category: 'STAFF_INVENTORY',
            amount: item.quantityGiven * item.costPrice,
            relatedTo: 'STAFF_ASSIGNMENT',
            affectedAccounts: 'STOCK',
            referenceId: assignment.id,
            referenceType: 'STAFF_INVENTORY',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });

        results.push({
          productId: item.productId,
          productName: item.productName,
          success: true,
          quantity: item.quantityGiven,
          assignmentId: assignment.id
        });
        
        totalValue += item.quantityGiven * item.price;

      } catch (error: any) {
        console.error(`Error assigning ${item.productName}:`, error);
        errors.push(`Error assigning ${item.productName}: ${error.message}`);
        
        results.push({
          productId: item.productId,
          productName: item.productName,
          success: false,
          quantity: item.quantityGiven,
          error: error.message
        });
      }
    }

    // Log the batch assignment
    console.log(`Batch assignment completed for staff ${staff.name}:`, {
      totalItems: data.items.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      week: weekStartDate ? `${weekStartDate.toDateString()} - ${weekEndDate?.toDateString()}` : 'No week specified'
    });

    const successfulAssignments = results.filter(r => r.success);
    
    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${successfulAssignments.length} of ${data.items.length} items`,
      assignedCount: successfulAssignments.length,
      failedCount: results.length - successfulAssignments.length,
      totalValue: totalValue,
      details: results,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined
    });

  } catch (error: any) {
    console.error("Error in batch assignment:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to process batch assignment",
      details: error.message
    }, { status: 500 });
  }
}

// Handle single inventory assignment (for backward compatibility)
async function handleAssignInventory(data: any) {
  // Validation
  if (!data.staffId || !data.productId || !data.quantityGiven) {
    return NextResponse.json(
      { error: "Staff, product, and quantity are required" },
      { status: 400 }
    );
  }

  const staffId = parseInt(data.staffId);
  const productId = parseInt(data.productId);
  const quantityGiven = parseInt(data.quantityGiven);

  if (isNaN(staffId) || isNaN(productId) || isNaN(quantityGiven)) {
    return NextResponse.json(
      { error: "Invalid data provided" },
      { status: 400 }
    );
  }

  if (quantityGiven <= 0) {
    return NextResponse.json(
      { error: "Quantity must be greater than 0" },
      { status: 400 }
    );
  }

  // Check if staff exists
  const staff = await prisma.staff.findUnique({
    where: { id: staffId }
  });

  if (!staff) {
    return NextResponse.json(
      { error: "Staff member not found" },
      { status: 404 }
    );
  }

  // Check if product exists and has enough stock
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { stock: true }
  });

  if (!product) {
    return NextResponse.json(
      { error: "Product not found" },
      { status: 404 }
    );
  }

  // Calculate available stock
  const totalStock = product.stock.reduce((sum, s) => sum + s.quantity, 0);
  if (totalStock < quantityGiven) {
    return NextResponse.json(
      { error: `Insufficient stock. Available: ${totalStock}, Requested: ${quantityGiven}` },
      { status: 400 }
    );
  }

  // Check for duplicate weekly assignment
  const weekStartDate = data.weekStartDate ? new Date(data.weekStartDate) : null;
  const weekEndDate = data.weekEndDate ? new Date(data.weekEndDate) : null;
  
  if (weekStartDate && weekEndDate) {
    const existingWeeklyAssignment = await prisma.staffInventory.findFirst({
      where: {
        staffId,
        productId,
        weekStartDate,
        weekEndDate
      }
    });

    if (existingWeeklyAssignment) {
      return NextResponse.json(
        { error: `Staff already has an assignment for this product in the week ${weekStartDate.toDateString()} - ${weekEndDate.toDateString()}` },
        { status: 400 }
      );
    }
  }

  // Check for existing assignment to same staff and product (without weekly dates)
  const existingAssignment = await prisma.staffInventory.findFirst({
    where: {
      staffId,
      productId,
      weekStartDate: weekStartDate || null,
      weekEndDate: weekEndDate || null
    }
  });

  let staffInventory;
  
  if (existingAssignment) {
    // Update existing assignment
    staffInventory = await prisma.staffInventory.update({
      where: { id: existingAssignment.id },
      data: {
        quantityGiven: existingAssignment.quantityGiven + quantityGiven,
        updatedAt: new Date()
      },
      include: {
        staff: true,
        product: true,
        saleItems: {
          include: {
            sale: {
              include: {
                customer: true
              }
            }
          }
        }
      }
    });
  } else {
    // Create new staff inventory record with weekly dates
    staffInventory = await prisma.staffInventory.create({
      data: {
        staffId,
        productId,
        quantityGiven,
        quantitySold: 0,
        quantityReturned: 0,
        weekStartDate,
        weekEndDate,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        staff: true,
        product: true,
        saleItems: {
          include: {
            sale: {
              include: {
                customer: true
              }
            }
          }
        }
      }
    });
  }

  console.log(`📦 Assigned inventory:`, {
    staff: staff.name,
    product: product.name,
    quantity: quantityGiven,
    week: weekStartDate ? `${weekStartDate.toDateString()} - ${weekEndDate?.toDateString()}` : 'No week specified'
  });

  return NextResponse.json(staffInventory, { status: 201 });
}

// Handle single inventory return
async function handleReturnInventory(data: any) {
  if (!data.quantityReturned || !data.inventoryId) {
    return NextResponse.json(
      { error: "Return quantity and inventory ID are required" },
      { status: 400 }
    );
  }

  const quantityReturned = parseInt(data.quantityReturned);
  const inventoryId = parseInt(data.inventoryId);

  if (isNaN(quantityReturned) || isNaN(inventoryId)) {
    return NextResponse.json(
      { error: "Invalid data provided" },
      { status: 400 }
    );
  }

  if (quantityReturned <= 0) {
    return NextResponse.json(
      { error: "Return quantity must be greater than 0" },
      { status: 400 }
    );
  }

  // Get current inventory assignment
  const inventory = await prisma.staffInventory.findUnique({
    where: { id: inventoryId },
    include: {
      product: true,
      staff: true
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
  
  if (quantityReturned > remaining) {
    return NextResponse.json(
      { error: `Cannot return more than remaining quantity (${remaining})` },
      { status: 400 }
    );
  }

  // Update inventory record
  const updatedInventory = await prisma.staffInventory.update({
    where: { id: inventoryId },
    data: {
      quantityReturned: inventory.quantityReturned + quantityReturned,
      updatedAt: new Date()
    },
    include: {
      staff: true,
      product: true,
      saleItems: {
        include: {
          sale: {
            include: {
              customer: true
            }
          }
        }
      }
    }
  });

  console.log(`🔄 Returned inventory:`, {
    staff: inventory.staff.name,
    product: inventory.product.name,
    quantityReturned: quantityReturned,
    totalReturned: updatedInventory.quantityReturned,
    week: inventory.weekStartDate ? `${inventory.weekStartDate.toDateString()} - ${inventory.weekEndDate?.toDateString()}` : 'No week specified'
  });

  return NextResponse.json(updatedInventory);
}

// Handle bulk inventory return
async function handleBulkReturnInventory(data: any) {
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    return NextResponse.json(
      { error: "Items array is required" },
      { status: 400 }
    );
  }

  const results = [];
  const errors = [];

  for (const item of data.items) {
    try {
      const quantityReturned = parseInt(item.quantityReturned);
      const inventoryId = parseInt(item.inventoryId);

      if (isNaN(quantityReturned) || isNaN(inventoryId)) {
        errors.push(`Invalid data for item: ${JSON.stringify(item)}`);
        continue;
      }

      if (quantityReturned <= 0) {
        errors.push(`Return quantity must be greater than 0 for inventory ${inventoryId}`);
        continue;
      }

      // Get current inventory assignment
      const inventory = await prisma.staffInventory.findUnique({
        where: { id: inventoryId },
        include: { product: true, staff: true }
      });

      if (!inventory) {
        errors.push(`Inventory assignment ${inventoryId} not found`);
        continue;
      }

      // Calculate remaining quantity
      const remaining = inventory.quantityGiven - inventory.quantitySold - inventory.quantityReturned;
      
      if (quantityReturned > remaining) {
        errors.push(`Cannot return more than remaining quantity (${remaining}) for ${inventory.product.name}`);
        continue;
      }

      // Update inventory record
      const updatedInventory = await prisma.staffInventory.update({
        where: { id: inventoryId },
        data: {
          quantityReturned: inventory.quantityReturned + quantityReturned,
          updatedAt: new Date()
        },
        include: {
          staff: true,
          product: true,
          saleItems: {
            include: {
              sale: {
                include: {
                  customer: true
                }
              }
            }
          }
        }
      });

      results.push(updatedInventory);
    } catch (error: any) {
      errors.push(`Error processing inventory ${item.inventoryId}: ${error.message}`);
    }
  }

  // Return combined results
  return NextResponse.json({
    success: errors.length === 0,
    message: `Processed ${results.length} returns with ${errors.length} errors`,
    returns: results,
    errors: errors.length > 0 ? errors : undefined
  });
}

// Handle close week
async function handleCloseWeek(data: any) {
  try {
    const staffId = data.staffId ? parseInt(data.staffId) : null;
    
    // Get current week dates
    const { weekStartDate, weekEndDate } = getCurrentWeekDates();
    
    // Build where clause
    let whereClause: any = {
      weekStartDate: { lte: weekEndDate },
      weekEndDate: { gte: weekStartDate }
    };
    
    if (staffId) {
      whereClause.staffId = staffId;
    }
    
    // Find all inventory assignments for current week
    const currentWeekInventory = await prisma.staffInventory.findMany({
      where: whereClause,
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

    if (currentWeekInventory.length === 0) {
      return NextResponse.json({
        success: true,
        message: staffId 
          ? "No current week inventory found for this staff" 
          : "No current week inventory found to close",
        closedAssignments: 0
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

    // Get affected staff names
    const staffNames = [...new Set(currentWeekInventory
      .filter(inv => inv.staff)
      .map(inv => inv.staff.name))];

    return NextResponse.json({
      success: true,
      message: `Successfully closed current week. ${closedAssignments.length} assignments updated, ${totalItemsReturned} items returned.`,
      affectedStaff: staffNames,
      weekInfo: {
        weekStartDate,
        weekEndDate,
        weekRange: `${weekStartDate.toLocaleDateString()} - ${weekEndDate.toLocaleDateString()}`
      },
      closedAssignments,
      totalItemsReturned,
      summary: {
        totalAssignmentsProcessed: currentWeekInventory.length,
        assignmentsClosed: closedAssignments.length,
        totalItemsReturned
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

// Complete an assignment (mark as returned all remaining)
export async function PATCH(req: NextRequest) {
  try {
    const data = await req.json();
    
    if (!data.assignmentId) {
      return NextResponse.json(
        { error: "Assignment ID is required" },
        { status: 400 }
      );
    }

    const assignmentId = parseInt(data.assignmentId);
    
    // Get current inventory assignment
    const inventory = await prisma.staffInventory.findUnique({
      where: { id: assignmentId },
      include: {
        product: true,
        staff: true
      }
    });

    if (!inventory) {
      return NextResponse.json(
        { error: "Inventory assignment not found" },
        { status: 404 }
      );
    }

    // Calculate remaining quantity and mark as returned
    const remaining = inventory.quantityGiven - inventory.quantitySold - inventory.quantityReturned;
    
    const updatedInventory = await prisma.staffInventory.update({
      where: { id: assignmentId },
      data: {
        quantityReturned: inventory.quantityReturned + remaining,
        updatedAt: new Date()
      },
      include: {
        staff: true,
        product: true,
        saleItems: {
          include: {
            sale: {
              include: {
                customer: true
              }
            }
          }
        }
      }
    });

    console.log(`✅ Completed assignment:`, {
      staff: inventory.staff.name,
      product: inventory.product.name,
      returned: remaining,
      week: inventory.weekStartDate ? `${inventory.weekStartDate.toDateString()} - ${inventory.weekEndDate?.toDateString()}` : 'No week specified'
    });

    return NextResponse.json({
      success: true,
      message: `Successfully completed assignment. Returned ${remaining} units of ${updatedInventory.product.name}`,
      assignment: updatedInventory,
      returnedQuantity: remaining
    });

  } catch (error: any) {
    console.error("Error completing assignment:", error);
    
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Inventory assignment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to complete assignment" },
      { status: 500 }
    );
  }
}

// PUT update inventory assignment
export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    
    if (!data.id) {
      return NextResponse.json(
        { error: "Inventory assignment ID is required" },
        { status: 400 }
      );
    }

    const inventoryId = parseInt(data.id);
    
    // Get current inventory assignment
    const inventory = await prisma.staffInventory.findUnique({
      where: { id: inventoryId }
    });

    if (!inventory) {
      return NextResponse.json(
        { error: "Inventory assignment not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (data.quantitySold !== undefined) {
      const quantitySold = parseInt(data.quantitySold);
      if (!isNaN(quantitySold) && quantitySold >= 0) {
        updateData.quantitySold = quantitySold;
      }
    }
    
    if (data.quantityReturned !== undefined) {
      const quantityReturned = parseInt(data.quantityReturned);
      if (!isNaN(quantityReturned) && quantityReturned >= 0) {
        updateData.quantityReturned = quantityReturned;
      }
    }

    // Update weekly dates if provided
    if (data.weekStartDate !== undefined) {
      updateData.weekStartDate = data.weekStartDate ? new Date(data.weekStartDate) : null;
    }
    
    if (data.weekEndDate !== undefined) {
      updateData.weekEndDate = data.weekEndDate ? new Date(data.weekEndDate) : null;
    }

    // Update inventory record
    const updatedInventory = await prisma.staffInventory.update({
      where: { id: inventoryId },
      data: updateData,
      include: {
        staff: true,
        product: true,
        saleItems: {
          include: {
            sale: {
              include: {
                customer: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json(updatedInventory);
  } catch (error: any) {
    console.error("Error updating inventory:", error);
    
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Inventory assignment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update inventory" },
      { status: 500 }
    );
  }
}

// DELETE inventory assignment
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    
    if (!id) {
      return NextResponse.json(
        { error: "Inventory assignment ID is required" },
        { status: 400 }
    );
  }

  const inventoryId = parseInt(id);

  // Check if inventory exists
  const inventory = await prisma.staffInventory.findUnique({
    where: { id: inventoryId },
    include: {
      staff: true,
      product: true
    }
  });

  if (!inventory) {
    return NextResponse.json(
      { error: "Inventory assignment not found" },
      { status: 404 }
    );
  }

  // Check if there are any sales or returns
  if (inventory.quantitySold > 0 || inventory.quantityReturned > 0) {
    return NextResponse.json(
      { error: "Cannot delete inventory assignment with sales or returns. Use the return function instead." },
      { status: 400 }
    );
  }

  // Delete inventory record
  await prisma.staffInventory.delete({
    where: { id: inventoryId }
  });

  console.log(`🗑️ Deleted inventory assignment:`, {
    staff: inventory.staff.name,
    product: inventory.product.name,
    quantity: inventory.quantityGiven,
    week: inventory.weekStartDate ? `${inventory.weekStartDate.toDateString()} - ${inventory.weekEndDate?.toDateString()}` : 'No week specified'
  });

  return NextResponse.json({ 
    success: true,
    message: "Inventory assignment deleted successfully" 
  });
  } catch (error: any) {
    console.error("Error deleting inventory:", error);
    
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Inventory assignment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete inventory assignment" },
      { status: 500 }
    );
  }
}