import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ================== Helper Functions ==================

// Define interfaces
interface AvailabilityCheckResult {
  productId: number;
  productName: string;
  canSell: boolean;
  availableQuantity: number;
  availableFrom?: 'ASSIGNED_STOCK' | 'UNASSIGNED_STOCK';
  message: string;
  error?: string;
  unassignedStock?: number;
}

interface StaffDeductionResult {
  productId: number;
  productName: string;
  status: string;
  quantityDeducted: number;
  staffInventoryId: number | null;
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
  const dayOfWeek = now.getDay();
  
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

// ================== CORRECTED AVAILABILITY CHECK ==================

// Check product availability with CORRECT unassigned calculation
async function checkProductAvailabilityForStaff(
  productId: number, 
  currentStaffId: number, 
  requestedQuantity: number,
  weekStart: Date, 
  weekEnd: Date
): Promise<AvailabilityCheckResult> {
  try {
    // Get product info
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { name: true }
    });
    
    const productName = product?.name || `Product ID ${productId}`;
    
    // Find if current staff has assignment
    const currentStaffAssignment = await prisma.staffInventory.findFirst({
      where: {
        staffId: currentStaffId,
        productId: productId,
        weekStartDate: {
          lte: weekEnd
        },
        weekEndDate: {
          gte: weekStart
        }
      }
    });
    
    // Get total main stock
    const mainStockItem = await prisma.stock.findFirst({
      where: { productId: productId },
      orderBy: { createdAt: "desc" },
    });
    
    const totalMainStock = mainStockItem ? mainStockItem.quantity : 0;
    
    // Find ALL staff assignments for this product
    const allStaffAssignments = await prisma.staffInventory.findMany({
      where: {
        productId: productId,
        weekStartDate: {
          lte: weekEnd
        },
        weekEndDate: {
          gte: weekStart
        }
      }
    });
    
    // CORRECTED: Calculate REMAINING assigned stock (original - sold - returned)
    let totalRemainingAssigned = 0;
    for (const assignment of allStaffAssignments) {
      const remaining = assignment.quantityGiven - 
                       assignment.quantitySold - 
                       assignment.quantityReturned;
      totalRemainingAssigned += Math.max(0, remaining); // Don't go negative
    }
    
    // CORRECTED: Unassigned = Total - Remaining Assigned
    const unassignedStock = Math.max(0, totalMainStock - totalRemainingAssigned);
    
    console.log(`📊 CORRECTED Availability check for ${productName}:`, {
      productId,
      staffId: currentStaffId,
      totalMainStock,
      totalAssignments: allStaffAssignments.length,
      totalRemainingAssigned,
      unassignedStock,
      requestedQuantity
    });
    
    // ========== RULE 1: STAFF HAS ASSIGNMENT ==========
    if (currentStaffAssignment) {
      // This staff can ONLY sell from their REMAINING assigned quantity
      const staffAvailable = Math.max(0,
        currentStaffAssignment.quantityGiven - 
        currentStaffAssignment.quantitySold - 
        currentStaffAssignment.quantityReturned
      );
      
      if (staffAvailable >= requestedQuantity) {
        return {
          productId,
          productName,
          canSell: true,
          availableQuantity: staffAvailable,
          availableFrom: 'ASSIGNED_STOCK',
          unassignedStock: unassignedStock,
          message: `Available: ${staffAvailable} from your assigned stock`
        };
      } else {
        return {
          productId,
          productName,
          canSell: false,
          availableQuantity: staffAvailable,
          availableFrom: 'ASSIGNED_STOCK',
          unassignedStock: unassignedStock,
          message: `Cannot sell ${requestedQuantity}. You only have ${staffAvailable} available from your assigned stock.`
        };
      }
    }
    // ========== RULE 2: STAFF HAS NO ASSIGNMENT ==========
    else {
      // This staff can ONLY sell from unassigned stock
      if (unassignedStock >= requestedQuantity) {
        return {
          productId,
          productName,
          canSell: true,
          availableQuantity: unassignedStock,
          availableFrom: 'UNASSIGNED_STOCK',
          message: `Available: ${unassignedStock} from unassigned stock`
        };
      } else {
        return {
          productId,
          productName,
          canSell: false,
          availableQuantity: unassignedStock,
          availableFrom: 'UNASSIGNED_STOCK',
          message: `Cannot sell ${requestedQuantity}. Only ${unassignedStock} available in unassigned stock.`
        };
      }
    }
    
  } catch (error: any) {
    console.error("❌ Error checking product availability:", error);
    return {
      productId,
      productName: `Product ID ${productId}`,
      canSell: false,
      availableQuantity: 0,
      error: error.message,
      message: error.message
    };
  }
}

