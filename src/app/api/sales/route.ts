import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ================== Helper Functions ==================

// Define interfaces at the top level
interface ValidationError {
  productId: number;
  productName?: string;
  error: string;
}

interface StaffDeductionResult {
  productId: number;
  productName: string;
  status: string;
  quantityDeducted: number;
  staffInventoryId: number | null;
  availableBefore?: number;
  availableAfter?: number;
  message: string;
}

interface MainStockDeductionResult {
  productId: number;
  productName: string;
  status: string;
  quantityDeducted: number;
  previousQuantity: number;
  newQuantity: number;
  message: string;
}

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

// Check if string is Firebase UID
function isFirebaseUid(str: string): boolean {
  if (!str) return false;
  return /^[a-zA-Z][a-zA-Z0-9]{20,}$/.test(str) && !str.includes('@');
}

// Find staff by email (case-insensitive)
async function findStaffByEmailCaseInsensitive(email: string) {
  if (!email || !isValidEmail(email)) return null;
  
  const normalizedEmail = normalizeEmail(email);
  
  let staff = await prisma.staff.findFirst({
    where: { 
      email: normalizedEmail 
    }
  });

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
    let staff = await findStaffByEmailCaseInsensitive(normalizedEmail);

    if (!staff) {
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

// Get current week range (Monday to Sunday)
function getCurrentWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  
  // Calculate Monday of current week
  let diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diffToMonday);
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return { weekStart, weekEnd };
}

// Check if staff has been assigned inventory
async function checkStaffInventoryAssignment(staffId: number) {
  try {
    console.log(`🔍 Checking if staff ${staffId} has been assigned inventory...`);
    
    const { weekStart, weekEnd } = getCurrentWeekRange();
    
    // Check if staff has any inventory assigned for current week
    const staffInventory = await prisma.staffInventory.findMany({
      where: {
        staffId: staffId,
        weekStartDate: {
          lte: weekEnd
        },
        weekEndDate: {
          gte: weekStart
        }
      }
    });
    
    const hasAssignedInventory = staffInventory.length > 0;
    
    console.log(`📊 Staff ${staffId} inventory check:`, {
      hasAssignedInventory,
      inventoryCount: staffInventory.length,
      weekRange: `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`
    });
    
    return {
      hasAssignedInventory,
      inventoryCount: staffInventory.length,
      staffInventories: staffInventory,
      weekStart,
      weekEnd
    };
  } catch (error: any) {
    console.error("❌ Error checking staff inventory assignment:", error);
    return {
      hasAssignedInventory: false,
      inventoryCount: 0,
      staffInventories: [],
      error: error.message
    };
  }
}

// Check if product is exclusively assigned to another staff member
async function checkProductStaffExclusivity(
  productId: number, 
  currentStaffId: number, 
  weekStart: Date, 
  weekEnd: Date
) {
  try {
    // Get product info for better error messages
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { name: true }
    });
    
    const productName = product?.name || `Product ID ${productId}`;
    
    // Find all staff inventories for this product in current week
    const staffInventories = await prisma.staffInventory.findMany({
      where: {
        productId: productId,
        weekStartDate: {
          lte: weekEnd
        },
        weekEndDate: {
          gte: weekStart
        }
      },
      include: {
        staff: true
      }
    });
    
    if (staffInventories.length === 0) {
      return {
        productId,
        productName,
        isExclusive: false,
        isAssignedToCurrentStaff: false,
        assignedTo: null,
        assignedToName: null,
        assignedToStaffId: null,
        message: `${productName} is not assigned to any staff member`
      };
    }
    
    // Check if current staff is among those with inventory
    const currentStaffInventory = staffInventories.find(
      inv => inv.staffId === currentStaffId
    );
    
    if (currentStaffInventory) {
      return {
        productId,
        productName,
        isExclusive: false,
        isAssignedToCurrentStaff: true,
        assignedTo: currentStaffId,
        assignedToName: currentStaffInventory.staff.name,
        assignedToStaffId: currentStaffId,
        message: `${productName} is assigned to you (${currentStaffInventory.staff.name})`
      };
    }
    
    // If we get here, the product is assigned to OTHER staff
    const assignedStaff = staffInventories[0].staff;
    const assignedInventory = staffInventories[0];
    
    // Calculate available quantity for better error context
    const availableQuantity = assignedInventory.quantityGiven - 
                            assignedInventory.quantitySold - 
                            assignedInventory.quantityReturned;
    
    return {
      productId,
      productName,
      isExclusive: true,
      isAssignedToCurrentStaff: false,
      assignedTo: assignedStaff.id,
      assignedToName: assignedStaff.name,
      assignedToStaffId: assignedStaff.id,
      assignedQuantity: assignedInventory.quantityGiven,
      availableQuantity,
      message: `${productName} is exclusively assigned to ${assignedStaff.name}. Available: ${availableQuantity}/${assignedInventory.quantityGiven}`
    };
    
  } catch (error: any) {
    console.error("❌ Error checking product staff exclusivity:", error);
    return {
      productId,
      productName: `Product ID ${productId}`,
      isExclusive: false,
      isAssignedToCurrentStaff: false,
      assignedTo: null,
      assignedToName: null,
      assignedToStaffId: null,
      error: error.message
    };
  }
}

