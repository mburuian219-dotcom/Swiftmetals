import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ================== Helper Functions ==================

// Helper to normalize email
function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

// Check if string is a valid email
function isValidEmail(str: string): boolean {
  if (!str) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str);
}

// Check if string is Firebase UID (starts with letter, length > 20, no @)
function isFirebaseUid(str: string): boolean {
  if (!str) return false;
  return /^[a-zA-Z][a-zA-Z0-9]{20,}$/.test(str) && !str.includes('@');
}

// Helper for case-insensitive email search in MySQL
async function findStaffByEmailCaseInsensitive(email: string) {
  if (!email || !isValidEmail(email)) return null;
  
  const normalizedEmail = normalizeEmail(email);
  
  // First try exact match
  let staff = await prisma.staff.findFirst({
    where: { 
      email: normalizedEmail 
    }
  });

  // If not found, try case-insensitive by fetching all and filtering
  if (!staff) {
    const allStaff = await prisma.staff.findMany({
      where: { 
        email: { not: null }
      }
    });
    
    staff = allStaff.find(s => 
      s.email && normalizeEmail(s.email) === normalizedEmail
    ) || null;
  }

  return staff;
}

async function findOrCreateStaff(userEmail: string, userName?: string) {
  if (!userEmail || !isValidEmail(userEmail)) {
    console.log(`⚠️ Invalid email provided for staff lookup: ${userEmail}`);
    return null;
  }

  const normalizedEmail = normalizeEmail(userEmail);
  
  try {
    // Try to find staff by email (case-insensitive)
    let staff = await findStaffByEmailCaseInsensitive(normalizedEmail);

    // If not found, create new staff record
    if (!staff) {
      // Generate readable name from email
      const name = userName || 
        normalizedEmail.split('@')[0]
          .replace(/[._-]/g, ' ')
          .replace(/\b\w/g, (l: string) => l.toUpperCase());
      
      staff = await prisma.staff.create({
        data: {
          name,
          email: normalizedEmail,
          phone: null
        }
      });
      console.log(`👤 Created new staff record: ${staff.name} (${staff.email}) ID: ${staff.id}`);
    } else {
      console.log(`👤 Found existing staff: ${staff.name} (${staff.email}) ID: ${staff.id}`);
    }

    return staff;
  } catch (error: any) {
    console.error("❌ Error in findOrCreateStaff:", error);
    return null;
  }
}