// Validate multiple products for staff
async function validateProductsForStaffSale(
  items: Array<{productId: number, quantity: number}>,
  currentStaffId: number,
  weekStart: Date,
  weekEnd: Date
) {
  const availabilityChecks: AvailabilityCheckResult[] = [];
  const insufficientItems: Array<{
    productId: number;
    productName: string;
    requestedQuantity: number;
    availableQuantity: number;
    message: string;
    availableFrom?: string;
  }> = [];
  
  for (const item of items) {
    const check = await checkProductAvailabilityForStaff(
      item.productId,
      currentStaffId,
      item.quantity,
      weekStart,
      weekEnd
    );
    
    availabilityChecks.push(check);
    
    if (!check.canSell) {
      insufficientItems.push({
        productId: item.productId,
        productName: check.productName,
        requestedQuantity: item.quantity,
        availableQuantity: check.availableQuantity,
        message: check.message,
        availableFrom: check.availableFrom
      });
    }
  }
  
  return {
    availabilityChecks,
    insufficientItems,
    hasInsufficientItems: insufficientItems.length > 0,
    canProceed: insufficientItems.length === 0
  };
}

// ================== CORRECTED INVENTORY PROCESSING ==================

// Process inventory with CORRECT unassigned calculation
async function processInventoryForStaffSale(
  saleId: number, 
  staffId: number, 
  items: Array<{productId: number, quantity: number}>
) {
  try {
    console.log(`🔍 Processing inventory for sale ${saleId}, staff ${staffId}`);
    
    const { weekStart, weekEnd } = getCurrentWeekRange();
    
    const staffTrackingResults: StaffDeductionResult[] = [];
    const mainStockResults: MainStockDeductionResult[] = [];
    
    for (const item of items) {
      // Get product name
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { name: true }
      });
      
      const productName = product?.name || `Product ${item.productId}`;
      console.log(`🛍️ Processing: ${productName}, Quantity: ${item.quantity}`);
      
      // Find staff assignment
      const staffAssignment = await prisma.staffInventory.findFirst({
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
      
      // Check main stock
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
      
      let staffTrackingResult: StaffDeductionResult = {
        productId: item.productId,
        productName,
        status: 'NO_ASSIGNMENT',
        quantityDeducted: 0,
        staffInventoryId: null,
        message: ''
      };
      
      // ========== PROCESS BASED ON ASSIGNMENT ==========
      if (staffAssignment) {
        // Staff has assignment - check if they have enough remaining
        const staffAvailable = Math.max(0,
          staffAssignment.quantityGiven - 
          staffAssignment.quantitySold - 
          staffAssignment.quantityReturned
        );
        
        if (staffAvailable >= item.quantity) {
          // Update staff assignment
          await prisma.staffInventory.update({
            where: { id: staffAssignment.id },
            data: {
              quantitySold: staffAssignment.quantitySold + item.quantity,
              updatedAt: new Date()
            }
          });
          
          staffTrackingResult = {
            productId: item.productId,
            productName,
            status: 'ASSIGNED_STOCK_USED',
            quantityDeducted: item.quantity,
            staffInventoryId: staffAssignment.id,
            message: `Sold ${item.quantity} from assigned stock`
          };
        } else {
          throw new Error(
            `Cannot sell ${item.quantity} ${productName}. ` +
            `You only have ${staffAvailable} available from your assigned stock.`
          );
        }
      } else {
        // Staff has no assignment - check unassigned stock
        
        // Get all assignments to calculate unassigned stock
        const allAssignments = await prisma.staffInventory.findMany({
          where: {
            productId: item.productId,
            weekStartDate: {
              lte: weekEnd
            },
            weekEndDate: {
              gte: weekStart
            }
          }
        });
        
        // Calculate remaining assigned stock
        let totalRemainingAssigned = 0;
        for (const assignment of allAssignments) {
          const remaining = assignment.quantityGiven - 
                           assignment.quantitySold - 
                           assignment.quantityReturned;
          totalRemainingAssigned += Math.max(0, remaining);
        }
        
        // Calculate unassigned stock
        const unassignedStock = Math.max(0, mainStockItem.quantity - totalRemainingAssigned);
        
        if (unassignedStock < item.quantity) {
          throw new Error(
            `Cannot sell ${item.quantity} ${productName}. ` +
            `Only ${unassignedStock} available in unassigned stock.`
          );
        }
        
        staffTrackingResult = {
          productId: item.productId,
          productName,
          status: 'UNASSIGNED_STOCK_USED',
          quantityDeducted: 0,
          staffInventoryId: null,
          message: `Sold ${item.quantity} from unassigned stock`
        };
      }
      
      // ALWAYS deduct from main stock
      await prisma.stock.update({
        where: { id: mainStockItem.id },
        data: { 
          quantity: mainStockItem.quantity - item.quantity,
          updatedAt: new Date()
        },
      });
      
      console.log(`📉 Main stock updated: ${productName} -${item.quantity}`);
      
      staffTrackingResults.push(staffTrackingResult);
      
      mainStockResults.push({
        productId: item.productId,
        productName,
        status: 'SUCCESS',
        quantityDeducted: item.quantity,
        previousQuantity: mainStockItem.quantity,
        newQuantity: mainStockItem.quantity - item.quantity,
        message: `Deducted ${item.quantity} from main stock`
      });
      
      // Link sale item to staff inventory if assignment used
      if (staffTrackingResult.staffInventoryId) {
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
              staffInventoryId: staffTrackingResult.staffInventoryId 
            }
          });
          console.log(`🔗 Linked sale item to staff assignment ${staffTrackingResult.staffInventoryId}`);
        }
      }
    }
    
    return {
      success: true,
      staffTracking: {
        results: staffTrackingResults
      },
      mainStockDeductions: {
        results: mainStockResults
      },
      summary: {
        totalItemsRequested: items.reduce((sum, item) => sum + item.quantity, 0)
      }
    };
    
  } catch (error: any) {
    console.error("❌ Error in inventory processing:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Process sale without staff (simple deduction)
async function processSaleWithoutStaff(
  items: Array<{productId: number, quantity: number}>
) {
  try {
    console.log("📦 Processing sale without staff...");
    
    const results: MainStockDeductionResult[] = [];
    
    for (const item of items) {
      // Get product info
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { name: true }
      });
      
      const productName = product?.name || `Product ${item.productId}`;
      
      // Check main stock
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
      
      console.log(`📉 Main stock updated: ${productName} -${item.quantity}`);
      
      results.push({
        productId: item.productId,
        productName,
        status: 'MAIN_STOCK_USED',
        quantityDeducted: item.quantity,
        previousQuantity: mainStockItem.quantity,
        newQuantity: mainStockItem.quantity - item.quantity,
        message: `Deducted ${item.quantity} from main stock`
      });
    }
    
    return {
      success: true,
      results,
      summary: {
        totalItemsDeducted: items.reduce((sum, item) => sum + item.quantity, 0)
      }
    };
    
  } catch (error: any) {
    console.error("❌ Error processing sale:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Restore inventory after sale update/delete
async function restoreInventoryForSale(sale: any) {
  try {
    console.log(`🔄 Restoring inventory for sale ${sale.id}...`);
    
    const { weekStart, weekEnd } = getCurrentWeekRange();
    
    for (const item of sale.saleitem) {
      // Restore main stock
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
          }
        });
        console.log(`📈 Restored ${item.quantity} items to main stock for product ${item.productId}`);
      }
      
      // Restore staff inventory tracking if it was used
      if (item.staffInventoryId && sale.createdById) {
        const staffInventory = await prisma.staffInventory.findUnique({
          where: { id: item.staffInventoryId }
        });
        
        if (staffInventory && staffInventory.staffId === sale.createdById) {
          const newQuantitySold = Math.max(0, staffInventory.quantitySold - item.quantity);
          await prisma.staffInventory.update({
            where: { id: item.staffInventoryId },
            data: {
              quantitySold: newQuantitySold,
              updatedAt: new Date()
            }
          });
          console.log(`🔄 Restored ${item.quantity} items to staff tracking ${item.staffInventoryId}`);
        }
      }
    }
    
    console.log("✅ Inventory restoration completed");
  } catch (error: any) {
    console.error("❌ Error restoring inventory:", error);
    throw error;
  }
}