// Check multiple products for exclusivity
async function validateProductsExclusivity(
  items: Array<{productId: number, quantity: number, productName?: string}>,
  currentStaffId: number,
  weekStart: Date,
  weekEnd: Date
) {
  const exclusivityChecks = [];
  const unauthorizedItems = [];
  
  for (const item of items) {
    const check = await checkProductStaffExclusivity(
      item.productId,
      currentStaffId,
      weekStart,
      weekEnd
    );
    
    exclusivityChecks.push({
      ...check,
      requestedQuantity: item.quantity
    });
    
    if (check.isExclusive) {
      unauthorizedItems.push({
        productId: item.productId,
        productName: check.productName,
        assignedTo: check.assignedToName,
        availableQuantity: check.availableQuantity,
        requestedQuantity: item.quantity
      });
    }
  }
  
  return {
    exclusivityChecks,
    unauthorizedItems,
    hasUnauthorizedItems: unauthorizedItems.length > 0
  };
}

// CORRECTED: Deduct from BOTH staff inventory AND main inventory
async function deductInventoryForStaffSale(
  saleId: number, 
  staffId: number, 
  items: Array<{productId: number, quantity: number}>
) {
  try {
    console.log(`🔍 Processing inventory deductions for sale ${saleId}, staff ${staffId}`);
    
    const { weekStart, weekEnd } = getCurrentWeekRange();
    
    console.log(`📅 Current week: ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`);
    
    const staffResults: StaffDeductionResult[] = [];
    const mainStockResults: MainStockDeductionResult[] = [];
    
    let totalDeductedFromStaff = 0;
    let totalDeductedFromMain = 0;
    
    for (const item of items) {
      // Get product name for better logging
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { name: true }
      });
      
      const productName = product?.name || `Product ${item.productId}`;
      console.log(`🛍️ Processing item: ${productName}, Quantity ${item.quantity}`);
      
      // ========== STEP 1: DEDUCT FROM STAFF INVENTORY (if assigned) ==========
      let staffDeductionResult: StaffDeductionResult = {
        productId: item.productId,
        productName,
        status: 'NO_STAFF_INVENTORY',
        quantityDeducted: 0,
        staffInventoryId: null,
        message: ''
      };
      
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
        
        // Calculate available quantity in staff inventory
        const availableStaffQuantity = staffInventory.quantityGiven - 
                                      staffInventory.quantitySold - 
                                      staffInventory.quantityReturned;
        
        if (availableStaffQuantity >= item.quantity) {
          // Update staff inventory quantity sold
          const updatedStaffInventory = await prisma.staffInventory.update({
            where: { id: staffInventory.id },
            data: {
              quantitySold: staffInventory.quantitySold + item.quantity,
              updatedAt: new Date()
            }
          });
          
          console.log(`📉 Updated staff inventory ${staffInventory.id}: Sold +${item.quantity} = ${updatedStaffInventory.quantitySold} total sold`);
          
          totalDeductedFromStaff += item.quantity;
          
          staffDeductionResult = {
            productId: item.productId,
            productName,
            status: 'SUCCESS',
            quantityDeducted: item.quantity,
            staffInventoryId: staffInventory.id,
            availableBefore: availableStaffQuantity,
            availableAfter: availableStaffQuantity - item.quantity,
            message: `Deducted ${item.quantity} from staff inventory`
          };
          
        } else {
          console.warn(`⚠️ Insufficient staff inventory for ${productName}. Available: ${availableStaffQuantity}, Requested: ${item.quantity}`);
          
          // Use only what's available in staff inventory
          if (availableStaffQuantity > 0) {
            const updatedStaffInventory = await prisma.staffInventory.update({
              where: { id: staffInventory.id },
              data: {
                quantitySold: staffInventory.quantitySold + availableStaffQuantity,
                updatedAt: new Date()
              }
            });
            
            console.log(`📉 Used available staff inventory: ${availableStaffQuantity} items (of ${item.quantity} requested)`);
            
            totalDeductedFromStaff += availableStaffQuantity;
            
            staffDeductionResult = {
              productId: item.productId,
              productName,
              status: 'PARTIAL',
              quantityDeducted: availableStaffQuantity,
              staffInventoryId: staffInventory.id,
              availableBefore: availableStaffQuantity,
              availableAfter: 0,
              message: `Deducted ${availableStaffQuantity} from staff inventory (partial, requested: ${item.quantity})`
            };
          } else {
            staffDeductionResult = {
              productId: item.productId,
              productName,
              status: 'INSUFFICIENT',
              quantityDeducted: 0,
              staffInventoryId: staffInventory.id,
              message: `No available staff inventory (requested: ${item.quantity})`
            };
          }
        }
      } else {
        console.log(`ℹ️ No staff inventory found for ${productName} in current week`);
        staffDeductionResult.message = 'Product not assigned to staff for current week';
      }
      
      staffResults.push(staffDeductionResult);
      
      // ========== STEP 2: DEDUCT FROM MAIN STOCK (ALWAYS for staff sales) ==========
      console.log(`📦 Now deducting from main stock for ${productName}...`);
      
      const mainStockItem = await prisma.stock.findFirst({
        where: { productId: item.productId },
        orderBy: { createdAt: "desc" },
      });
      
      if (!mainStockItem) {
        throw new Error(`${productName} not found in main stock`);
      }
      
      if (mainStockItem.quantity < item.quantity) {
        throw new Error(`Not enough stock for ${productName}. Available: ${mainStockItem.quantity}, Requested: ${item.quantity}`);
      }
      
      // Deduct from main stock
      await prisma.stock.update({
        where: { id: mainStockItem.id },
        data: { 
          quantity: mainStockItem.quantity - item.quantity,
          updatedAt: new Date()
        },
      });
      
      console.log(`📉 Main stock updated: ${productName} -${item.quantity} = ${mainStockItem.quantity - item.quantity}`);
      
      totalDeductedFromMain += item.quantity;
      
      mainStockResults.push({
        productId: item.productId,
        productName,
        status: 'SUCCESS',
        quantityDeducted: item.quantity,
        previousQuantity: mainStockItem.quantity,
        newQuantity: mainStockItem.quantity - item.quantity,
        message: `Deducted ${item.quantity} from main stock`
      });
      
      // ========== STEP 3: LINK SALE ITEM TO STAFF INVENTORY (if applicable) ==========
      if (staffDeductionResult.staffInventoryId) {
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
              staffInventoryId: staffDeductionResult.staffInventoryId 
            }
          });
          
          console.log(`🔗 Linked sale item ${saleItemRecord.id} to staff inventory ${staffDeductionResult.staffInventoryId}`);
        }
      }
    }
    
    console.log(`✅ Completed inventory deductions for staff sale:`);
    console.log(`   Staff Inventory: ${totalDeductedFromStaff} items deducted`);
    console.log(`   Main Stock: ${totalDeductedFromMain} items deducted`);
    
    return {
      success: true,
      staffDeductions: {
        totalDeducted: totalDeductedFromStaff,
        results: staffResults
      },
      mainStockDeductions: {
        totalDeducted: totalDeductedFromMain,
        results: mainStockResults
      },
      summary: {
        totalItemsRequested: items.reduce((sum, item) => sum + item.quantity, 0),
        deductedFromStaff: totalDeductedFromStaff,
        deductedFromMain: totalDeductedFromMain,
        deductionSource: 'STAFF_AND_MAIN_STOCK'
      }
    };
    
  } catch (error: any) {
    console.error("❌ Error in deductInventoryForStaffSale:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Deduct ONLY from main stock (for non-staff sales or when staff has no assigned inventory)
async function deductFromMainStockOnly(items: Array<{productId: number, quantity: number}>) {
  try {
    console.log("📦 Deducting from main stock only...");
    
    const results: Array<{
      productId: number;
      productName: string;
      status: string;
      quantityDeducted: number;
      previousQuantity: number;
      newQuantity: number;
    }> = [];
    
    for (const item of items) {
      // Get product name for better logging
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { name: true }
      });
      
      const productName = product?.name || `Product ${item.productId}`;
      console.log(`🛒 Processing main stock for ${productName}, quantity ${item.quantity}`);
      
      const stockItem = await prisma.stock.findFirst({
        where: { productId: item.productId },
        orderBy: { createdAt: "desc" },
      });
      
      if (!stockItem) {
        throw new Error(`${productName} not found in main stock`);
      }
      
      if (stockItem.quantity < item.quantity) {
        throw new Error(`Not enough stock for ${productName}. Available: ${stockItem.quantity}, Requested: ${item.quantity}`);
      }
      
      // Deduct from main stock
      await prisma.stock.update({
        where: { id: stockItem.id },
        data: { 
          quantity: stockItem.quantity - item.quantity,
          updatedAt: new Date()
        },
      });
      
      console.log(`📉 Main stock updated: ${productName} -${item.quantity} = ${stockItem.quantity - item.quantity}`);
      
      results.push({
        productId: item.productId,
        productName,
        status: 'SUCCESS',
        quantityDeducted: item.quantity,
        previousQuantity: stockItem.quantity,
        newQuantity: stockItem.quantity - item.quantity
      });
    }
    
    return {
      success: true,
      results,
      summary: {
        totalItemsDeducted: items.reduce((sum, item) => sum + item.quantity, 0),
        deductionSource: 'MAIN_STOCK_ONLY'
      }
    };
    
  } catch (error: any) {
    console.error("❌ Error deducting from main stock:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Validate staff inventory for sale
async function validateStaffInventory(staffId: number, items: Array<{productId: number, quantity: number}>) {
  try {
    const { weekStart, weekEnd } = getCurrentWeekRange();
    
    const validationErrors: ValidationError[] = [];
    const validationResults: Array<{
      productId: number;
      productName?: string;
      hasInventory: boolean;
      assigned: boolean;
      availableQuantity?: number;
      requestedQuantity?: number;
      sufficient?: boolean;
      staffInventoryId?: number;
      message?: string;
    }> = [];
    
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { name: true }
      });
      
      // Find staff inventory for this product
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
        }
      });
      
      if (!staffInventory) {
        validationResults.push({
          productId: item.productId,
          productName: product?.name,
          hasInventory: false,
          assigned: false,
          message: 'Not assigned to staff - will deduct from main stock only'
        });
      } else {
        // Calculate available quantity
        const availableQuantity = staffInventory.quantityGiven - 
                                staffInventory.quantitySold - 
                                staffInventory.quantityReturned;
        
        if (availableQuantity < item.quantity) {
          validationErrors.push({
            productId: item.productId,
            productName: product?.name,
            error: `Insufficient staff inventory for ${product?.name || `Product ID ${item.productId}`}. Available: ${availableQuantity}, Requested: ${item.quantity}`
          });
        }
        
        validationResults.push({
          productId: item.productId,
          productName: product?.name,
          hasInventory: true,
          assigned: true,
          availableQuantity,
          requestedQuantity: item.quantity,
          sufficient: availableQuantity >= item.quantity,
          staffInventoryId: staffInventory.id
        });
      }
    }
    
    return {
      isValid: validationErrors.length === 0,
      validationResults,
      validationErrors,
      hasAssignedInventory: validationResults.some(r => r.assigned),
      weekStart,
      weekEnd
    };
    
  } catch (error: any) {
    console.error("❌ Error validating staff inventory:", error);
    return {
      isValid: false,
      validationResults: [],
      validationErrors: [{ error: error.message }] as ValidationError[],
      hasAssignedInventory: false,
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
            staffInventory: {
              include: {
                staff: true
              }
            }
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

// ================== CREATE SALE (WITH CORRECTED INVENTORY DEDUCTION) ==================
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    console.log("📨 Creating sale...");
    console.log("📊 Sale items:", data.saleItems);
    
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
    let staffId: number | null = null;
    
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

    // Validate required fields
    const customerId = Number(data.customerId);
    const amount = Number(data.amount);

    if (!customerId || isNaN(customerId)) {
      return NextResponse.json({ 
        error: "Invalid customer ID",
        details: "Customer ID is required and must be a valid number"
      }, { status: 400 });
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ 
        error: "Invalid amount",
        details: "Sale amount is required and must be greater than 0"
      }, { status: 400 });
    }

    if (!Array.isArray(data.saleItems) || data.saleItems.length === 0) {
      return NextResponse.json({ 
        error: "No sale items provided",
        details: "At least one sale item is required" 
      }, { status: 400 });
    }

    // Validate sale items
    for (const [index, item] of data.saleItems.entries()) {
      if (!item.productId || isNaN(item.productId)) {
        return NextResponse.json({
          error: `Invalid product ID at item ${index + 1}`,
          details: `Item ${index + 1} has an invalid product ID`
        }, { status: 400 });
      }
      
      if (!item.quantity || isNaN(item.quantity) || item.quantity <= 0) {
        return NextResponse.json({
          error: `Invalid quantity at item ${index + 1}`,
          details: `Item ${index + 1} quantity must be greater than 0`
        }, { status: 400 });
      }
      
      if (!item.price || isNaN(item.price) || item.price <= 0) {
        return NextResponse.json({
          error: `Invalid price at item ${index + 1}`,
          details: `Item ${index + 1} price must be greater than 0`
        }, { status: 400 });
      }
    }

    // ✅ CHECK 1: STAFF EXCLUSIVITY VALIDATION
    const { weekStart, weekEnd } = getCurrentWeekRange();
    let hasUnauthorizedItems = false;
    let unauthorizedItemsInfo: Array<{
      productId: number;
      productName: string;
      assignedTo: string | null;
      availableQuantity?: number;
      requestedQuantity: number;
    }> = [];
    
    if (staffId) {
      // Enhanced exclusivity check with product names
      const exclusivityValidation = await validateProductsExclusivity(
        data.saleItems.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity
        })),
        staffId,
        weekStart,
        weekEnd
      );
      
      hasUnauthorizedItems = exclusivityValidation.hasUnauthorizedItems;
      unauthorizedItemsInfo = exclusivityValidation.unauthorizedItems;
      
      console.log("🔍 Exclusivity validation:", {
        staffId,
        staffName: staffRecord?.name,
        totalItems: data.saleItems.length,
        unauthorizedItems: unauthorizedItemsInfo.length
      });
      
      // ❌ BLOCK SALE if unauthorized items found
      if (hasUnauthorizedItems) {
        console.error("🚫 UNAUTHORIZED SALE ATTEMPT:", {
          staffId,
          staffName: staffRecord?.name,
          unauthorizedItems: unauthorizedItemsInfo
        });
        
        // Format error messages for each unauthorized item
        const errorMessages = unauthorizedItemsInfo.map(item => 
          `• ${item.productName} (ID: ${item.productId}) - Assigned to: ${item.assignedTo}`
        );
        
        return NextResponse.json({ 
          error: "UNAUTHORIZED SALE ATTEMPT",
          details: "You cannot sell items that are assigned to other staff members",
          unauthorizedItems: unauthorizedItemsInfo,
          staffAttemptingSale: {
            id: staffId,
            name: staffRecord?.name,
            email: normalizedUserEmail
          },
          message: `The following items are assigned to other staff members and cannot be sold by you:\n${errorMessages.join('\n')}`,
          validationResults: exclusivityValidation.exclusivityChecks
        }, { status: 403 }); // 403 Forbidden
      }
    }

    // ✅ CHECK 2: STAFF INVENTORY VALIDATION
    let staffHasAssignedInventory = false;
    let inventoryValidation = null;
    
    if (staffId) {
      inventoryValidation = await validateStaffInventory(
        staffId,
        data.saleItems.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      );
      
      staffHasAssignedInventory = inventoryValidation.hasAssignedInventory;
      
      console.log("📊 Staff inventory validation:", {
        staffId,
        staffName: staffRecord?.name,
        hasAssignedInventory: staffHasAssignedInventory,
        validationErrors: inventoryValidation.validationErrors.length,
        isValid: inventoryValidation.isValid
      });
      
      // If staff has assigned inventory but validation fails
      if (staffHasAssignedInventory && !inventoryValidation.isValid) {
        const errorMessages = inventoryValidation.validationErrors.map(err => 
          `• ${err.productName || `Product ID ${err.productId}`}: ${err.error}`
        );
        
        return NextResponse.json({
          error: "INSUFFICIENT STAFF INVENTORY",
          details: "You do not have sufficient inventory to complete this sale",
          validationErrors: inventoryValidation.validationErrors,
          staffInfo: {
            id: staffId,
            name: staffRecord?.name,
            email: normalizedUserEmail
          },
          message: `Inventory check failed:\n${errorMessages.join('\n')}`,
          validationResults: inventoryValidation.validationResults
        }, { status: 400 });
      }
    }

    // ✅ CHECK 3: MAIN STOCK VALIDATION (ALWAYS check main stock for ALL sales)
    console.log("🔍 Validating main stock availability...");
    
    for (const item of data.saleItems) {
      // Check main stock availability (ALWAYS required)
      const stockItem = await prisma.stock.findFirst({
        where: { productId: item.productId },
        orderBy: { createdAt: "desc" },
      });
      
      if (!stockItem) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true }
        });
        
        return NextResponse.json({
          error: "PRODUCT NOT IN STOCK",
          details: "Product not found in main stock",
          productId: item.productId,
          productName: product?.name,
          message: `${product?.name || `Product ID ${item.productId}`} is not available in stock`
        }, { status: 400 });
      }
      
      if (stockItem.quantity < item.quantity) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true }
        });
        
        return NextResponse.json({
          error: "INSUFFICIENT STOCK",
          details: "Not enough stock available",
          productId: item.productId,
          productName: product?.name,
          availableQuantity: stockItem.quantity,
          requestedQuantity: item.quantity,
          message: `Not enough stock for ${product?.name || `Product ID ${item.productId}`}. Available: ${stockItem.quantity}, Requested: ${item.quantity}`
        }, { status: 400 });
      }
    }
    
    console.log("✅ All items available in main stock");

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
      inventorySource: staffHasAssignedInventory ? 'STAFF_AND_MAIN_STOCK' : 'MAIN_STOCK_ONLY'
    });

    // ✅ CORRECTED: DEDUCT INVENTORY BASED ON STAFF STATUS
    let inventoryResult = null;
    
    if (staffHasAssignedInventory && staffId) {
      // ✅ CASE 1: Staff HAS assigned inventory - deduct from BOTH staff inventory AND main stock
      console.log("👷📦 Deducting from BOTH staff inventory AND main stock...");
      inventoryResult = await deductInventoryForStaffSale(
        newSale.id, 
        staffId, 
        data.saleItems.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      );
      
      if (!inventoryResult.success) {
        console.error("❌ Inventory deduction failed:", inventoryResult.error);
        // Rollback sale creation
        await prisma.sale.delete({ where: { id: newSale.id } });
        return NextResponse.json({ 
          error: "FAILED TO DEDUCT INVENTORY",
          details: inventoryResult.error,
          message: "Sale created but inventory deduction failed. Sale has been rolled back."
        }, { status: 500 });
      }
      
      console.log("✅ Dual inventory deductions completed successfully");
      
    } else {
      // ✅ CASE 2: Staff has NO assigned inventory - deduct ONLY from main stock
      console.log("📦 Deducting from main stock only...");
      inventoryResult = await deductFromMainStockOnly(
        data.saleItems.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      );
      
      if (!inventoryResult.success) {
        console.error("❌ Main stock deduction failed:", inventoryResult.error);
        // Rollback sale creation
        await prisma.sale.delete({ where: { id: newSale.id } });
        return NextResponse.json({ 
          error: "FAILED TO DEDUCT FROM MAIN STOCK",
          details: inventoryResult.error,
          message: "Sale created but stock deduction failed. Sale has been rolled back."
        }, { status: 500 });
      }
      
      console.log("✅ Main stock deductions completed successfully");
    }

    // Fetch the complete sale with updated inventory links
    const completeSale = await prisma.sale.findUnique({
      where: { id: newSale.id },
      include: {
        customer: true,
        saleitem: { 
          include: { 
            product: true,
            staffInventory: {
              include: {
                staff: true
              }
            }
          } 
        },
        payment: true,
        staff: true,
      },
    });

    return NextResponse.json({
      ...processSale(completeSale),
      inventoryDeduction: {
        source: staffHasAssignedInventory ? 'STAFF_AND_MAIN_STOCK' : 'MAIN_STOCK_ONLY',
        result: inventoryResult,
        staffId,
        staffName: staffRecord?.name,
        hasAssignedInventory: staffHasAssignedInventory,
        summary: inventoryResult.summary
      },
      exclusivityValidation: {
        passed: true,
        message: "All items are authorized for sale",
        unauthorizedItems: []
      }
    }, { status: 201 });
    
  } catch (err: any) {
    console.error("❌ Sale creation error:", err);
    
    // Format error response based on error type
    let errorMessage = "Failed to create sale";
    let statusCode = 500;
    
    if (err.code === 'P2002') {
      errorMessage = "Database constraint violation";
      statusCode = 400;
    } else if (err.code === 'P2003') {
      errorMessage = "Foreign key constraint failed";
      statusCode = 400;
    } else if (err.message?.includes('prisma')) {
      errorMessage = "Database error";
      statusCode = 500;
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: err.message,
      type: err.code || 'UNKNOWN_ERROR'
    }, { status: statusCode });
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
            staffInventory: {
              include: {
                staff: true
              }
            }
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

