import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all staff inventory assignments
export async function GET(req: NextRequest) {
  try {
    const staffInventory = await prisma.staffInventory.findMany({
      include: {
        staff: true,
        product: true,
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json(staffInventory);
  } catch (error: any) {
    console.error("Error fetching staff inventory:", error);
    return NextResponse.json(
      { error: "Failed to fetch staff inventory data" },
      { status: 500 }
    );
  }
}

// POST assign inventory to staff (single or multiple items)
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    // Check if this is a return request
    const isReturnRequest = data.action === 'return' && data.inventoryId;
    const isBulkReturnRequest = data.action === 'return-bulk' && data.items;
    const isBulkAssignRequest = data.items && Array.isArray(data.items);
    
    if (isReturnRequest) {
      // Handle single inventory return
      return handleReturnInventory(data);
    } else if (isBulkReturnRequest) {
      // Handle bulk inventory return
      return handleBulkReturnInventory(data);
    } else if (isBulkAssignRequest) {
      // Handle bulk inventory assignment
      return handleBulkAssignInventory(data);
    } else {
      // Handle single inventory assignment
      return handleAssignInventory(data);
    }
  } catch (error: any) {
    console.error("Error in staff inventory POST:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

// Handle bulk assignment of inventory to staff
async function handleBulkAssignInventory(data: any) {
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

  // Validate all items
  const validatedItems = [];
  for (const item of data.items) {
    const productId = parseInt(item.productId);
    const quantityGiven = parseInt(item.quantityGiven);

    if (isNaN(productId) || isNaN(quantityGiven)) {
      return NextResponse.json(
        { error: `Invalid data for item: ${JSON.stringify(item)}` },
        { status: 400 }
      );
    }

    if (quantityGiven <= 0) {
      return NextResponse.json(
        { error: `Quantity must be greater than 0 for item ${productId}` },
        { status: 400 }
      );
    }

    // Check if product exists and has enough stock
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { stock: true }
    });

    if (!product) {
      return NextResponse.json(
        { error: `Product with ID ${productId} not found` },
        { status: 404 }
      );
    }

    // Calculate available stock
    const totalStock = product.stock.reduce((sum, s) => sum + s.quantity, 0);
    if (totalStock < quantityGiven) {
      return NextResponse.json(
        { error: `Insufficient stock for product "${product.name}". Available: ${totalStock}, Requested: ${quantityGiven}` },
        { status: 400 }
      );
    }

    validatedItems.push({
      productId,
      quantityGiven,
      productName: product.name
    });
  }

  // Create assignments in transaction
  const results = [];
  
  try {
    for (const item of validatedItems) {
      // Check for existing assignment to same staff and product
      const existingAssignment = await prisma.staffInventory.findFirst({
        where: {
          staffId,
          productId: item.productId
        }
      });

      let staffInventory;
      
      if (existingAssignment) {
        // Update existing assignment
        staffInventory = await prisma.staffInventory.update({
          where: { id: existingAssignment.id },
          data: {
            quantityGiven: existingAssignment.quantityGiven + item.quantityGiven
          },
          include: {
            staff: true,
            product: true
          }
        });
      } else {
        // Create new staff inventory record
        staffInventory = await prisma.staffInventory.create({
          data: {
            staffId,
            productId: item.productId,
            quantityGiven: item.quantityGiven,
            quantitySold: 0,
            quantityReturned: 0
          },
          include: {
            staff: true,
            product: true
          }
        });
      }
      
      results.push(staffInventory);
    }

    // Log the bulk assignment
    console.log(`Bulk assignment to staff ${staff.name}:`, {
      totalItems: results.length,
      items: results.map(r => ({
        product: r.product.name,
        quantity: r.quantityGiven
      }))
    });

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${results.length} items to ${staff.name}`,
      assignments: results,
      totalAssignments: results.length
    }, { status: 201 });

  } catch (error: any) {
    console.error("Error in bulk assignment:", error);
    return NextResponse.json(
      { error: "Failed to create some or all assignments. Please try again." },
      { status: 500 }
    );
  }
}

// Handle single inventory assignment
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

  // Check for existing assignment to same staff and product
  const existingAssignment = await prisma.staffInventory.findFirst({
    where: {
      staffId,
      productId
    }
  });

  let staffInventory;
  
  if (existingAssignment) {
    // Update existing assignment
    staffInventory = await prisma.staffInventory.update({
      where: { id: existingAssignment.id },
      data: {
        quantityGiven: existingAssignment.quantityGiven + quantityGiven
      },
      include: {
        staff: true,
        product: true
      }
    });
  } else {
    // Create new staff inventory record
    staffInventory = await prisma.staffInventory.create({
      data: {
        staffId,
        productId,
        quantityGiven,
        quantitySold: 0,
        quantityReturned: 0
      },
      include: {
        staff: true,
        product: true
      }
    });
  }

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
    where: { id: inventoryId }
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
      quantityReturned: inventory.quantityReturned + quantityReturned
    },
    include: {
      staff: true,
      product: true
    }
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
      const assignmentId = parseInt(item.assignmentId);

      if (isNaN(quantityReturned) || isNaN(assignmentId)) {
        errors.push(`Invalid data for item: ${JSON.stringify(item)}`);
        continue;
      }

      if (quantityReturned <= 0) {
        errors.push(`Return quantity must be greater than 0 for assignment ${assignmentId}`);
        continue;
      }

      // Get current inventory assignment
      const inventory = await prisma.staffInventory.findUnique({
        where: { id: assignmentId },
        include: { product: true }
      });

      if (!inventory) {
        errors.push(`Inventory assignment ${assignmentId} not found`);
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
        where: { id: assignmentId },
        data: {
          quantityReturned: inventory.quantityReturned + quantityReturned
        },
        include: {
          staff: true,
          product: true
        }
      });

      results.push(updatedInventory);
    } catch (error: any) {
      errors.push(`Error processing assignment ${item.assignmentId}: ${error.message}`);
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
      where: { id: assignmentId }
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
        quantityReturned: inventory.quantityReturned + remaining
      },
      include: {
        staff: true,
        product: true
      }
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
    const updateData: any = {};
    
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

    // Update inventory record
    const updatedInventory = await prisma.staffInventory.update({
      where: { id: inventoryId },
      data: updateData,
      include: {
        staff: true,
        product: true
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
      where: { id: inventoryId }
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

// GET assignments by staff member
export async function GET_STAFF_ASSIGNMENTS(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const staffId = url.searchParams.get("staffId");
    
    if (!staffId) {
      return NextResponse.json(
        { error: "Staff ID is required" },
        { status: 400 }
      );
    }

    const assignments = await prisma.staffInventory.findMany({
      where: {
        staffId: parseInt(staffId)
      },
      include: {
        staff: true,
        product: true,
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json(assignments);
  } catch (error: any) {
    console.error("Error fetching staff assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch staff assignments" },
      { status: 500 }
    );
  }
}