// ================== SALE PROCESSING HELPER ==================

function processSale(sale: any) {
  if (!sale) return null;
  
  const totalPaid = sale.payment
    ?.filter((p: any) => p.status === "CLEARED" || p.status === "COMPLETED")
    ?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;

  const pendingPayments = sale.payment?.filter((p: any) => 
    p.status === "PENDING" || p.status === "BOUNCED"
  ) || [];
  const remainingAmount = sale.amount - totalPaid;

  let status: "UNPAID" | "PARTIAL" | "PAID" = "UNPAID";
  if (remainingAmount <= 0 && pendingPayments.length === 0) status = "PAID";
  else if (totalPaid > 0 || pendingPayments.length > 0) status = "PARTIAL";

  return {
    ...sale,
    saleitems: sale.saleitem || [],
    payments: sale.payment || [],
    totalPaid,
    remainingAmount,
    status,
    createdBy: sale.createdBy || "SYSTEM",
    updatedBy: sale.updatedBy || "SYSTEM",
    staff: sale.staff || null
  };
}

// ================== API ROUTES ==================

// ================== GET ALL SALES ==================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get('staffId');
    const createdBy = searchParams.get('createdBy');
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    
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
    
    if (status) {
      where.status = status;
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
        paymentschedule: true,
        smsreminder: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(sales.map(processSale));
  } catch (err: any) {
    console.error("❌ Fetch sales error:", err);
    return NextResponse.json({ 
      error: "Failed to fetch sales",
      details: err.message 
    }, { status: 500 });
  }
}