// Helper function to deduct from staff inventory
async function deductStaffInventory(saleId: number, staffId: number, items: Array<{productId: number, quantity: number}>) {
  try {
    console.log(`🔍 Processing staff inventory deductions for sale ${saleId}, staff ${staffId}`);
    
    // Get current week dates
    const now = new Date();
    const dayOfWeek = now.getDay();
    let diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diffToMonday);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    console.log(`📅 Current week: ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`);
    
    const results = [];
    
    for (const item of items) {
      console.log(`🛍️ Processing item: Product ${item.productId}, Quantity ${item.quantity}`);
      
      // Find staff's current week inventory for this product
      const staffInventory = await prisma.staffInventory.findFirst({
        where: {
          staffId: staffId,
          productId: item.productId,
          weekStartDate: {
            lte: weekEnd
          },
          weekEndDate: {
            gte: weekStart
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      if (staffInventory) {
        console.log(`✅ Found staff inventory: ID ${staffInventory.id}, Given: ${staffInventory.quantityGiven}, Sold: ${staffInventory.quantitySold}, Returned: ${staffInventory.quantityReturned}`);
        
        // Calculate available quantity
        const availableQuantity = staffInventory.quantityGiven - staffInventory.quantitySold - staffInventory.quantityReturned;
        
        if (availableQuantity >= item.quantity) {
          // Update staff inventory quantity sold
          const updatedInventory = await prisma.staffInventory.update({
            where: { id: staffInventory.id },
            data: {
              quantitySold: staffInventory.quantitySold + item.quantity,
              updatedAt: new Date()
            }
          });
          
          console.log(`📉 Updated staff inventory ${staffInventory.id}: Sold +${item.quantity} = ${updatedInventory.quantitySold} total sold`);
          
          // Find the specific sale item to link it
          const saleItemRecord = await prisma.saleitem.findFirst({
            where: {
              saleId: saleId,
              productId: item.productId
            },
            orderBy: { id: 'desc' }
          });
          
          if (saleItemRecord) {
            // Link sale item to staff inventory
            await prisma.saleitem.update({
              where: { id: saleItemRecord.id },
              data: { 
                staffInventoryId: staffInventory.id 
              }
            });
            
            console.log(`🔗 Linked sale item ${saleItemRecord.id} to staff inventory ${staffInventory.id}`);
            
            results.push({
              productId: item.productId,
              status: 'SUCCESS',
              staffInventoryId: staffInventory.id,
              quantityDeducted: item.quantity,
              newTotalSold: updatedInventory.quantitySold
            });
          }
        } else {
          console.warn(`⚠️ Insufficient staff inventory for product ${item.productId}. Available: ${availableQuantity}, Requested: ${item.quantity}`);
          
          // Still try to use what's available
          if (availableQuantity > 0) {
            const updatedInventory = await prisma.staffInventory.update({
              where: { id: staffInventory.id },
              data: {
                quantitySold: staffInventory.quantitySold + availableQuantity,
                updatedAt: new Date()
              }
            });
            
            console.log(`📉 Used available staff inventory: ${availableQuantity} items (of ${item.quantity} requested)`);
            
            // Link sale item if found
            const saleItemRecord = await prisma.saleitem.findFirst({
              where: {
                saleId: saleId,
                productId: item.productId
              },
              orderBy: { id: 'desc' }
            });
            
            if (saleItemRecord) {
              await prisma.saleitem.update({
                where: { id: saleItemRecord.id },
                data: { 
                  staffInventoryId: staffInventory.id 
                }
              });
            }
            
            results.push({
              productId: item.productId,
              status: 'PARTIAL',
              staffInventoryId: staffInventory.id,
              quantityDeducted: availableQuantity,
              quantityRequested: item.quantity,
              newTotalSold: updatedInventory.quantitySold
            });
          } else {
            results.push({
              productId: item.productId,
              status: 'NO_STOCK',
              staffInventoryId: staffInventory.id,
              quantityDeducted: 0,
              quantityRequested: item.quantity
            });
          }
        }
      } else {
        console.log(`ℹ️ No staff inventory found for product ${item.productId} in current week`);
        
        results.push({
          productId: item.productId,
          status: 'NO_INVENTORY',
          quantityRequested: item.quantity
        });
      }
    }
    
    console.log(`✅ Completed staff inventory deductions`);
    return {
      success: true,
      results: results
    };
    
  } catch (error: any) {
    console.error("❌ Error in deductStaffInventory:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

function processSale(sale: any) {
  const totalPaid = sale.payment
    .filter((p: any) => p.status === "CLEARED" || p.status === "COMPLETED")
    .reduce((sum: number, p: any) => sum + p.amount, 0);

  const pendingPayments = sale.payment.filter((p: any) => 
    p.status === "PENDING" || p.status === "BOUNCED"
  );
  const remainingAmount = sale.amount - totalPaid;

  let status: "UNPAID" | "PARTIAL" | "PAID" = "UNPAID";
  if (remainingAmount <= 0 && pendingPayments.length === 0) status = "PAID";
  else if (totalPaid > 0 || pendingPayments.length > 0) status = "PARTIAL";

  return {
    ...sale,
    saleitems: sale.saleitem,
    payments: sale.payment,
    totalPaid,
    remainingAmount,
    status,
    createdBy: sale.createdBy || "SYSTEM",
    updatedBy: sale.updatedBy || "SYSTEM",
    staff: sale.staff || null
  };
}

// ================== GET ALL SALES ==================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get('staffId');
    const createdBy = searchParams.get('createdBy');
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    // Build where clause
    const where: any = {};
    
    if (staffId) {
      where.createdById = parseInt(staffId);
    }
    
    if (createdBy && isValidEmail(createdBy)) {
      const normalizedSearch = normalizeEmail(createdBy);
      where.createdBy = { contains: normalizedSearch };
    }
    
    if (customerId) {
      where.customerId = parseInt(customerId);
    }
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        customer: true,
        saleitem: { 
          include: { 
            product: true,
            staffInventory: true
          } 
        },
        payment: true,
        staff: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(sales.map(processSale));
  } catch (err: any) {
    console.error("❌ Fetch sales error:", err);
    return NextResponse.json([], { status: 500 });
  }
}

// ================== CREATE SALE (WITH STAFF INVENTORY DEDUCTION) ==================
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    console.log("📨 Creating sale...");
    
    // ✅ EXTRACT USER INFO
    let userId = "";
    let userEmail = "";
    let userName = "";
    
    // Check for structured auth info first
    if (data.authInfo) {
      userId = data.authInfo.userId || data.authInfo.uid || "";
      userEmail = data.authInfo.email || "";
      userName = data.authInfo.name || data.authInfo.displayName || "";
    }
    
    // If no structured auth info, check individual fields
    if (!userEmail) {
      const possibleEmailFields = ['email', 'userEmail', 'createdBy', 'userName', 'user'];
      for (const field of possibleEmailFields) {
        if (data[field] && isValidEmail(data[field])) {
          userEmail = data[field];
          break;
        }
      }
    }
    
    if (!userId) {
      const possibleUidFields = ['userId', 'uid', 'userEmail', 'createdBy'];
      for (const field of possibleUidFields) {
        if (data[field] && isFirebaseUid(data[field])) {
          userId = data[field];
          break;
        }
      }
    }
    
    if (!userName && userEmail) {
      userName = userEmail.split('@')[0]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (l: string) => l.toUpperCase());
    }
    
    // If still no email, use a placeholder
    if (!userEmail) {
      userEmail = userId ? `${userId}@firebase.uid` : "unknown@example.com";
    }
    
    // ALWAYS normalize the email
    const normalizedUserEmail = normalizeEmail(userEmail);
    
    console.log("👤 Extracted user info:", {
      userId: userId,
      userEmail: normalizedUserEmail,
      userName: userName,
      isFirebaseUid: isFirebaseUid(userId),
      isValidEmail: isValidEmail(normalizedUserEmail)
    });
    
    // ✅ CRITICAL: Find or create staff record
    let staffRecord = null;
    let staffId = null;
    
    if (isValidEmail(normalizedUserEmail)) {
      staffRecord = await findOrCreateStaff(normalizedUserEmail, userName);
      if (staffRecord) {
        staffId = staffRecord.id;
        console.log(`✅ Sale will be linked to staff: ${staffRecord.name} (ID: ${staffRecord.id})`);
      } else {
        console.log(`⚠️ Could not find/create staff for: ${normalizedUserEmail}`);
      }
    } else {
      console.log(`ℹ️ Skipping staff lookup for: ${normalizedUserEmail} (not a valid email)`);
    }

    const customerId = Number(data.customerId);
    const amount = Number(data.amount);

    if (!customerId || !amount) {
      return NextResponse.json({ error: "Customer ID and amount are required" }, { status: 400 });
    }

    if (!Array.isArray(data.saleItems) || data.saleItems.length === 0) {
      return NextResponse.json({ error: "At least one sale item is required" }, { status: 400 });
    }

    // Validate stock
    for (const item of data.saleItems) {
      const stockItem = await prisma.stock.findFirst({
        where: { productId: item.productId },
        orderBy: { createdAt: "desc" },
      });

      if (!stockItem || stockItem.quantity < item.quantity) {
        return NextResponse.json({ 
          error: `Not enough stock for product ID ${item.productId}. Available: ${stockItem?.quantity || 0}, Requested: ${item.quantity}` 
        }, { status: 400 });
      }
    }

    // Handle payments
    const payments =
      data.payments?.map((p: any) => ({
        amount: Number(p.amount),
        method: p.method,
        referenceId: p.referenceId || null,
        status: p.method === "CHECK" && !p.checkDate ? "PENDING" : "CLEARED",
        checkDate: p.checkDate ? new Date(p.checkDate) : null,
        paidAt: p.paidAt ? new Date(p.paidAt) : new Date(),
      })) || [];

    // ✅ Create sale with PROPER email and staff ID
    const newSale = await prisma.sale.create({
      data: {
        customerId,
        amount,
        date: data.date ? new Date(data.date) : new Date(),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        paymentMethod: data.paymentMethod || "CASH",
        status: "UNPAID",
        createdBy: normalizedUserEmail,
        updatedBy: normalizedUserEmail,
        createdById: staffId,
        payment: { create: payments },
        saleitem: {
          create: data.saleItems.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity,
          })),
        },
      },
      include: {
        customer: true,
        saleitem: { include: { product: true } },
        payment: true,
        staff: true,
      },
    });

    console.log("✅ Sale created successfully:", {
      saleId: newSale.id,
      createdBy: newSale.createdBy,
      createdById: newSale.createdById,
      customer: newSale.customer?.name,
      amount: newSale.amount,
      staffLinked: staffRecord ? `${staffRecord.name} (ID: ${staffRecord.id})` : 'None',
      isEmail: isValidEmail(newSale.createdBy || '')
    });

    // ✅ 1. DEDUCT FROM MAIN STOCK
    console.log("📦 Deducting from main stock...");
    for (const item of data.saleItems) {
      const stockItem = await prisma.stock.findFirst({
        where: { productId: item.productId },
        orderBy: { createdAt: "desc" },
      });
      if (stockItem) {
        await prisma.stock.update({
          where: { id: stockItem.id },
          data: { quantity: stockItem.quantity - item.quantity },
        });
        console.log(`📉 Stock updated: Product ${item.productId} -${item.quantity} = ${stockItem.quantity - item.quantity}`);
      }
    }

    // ✅ 2. DEDUCT FROM STAFF INVENTORY (if staff exists)
    let staffInventoryResult = null;
    if (staffId) {
      console.log("👷 Deducting from staff inventory...");
      staffInventoryResult = await deductStaffInventory(
        newSale.id, 
        staffId, 
        data.saleItems.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      );
      
      if (staffInventoryResult.success) {
        console.log("✅ Staff inventory deductions completed:", staffInventoryResult.results);
      } else {
        console.error("❌ Staff inventory deduction failed:", staffInventoryResult.error);
      }
    } else {
      console.log("ℹ️ No staff ID, skipping staff inventory deduction");
    }

    // Fetch the complete sale with updated staff inventory links
    const completeSale = await prisma.sale.findUnique({
      where: { id: newSale.id },
      include: {
        customer: true,
        saleitem: { 
          include: { 
            product: true,
            staffInventory: true 
          } 
        },
        payment: true,
        staff: true,
      },
    });

    return NextResponse.json({
      ...processSale(completeSale),
      staffInventoryDeduction: staffInventoryResult
    }, { status: 201 });
    
  } catch (err: any) {
    console.error("❌ Sale creation error:", err);
    return NextResponse.json({ 
      error: "Failed to create sale",
      details: err.message 
    }, { status: 500 });
  }
}