// ================== UPDATE SALE (WITH CORRECTED INVENTORY LOGIC) ==================
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
      include: { 
        saleitem: {
          include: {
            staffInventory: true
          }
        }, 
        payment: true, 
        staff: true 
      },
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

    // ✅ RESTORE INVENTORY FROM OLD SALE ITEMS FIRST
    console.log(`🔄 Restoring inventory for sale update ${id}...`);
    
    // Get current week range for inventory restoration
    const { weekStart, weekEnd } = getCurrentWeekRange();
    
    for (const oldItem of existingSale.saleitem) {
      // Restore main stock (ALWAYS restore main stock)
      const stockItem = await prisma.stock.findFirst({
        where: { productId: oldItem.productId },
        orderBy: { createdAt: "desc" },
      });
      
      if (stockItem) {
        await prisma.stock.update({
          where: { id: stockItem.id },
          data: { 
            quantity: stockItem.quantity + oldItem.quantity,
            updatedAt: new Date()
          }
        });
        console.log(`📈 Restored ${oldItem.quantity} items to main stock for product ${oldItem.productId}`);
      }
      
      // Restore staff inventory if it was used
      if (oldItem.staffInventoryId && existingSale.createdById) {
        const staffInventory = await prisma.staffInventory.findUnique({
          where: { id: oldItem.staffInventoryId }
        });
        
        if (staffInventory && staffInventory.staffId === existingSale.createdById) {
          const newQuantitySold = Math.max(0, staffInventory.quantitySold - oldItem.quantity);
          await prisma.staffInventory.update({
            where: { id: oldItem.staffInventoryId },
            data: {
              quantitySold: newQuantitySold,
              updatedAt: new Date()
            }
          });
          console.log(`🔄 Restored ${oldItem.quantity} items to staff inventory ${oldItem.staffInventoryId}`);
        }
      }
    }

    const newItems = data.saleItems || existingSale.saleitem;
    const recalculatedAmount = newItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

    // Check if staff has assigned inventory for update
    let staffHasAssignedInventory = false;
    if (staffId) {
      const inventoryCheck = await checkStaffInventoryAssignment(staffId);
      staffHasAssignedInventory = inventoryCheck.hasAssignedInventory;
    }

    // ✅ ENFORCE STAFF EXCLUSIVITY FOR UPDATES
    const validationErrors: string[] = [];
    
    if (data.saleItems && staffId) {
      // Check exclusivity for new items
      for (const item of data.saleItems) {
        const exclusivityCheck = await checkProductStaffExclusivity(
          item.productId,
          staffId,
          weekStart,
          weekEnd
        );
        
        if (exclusivityCheck.isExclusive) {
          validationErrors.push(
            `Product ID ${item.productId} is exclusively assigned to ${exclusivityCheck.assignedToName}. You cannot sell this item.`
          );
        }
      }
      
      if (validationErrors.length > 0) {
        // Re-apply the old inventory deductions since update failed
        console.log("❌ Update failed, reapplying old inventory deductions...");
        await reapplyOldInventoryDeductions(existingSale);
        
        return NextResponse.json({ 
          error: "Unauthorized sale update",
          details: validationErrors,
          staffAttemptingUpdate: {
            id: staffId,
            name: staffRecord?.name,
            email: normalizedUserEmail
          }
        }, { status: 403 });
      }
    }

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
      
      // Apply inventory deduction for new items
      if (staffHasAssignedInventory && staffId) {
        // CORRECTED: Deduct from BOTH staff inventory AND main stock
        await deductInventoryForStaffSale(
          id, 
          staffId, 
          data.saleItems.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity
          }))
        );
      } else {
        // Deduct only from main stock
        await deductFromMainStockOnly(
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
        saleitem: { 
          include: { 
            product: true, 
            staffInventory: {
              include: {
                staff: true
              }
            } 
          } 
        },
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

// Helper function to reapply old inventory deductions
async function reapplyOldInventoryDeductions(sale: any) {
  try {
    console.log(`🔄 Reapplying inventory deductions for sale ${sale.id}...`);
    
    for (const item of sale.saleitem) {
      // Deduct from main stock
      const stockItem = await prisma.stock.findFirst({
        where: { productId: item.productId },
        orderBy: { createdAt: "desc" },
      });
      
      if (stockItem) {
        await prisma.stock.update({
          where: { id: stockItem.id },
          data: { 
            quantity: stockItem.quantity - item.quantity,
            updatedAt: new Date()
          }
        });
      }
      
      // Deduct from staff inventory if applicable
      if (item.staffInventoryId && sale.createdById) {
        const staffInventory = await prisma.staffInventory.findUnique({
          where: { id: item.staffInventoryId }
        });
        
        if (staffInventory && staffInventory.staffId === sale.createdById) {
          await prisma.staffInventory.update({
            where: { id: item.staffInventoryId },
            data: {
              quantitySold: staffInventory.quantitySold + item.quantity,
              updatedAt: new Date()
            }
          });
        }
      }
    }
    
    console.log("✅ Old inventory deductions reapplied");
  } catch (error: any) {
    console.error("❌ Error reapplying inventory deductions:", error);
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
            staffInventory: {
              include: {
                staff: true
              }
            }
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

    // ✅ 1. RESTORE MAIN STOCK (always restore since we might have deducted from it)
    console.log("🔄 Restoring main stock...");
    for (const item of sale.saleitem) {
      const stockItem = await prisma.stock.findFirst({
        where: { productId: item.productId },
        orderBy: { createdAt: "desc" },
      });
      if (stockItem) {
        await prisma.stock.update({
          where: { id: stockItem.id },
          data: { 
            quantity: stockItem.quantity + item.quantity,
            updatedAt: new Date()
          },
        });
        console.log(`📈 Stock restored: Product ${item.productId} +${item.quantity} = ${stockItem.quantity + item.quantity}`);
      }
    }

    // ✅ 2. RESTORE STAFF INVENTORY (if staff exists and inventory was used)
    if (sale.createdById) {
      console.log(`🔄 Checking for staff inventory to restore for staff ID: ${sale.createdById}`);
      
      try {
        for (const item of sale.saleitem) {
          if (item.staffInventoryId) {
            // Find the staff inventory
            const staffInventory = await prisma.staffInventory.findUnique({
              where: { id: item.staffInventoryId }
            });
            
            if (staffInventory) {
              // Check if the staff member still has access to this inventory
              if (staffInventory.staffId !== sale.createdById) {
                console.warn(`⚠️ Warning: Sale ${id} was created by staff ${sale.createdById}, but item ${item.id} uses inventory from staff ${staffInventory.staffId}. Skipping restoration.`);
                continue;
              }
              
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
        saleitem: { 
          include: { 
            product: true, 
            staffInventory: {
              include: {
                staff: true
              }
            } 
          } 
        },
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