// ================== CREATE SALE ==================
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    console.log("📨 Creating sale...");
    console.log("📊 Sale items:", data.saleItems);
    
    // Extract user info
    let userId = "";
    let userEmail = "";
    let userName = "";
    
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
    
    if (!userEmail) {
      userEmail = userId ? `${userId}@firebase.uid` : "unknown@example.com";
    }
    
    const normalizedUserEmail = normalizeEmail(userEmail);
    
    console.log("👤 Extracted user info:", {
      userEmail: normalizedUserEmail,
      userName: userName
    });
    
    // Find or create staff
    let staffRecord = null;
    let staffId: number | null = null;
    
    if (isValidEmail(normalizedUserEmail)) {
      staffRecord = await findOrCreateStaff(normalizedUserEmail, userName);
      if (staffRecord) {
        staffId = staffRecord.id;
        console.log(`✅ Sale linked to staff: ${staffRecord.name} (ID: ${staffRecord.id})`);
      }
    }

    // Validate required fields
    const customerId = Number(data.customerId);
    const amount = Number(data.amount);

    if (!customerId || isNaN(customerId)) {
      return NextResponse.json({ 
        error: "Invalid customer ID",
        details: "Customer ID is required"
      }, { status: 400 });
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ 
        error: "Invalid amount",
        details: "Sale amount is required"
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

    // Check availability if staff exists
    const { weekStart, weekEnd } = getCurrentWeekRange();
    
    if (staffId) {
      const availabilityValidation = await validateProductsForStaffSale(
        data.saleItems.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity
        })),
        staffId,
        weekStart,
        weekEnd
      );
      
      if (availabilityValidation.hasInsufficientItems) {
        console.error("🚫 INSUFFICIENT AVAILABILITY:", {
          staffId,
          insufficientItems: availabilityValidation.insufficientItems
        });
        
        const errorMessages = availabilityValidation.insufficientItems.map(item => 
          `• ${item.productName}: ${item.message}`
        );
        
        return NextResponse.json({ 
          error: "INSUFFICIENT AVAILABILITY",
          details: "You don't have enough availability to sell these items",
          insufficientItems: availabilityValidation.insufficientItems,
          message: `The following items have insufficient availability:\n${errorMessages.join('\n')}`
        }, { status: 400 });
      }
    }

    // Check main stock availability
    for (const item of data.saleItems) {
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

    // Create sale
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
      amount: newSale.amount
    });

    // Process inventory
    let inventoryResult = null;
    
    if (staffId) {
      inventoryResult = await processInventoryForStaffSale(
        newSale.id, 
        staffId, 
        data.saleItems.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      );
    } else {
      inventoryResult = await processSaleWithoutStaff(
        data.saleItems.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      );
    }
    
    if (!inventoryResult.success) {
      console.error("❌ Inventory processing failed:", inventoryResult.error);
      await prisma.sale.delete({ where: { id: newSale.id } });
      return NextResponse.json({ 
        error: "FAILED TO PROCESS INVENTORY",
        details: inventoryResult.error,
        message: "Sale created but inventory processing failed. Sale has been rolled back."
      }, { status: 500 });
    }

    // Fetch complete sale
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
      inventoryProcessing: {
        result: inventoryResult,
        staffId,
        staffName: staffRecord?.name
      }
    }, { status: 201 });
    
  } catch (err: any) {
    console.error("❌ Sale creation error:", err);
    
    let errorMessage = "Failed to create sale";
    let statusCode = 500;
    
    if (err.code === 'P2002') {
      errorMessage = "Database constraint violation";
      statusCode = 400;
    } else if (err.code === 'P2003') {
      errorMessage = "Foreign key constraint failed";
      statusCode = 400;
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

// ================== UPDATE SALE ==================
export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    const id = Number(data.id);
    
    if (!id) {
      return NextResponse.json({ error: "Sale ID is required" }, { status: 400 });
    }

    // Get user info
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
    
    // Get existing sale
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

    // Link to staff if not already linked
    let staffId = existingSale.createdById;
    let staffRecord = existingSale.staff;
    
    if (!staffId && isValidEmail(normalizedUserEmail)) {
      staffRecord = await findOrCreateStaff(normalizedUserEmail, userName);
      if (staffRecord) {
        staffId = staffRecord.id;
        console.log(`✅ Linking existing sale ${id} to staff: ${staffRecord.name} (ID: ${staffRecord.id})`);
      }
    }

    // Restore inventory from old sale items first
    console.log(`🔄 Restoring inventory for sale update ${id}...`);
    await restoreInventoryForSale(existingSale);

    const newItems = data.saleItems || existingSale.saleitem;
    const recalculatedAmount = newItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

    // Check availability for updates
    const { weekStart, weekEnd } = getCurrentWeekRange();
    const validationErrors: string[] = [];
    
    if (data.saleItems && staffId) {
      for (const item of data.saleItems) {
        const availabilityCheck = await checkProductAvailabilityForStaff(
          item.productId,
          staffId,
          item.quantity,
          weekStart,
          weekEnd
        );
        
        if (!availabilityCheck.canSell) {
          validationErrors.push(
            `Product ID ${item.productId} (${availabilityCheck.productName}): ${availabilityCheck.message}`
          );
        }
      }
      
      if (validationErrors.length > 0) {
        // Re-apply the old inventory deductions
        console.log("❌ Update failed, reapplying old inventory deductions...");
        await restoreInventoryForSale({
          ...existingSale,
          saleitem: existingSale.saleitem.map(item => ({
            ...item,
            quantity: -item.quantity // Negative to deduct again
          }))
        });
        
        return NextResponse.json({ 
          error: "Insufficient availability for update",
          details: validationErrors,
          staffAttemptingUpdate: {
            id: staffId,
            name: staffRecord?.name,
            email: normalizedUserEmail
          }
        }, { status: 400 });
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

    // Also update createdBy if it's not normalized
    if (existingSale.createdBy && existingSale.createdBy !== normalizedUserEmail) {
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
      if (staffId) {
        await processInventoryForStaffSale(
          id, 
          staffId, 
          data.saleItems.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity
          }))
        );
      } else {
        await processSaleWithoutStaff(
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

    // Restore inventory
    await restoreInventoryForSale(sale);

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
    if (data.checkDepositDate !== undefined) updateData.checkDepositDate = new Date(data.checkDepositDate);
    if (data.isCheckDeposited !== undefined) updateData.isCheckDeposited = data.isCheckDeposited;

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