// ================== GET SINGLE SALE ==================
export async function GET_SINGLE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid sale ID" }, { status: 400 });
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        saleitem: { 
          include: { 
            product: true,
            staffInventory: true
          } 
        },
        payment: true,
        staff: true,
        paymentschedule: true,
        smsreminder: true,
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    return NextResponse.json(processSale(sale));
  } catch (err: any) {
    console.error("❌ Fetch sale error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ================== UPDATE SALE ==================
export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    const id = Number(data.id);
    
    if (!id) {
      return NextResponse.json({ error: "Sale ID is required" }, { status: 400 });
    }

    // ✅ Get user info
    let userEmail = "";
    let userName = "";
    let userId = "";
    
    if (data.authInfo) {
      userId = data.authInfo.userId || data.authInfo.uid || "";
      userEmail = data.authInfo.email || "";
      userName = data.authInfo.name || data.authInfo.displayName || "";
    }
    
    if (!userEmail) {
      const possibleEmailFields = ['email', 'userEmail', 'createdBy', 'userName', 'user'];
      for (const field of possibleEmailFields) {
        if (data[field] && isValidEmail(data[field])) {
          userEmail = data[field];
          break;
        }
      }
    }
    
    if (!userName && userEmail) {
      userName = userEmail.split('@')[0]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (l: string) => l.toUpperCase());
    }
    
    if (!userEmail) {
      userEmail = "unknown@example.com";
    }
    
    const normalizedUserEmail = normalizeEmail(userEmail);
    
    const existingSale = await prisma.sale.findUnique({
      where: { id },
      include: { saleitem: true, payment: true, staff: true },
    });

    if (!existingSale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // ✅ If sale has no staff link, try to link it now
    let staffId = existingSale.createdById;
    let staffRecord = existingSale.staff;
    
    if (!staffId && isValidEmail(normalizedUserEmail)) {
      staffRecord = await findOrCreateStaff(normalizedUserEmail, userName);
      if (staffRecord) {
        staffId = staffRecord.id;
        console.log(`✅ Linking existing sale ${id} to staff: ${staffRecord.name} (ID: ${staffRecord.id})`);
      }
    }

    const newItems = data.saleItems || existingSale.saleitem;
    const recalculatedAmount = newItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

    // Prepare update data
    const updateData: any = {
      customerId: data.customerId ?? existingSale.customerId,
      amount: recalculatedAmount,
      date: data.date ? new Date(data.date) : existingSale.date,
      dueDate: data.dueDate ? new Date(data.dueDate) : existingSale.dueDate,
      paymentMethod: data.paymentMethod ?? existingSale.paymentMethod,
      updatedBy: normalizedUserEmail,
    };

    // Update createdById if we found a staff and it's currently null
    if (staffId && !existingSale.createdById) {
      updateData.createdById = staffId;
    }

    // Also update createdBy if it's not normalized or contains UID
    if (existingSale.createdBy && 
        (existingSale.createdBy !== normalizedUserEmail || 
         isFirebaseUid(existingSale.createdBy))) {
      updateData.createdBy = normalizedUserEmail;
    }

    // Update sale
    await prisma.sale.update({
      where: { id },
      data: updateData,
    });

    // Replace saleitems if provided
    if (data.saleItems) {
      // Restore staff inventory from old items first
      if (existingSale.createdById) {
        console.log(`🔄 Restoring staff inventory for updated sale ${id}`);
        for (const oldItem of existingSale.saleitem) {
          if (oldItem.staffInventoryId) {
            const staffInventory = await prisma.staffInventory.findUnique({
              where: { id: oldItem.staffInventoryId }
            });
            
            if (staffInventory) {
              await prisma.staffInventory.update({
                where: { id: oldItem.staffInventoryId },
                data: {
                  quantitySold: Math.max(0, staffInventory.quantitySold - oldItem.quantity)
                }
              });
            }
          }
        }
      }
      
      // Delete old items
      await prisma.saleitem.deleteMany({ where: { saleId: id } });
      
      // Create new items
      await prisma.saleitem.createMany({
        data: data.saleItems.map((item: any) => ({
          saleId: id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
        })),
      });
      
      // Apply staff inventory deduction for new items
      if (staffId || existingSale.createdById) {
        const currentStaffId = staffId || existingSale.createdById;
        console.log(`🔄 Applying staff inventory deduction for updated sale ${id}, staff ${currentStaffId}`);
        
        await deductStaffInventory(
          id, 
          currentStaffId!, 
          data.saleItems.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity
          }))
        );
      }
    }

    const updated = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        saleitem: { include: { product: true, staffInventory: true } },
        payment: true,
        staff: true,
      },
    });

    console.log(`✏️ Updated sale ${id}:`, {
      createdBy: updated?.createdBy,
      createdById: updated?.createdById,
      staffLinked: updated?.staff?.name || 'None',
      isEmail: isValidEmail(updated?.createdBy || '')
    });

    return NextResponse.json(processSale(updated));
  } catch (err: any) {
    console.error("❌ Sale update error:", err);
    return NextResponse.json({ 
      error: "Failed to update sale",
      details: err.message 
    }, { status: 500 });
  }
}

// ================== DELETE SALE ==================
export async function DELETE(req: NextRequest) {
  try {
    const data = await req.json();
    const id = Number(data.id);

    if (!id) {
      return NextResponse.json({ error: "Sale ID is required" }, { status: 400 });
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { 
        saleitem: {
          include: {
            staffInventory: true
          }
        },
        staff: true
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Extract user info
    let userEmail = "";
    let userId = "";
    
    if (data.authInfo) {
      userId = data.authInfo.userId || data.authInfo.uid || "";
      userEmail = data.authInfo.email || "";
    }
    
    if (!userEmail) {
      const possibleEmailFields = ['email', 'userEmail', 'createdBy', 'userName'];
      for (const field of possibleEmailFields) {
        if (data[field] && isValidEmail(data[field])) {
          userEmail = data[field];
          break;
        }
      }
    }
    
    if (!userEmail) {
      userEmail = "unknown@example.com";
    }
    
    const normalizedUserEmail = normalizeEmail(userEmail);
    
    console.log(`🗑️ Sale ${id} deleted by: ${normalizedUserEmail}`);
    console.log(`   Sale was linked to staff: ${sale.staff?.name || 'None'} (ID: ${sale.createdById || 'None'})`);
    console.log(`   Original createdBy: ${sale.createdBy} (isEmail: ${isValidEmail(sale.createdBy || '')})`);

    // ✅ 1. RESTORE MAIN STOCK
    console.log("🔄 Restoring main stock...");
    for (const item of sale.saleitem) {
      const stockItem = await prisma.stock.findFirst({
        where: { productId: item.productId },
        orderBy: { createdAt: "desc" },
      });
      if (stockItem) {
        await prisma.stock.update({
          where: { id: stockItem.id },
          data: { quantity: stockItem.quantity + item.quantity },
        });
        console.log(`📈 Stock restored: Product ${item.productId} +${item.quantity} = ${stockItem.quantity + item.quantity}`);
      }
    }

    // ✅ 2. RESTORE STAFF INVENTORY (if staff exists)
    if (sale.createdById) {
      console.log(`🔄 Restoring staff inventory for staff ID: ${sale.createdById}`);
      
      try {
        for (const item of sale.saleitem) {
          if (item.staffInventoryId) {
            // Find the staff inventory
            const staffInventory = await prisma.staffInventory.findUnique({
              where: { id: item.staffInventoryId }
            });
            
            if (staffInventory) {
              // Restore the sold quantity
              const newQuantitySold = Math.max(0, staffInventory.quantitySold - item.quantity);
              await prisma.staffInventory.update({
                where: { id: item.staffInventoryId },
                data: {
                  quantitySold: newQuantitySold,
                  updatedAt: new Date()
                }
              });
              
              console.log(`🔄 Restored ${item.quantity} items to staff inventory ${item.staffInventoryId}: ${staffInventory.quantitySold} -> ${newQuantitySold}`);
            }
          } else {
            console.log(`ℹ️ Sale item ${item.id} not linked to staff inventory`);
          }
        }
        console.log("✅ Staff inventory restoration completed");
      } catch (restoreError: any) {
        console.error("❌ Error restoring staff inventory:", restoreError);
      }
    } else {
      console.log("ℹ️ No staff ID, skipping staff inventory restoration");
    }

    // Delete the sale
    await prisma.sale.delete({ where: { id } });
    
    return NextResponse.json({ 
      success: true,
      message: `Sale deleted successfully`,
      deletedBy: normalizedUserEmail,
      staffLinked: sale.staff?.name || null,
      staffId: sale.createdById,
      saleCreatedBy: sale.createdBy,
      saleCreatedById: sale.createdById,
      itemsRestored: sale.saleitem.length
    });
  } catch (err: any) {
    console.error("❌ Sale delete error:", err);
    return NextResponse.json({ 
      error: "Failed to delete sale",
      details: err.message 
    }, { status: 500 });
  }
}

// ================== PATCH SALE (Partial Update) ==================
export async function PATCH(req: NextRequest) {
  try {
    const data = await req.json();
    const id = Number(data.id);
    
    if (!id) {
      return NextResponse.json({ error: "Sale ID is required" }, { status: 400 });
    }

    // Extract user info
    let userEmail = "";
    if (data.authInfo?.email) {
      userEmail = data.authInfo.email;
    } else if (data.email && isValidEmail(data.email)) {
      userEmail = data.email;
    } else if (data.userEmail && isValidEmail(data.userEmail)) {
      userEmail = data.userEmail;
    }
    
    const normalizedUserEmail = normalizeEmail(userEmail || "unknown@example.com");

    const updateData: any = {
      updatedBy: normalizedUserEmail,
    };

    // Only update provided fields
    if (data.status !== undefined) updateData.status = data.status;
    if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await prisma.sale.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        saleitem: { include: { product: true, staffInventory: true } },
        payment: true,
        staff: true,
      },
    });

    return NextResponse.json(processSale(updated));
  } catch (err: any) {
    console.error("❌ Sale patch error:", err);
    return NextResponse.json({ 
      error: "Failed to update sale",
      details: err.message 
    }, { status: 500 });
  }
}

// ================== SYNC STAFF INVENTORY (Manual sync endpoint) ==================
export async function POST_SYNC(req: NextRequest) {
  try {
    const data = await req.json();
    const staffId = data.staffId;
    
    if (!staffId) {
      return NextResponse.json({ error: "Staff ID is required" }, { status: 400 });
    }

    console.log(`🔄 Syncing staff inventory for staff ID: ${staffId}`);
    
    // Get current week dates
    const now = new Date();
    const dayOfWeek = now.getDay();
    let diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diffToMonday);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    // Get all staff inventory for current week
    const staffInventories = await prisma.staffInventory.findMany({
      where: {
        staffId: staffId,
        weekStartDate: { lte: weekEnd },
        weekEndDate: { gte: weekStart }
      },
      include: {
        product: true
      }
    });
    
    // Get all sales by this staff in current week
    const staffSales = await prisma.sale.findMany({
      where: {
        createdById: staffId,
        date: {
          gte: weekStart,
          lte: weekEnd
        }
      },
      include: {
        saleitem: {
          include: {
            product: true
          }
        }
      }
    });
    
    const results = [];
    let itemsProcessed = 0;
    let errors = 0;
    
    // Process each sale item
    for (const sale of staffSales) {
      for (const saleItem of sale.saleitem) {
        itemsProcessed++;
        
        // Skip if already linked
        if (saleItem.staffInventoryId) {
          continue;
        }
        
        // Find matching staff inventory
        const matchingInventory = staffInventories.find(
          inv => inv.productId === saleItem.productId
        );
        
        if (matchingInventory) {
          // Calculate available quantity
          const availableQuantity = matchingInventory.quantityGiven - 
                                   matchingInventory.quantitySold - 
                                   matchingInventory.quantityReturned;
          
          if (availableQuantity >= saleItem.quantity) {
            // Update staff inventory
            await prisma.staffInventory.update({
              where: { id: matchingInventory.id },
              data: {
                quantitySold: matchingInventory.quantitySold + saleItem.quantity
              }
            });
            
            // Link sale item
            await prisma.saleitem.update({
              where: { id: saleItem.id },
              data: { staffInventoryId: matchingInventory.id }
            });
            
            results.push({
              saleId: sale.id,
              saleItemId: saleItem.id,
              productId: saleItem.productId,
              status: 'SYNCED',
              quantity: saleItem.quantity,
              staffInventoryId: matchingInventory.id
            });
          } else {
            errors++;
            results.push({
              saleId: sale.id,
              saleItemId: saleItem.id,
              productId: saleItem.productId,
              status: 'INSUFFICIENT',
              quantity: saleItem.quantity,
              available: availableQuantity,
              staffInventoryId: matchingInventory.id
            });
          }
        } else {
          errors++;
          results.push({
            saleId: sale.id,
            saleItemId: saleItem.id,
            productId: saleItem.productId,
            status: 'NO_INVENTORY',
            quantity: saleItem.quantity
          });
        }
      }
    }
    
    console.log(`✅ Sync completed: ${itemsProcessed} items processed, ${errors} errors`);
    
    return NextResponse.json({
      success: true,
      summary: {
        staffId,
        weekStart,
        weekEnd,
        itemsProcessed,
        errors,
        results
      }
    });
    
  } catch (err: any) {
    console.error("❌ Sync error:", err);
    return NextResponse.json({ 
      error: "Failed to sync staff inventory",
      details: err.message 
    }, { status: 500 });
  }
}