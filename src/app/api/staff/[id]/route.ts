import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{
    id: string;
  }>;
}

// Define the Sale type structure
interface Sale {
  id: number;
  amount: number;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
  status: string;
  paymentMethod: string;
  createdBy?: string | null;
  createdById?: number | null;
  customerId: number;
  customer?: any;
  saleitem?: any[];
  payment?: any[];
  createdByStaff?: any;  // Changed from staff to createdByStaff
  assignedStaff?: any;   // Added this relation
}

// Define the return type for inventory operations
interface InventoryOperationResult {
  success: boolean;
  saleId?: number;
  staffId?: number;
  inventoryUpdates?: Array<{
    productId: number;
    productName?: string;
    quantitySold: number;
    previousSold: number;
    newSold: number;
    inventoryId: number;
  }>;
  inventoryRestorations?: Array<{
    productId: number;
    quantityRestored: number;
    previousSold: number;
    newSold: number;
    inventoryId: number;
  }>;
  errors?: string[];
  error?: string;
}

// Helper to normalize email
function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

// Helper for case-insensitive email search
async function findStaffByEmailCaseInsensitive(email: string) {
  if (!email) return null;
  
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

// Enhanced email matching with multiple strategies
function emailsMatch(email1: string, email2: string): boolean {
  if (!email1 || !email2) return false;
  
  const norm1 = normalizeEmail(email1);
  const norm2 = normalizeEmail(email2);
  
  if (norm1 === norm2) return true;
  
  const norm1NoDots = norm1.replace(/\./g, '');
  const norm2NoDots = norm2.replace(/\./g, '');
  if (norm1NoDots === norm2NoDots) return true;
  
  const [user1, domain1] = norm1.split('@');
  const [user2, domain2] = norm2.split('@');
  
  if (!user1 || !user2 || !domain1 || !domain2) return false;
  
  if (domain1 === domain2) {
    return user1.replace(/\./g, '') === user2.replace(/\./g, '');
  }
  
  return false;
}

// Find sales by flexible email matching - FIXED VERSION
async function findSalesByFlexibleEmail(staffEmail: string, excludeStaffId?: number) {
  if (!staffEmail) return [];
  
  const normalizedStaffEmail = normalizeEmail(staffEmail);
  
  console.log(`🔍 Looking for sales with email: ${normalizedStaffEmail}`);
  
  const sales = await prisma.sale.findMany({
    where: {
      createdBy: normalizedStaffEmail,
      OR: [
        { createdById: null },
        ...(excludeStaffId ? [{ createdById: { not: excludeStaffId } }] : [])
      ]
    },
    select: { id: true }
  });
  
  console.log(`✅ Found ${sales.length} sales for ${normalizedStaffEmail}`);
  
  return sales.map(s => s.id);
}

// Debug function with proper typing
async function debugEmailMatching(staffEmail: string) {
  const normalizedStaffEmail = normalizeEmail(staffEmail);
  console.log('🔍 Debug email matching for:', staffEmail);
  console.log('Normalized staff email:', normalizedStaffEmail);
  
  const uniqueCreatedBys = await prisma.$queryRaw<{createdBy: string}[]>`
    SELECT DISTINCT createdBy 
    FROM sale 
    WHERE createdBy IS NOT NULL 
    ORDER BY createdBy
  `;
  
  console.log('📋 All createdBy values in database:');
  const matches: string[] = [];
  
  uniqueCreatedBys.forEach((row, i) => {
    if (row.createdBy) {
      const normalizedRow = normalizeEmail(row.createdBy);
      const isMatch = emailsMatch(row.createdBy, staffEmail);
      console.log(`${i+1}. "${row.createdBy}" -> "${normalizedRow}" ${isMatch ? '✅ MATCHES' : '❌ no match'}`);
      
      if (isMatch) {
        matches.push(row.createdBy);
      }
    }
  });
  
  console.log('🎯 Found matches:', matches);
  return matches;
}

// Helper function to link inventory sales
async function findInventoryLinkedSales(staffId: number) {
  try {
    const inventorySales = await prisma.staffInventory.findMany({
      where: { staffId },
      select: {
        saleItems: {
          select: {
            saleId: true
          }
        }
      }
    });
    
    const saleIds = inventorySales.flatMap(inv => 
      inv.saleItems.map(si => si.saleId)
    );
    
    return [...new Set(saleIds)];
  } catch (error) {
    console.error('Error finding inventory linked sales:', error);
    return [];
  }
}

// NEW FUNCTION: Reduce staff inventory when a sale is linked
async function reduceStaffInventoryFromSale(staffId: number, saleId: number): Promise<InventoryOperationResult> {
  try {
    console.log(`🔄 Starting inventory reduction for staff ${staffId} from sale ${saleId}`);
    
    // Get the sale with its items
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        saleitem: {
          include: {
            product: true,
            staffInventory: true
          }
        }
      }
    });
    
    if (!sale) {
      console.error(`❌ Sale ${saleId} not found`);
      return { 
        success: false, 
        error: 'Sale not found' 
      };
    }
    
    const inventoryUpdates = [];
    const errors = [];
    
    // Process each item in the sale
    for (const item of sale.saleitem) {
      const productId = item.productId;
      const quantitySold = item.quantity;
      
      console.log(`📦 Processing sale item: ${quantitySold}x ${item.product?.name} (ID: ${productId})`);
      
      // Find the staff's inventory for this product
      const staffInventory = await prisma.staffInventory.findFirst({
        where: {
          staffId: staffId,
          productId: productId,
          quantityGiven: {
            gt: 0 // Only consider inventory that was actually given
          }
        },
        orderBy: {
          createdAt: 'asc' // Process oldest inventory first (FIFO)
        }
      });
      
      if (!staffInventory) {
        const error = `❌ No inventory found for product ${productId} assigned to staff ${staffId}`;
        console.error(error);
        errors.push(error);
        continue;
      }
      
      // Calculate remaining quantity before this sale
      const currentSold = staffInventory.quantitySold;
      const currentReturned = staffInventory.quantityReturned;
      const currentRemaining = staffInventory.quantityGiven - currentSold - currentReturned;
      
      if (currentRemaining < quantitySold) {
        const error = `❌ Insufficient inventory for product ${productId}. Available: ${currentRemaining}, Required: ${quantitySold}`;
        console.error(error);
        errors.push(error);
        continue;
      }
      
      // Calculate new sold quantity
      const newSoldQuantity = currentSold + quantitySold;
      
      // Update the staff inventory
      await prisma.staffInventory.update({
        where: { id: staffInventory.id },
        data: {
          quantitySold: newSoldQuantity,
          updatedAt: new Date()
        }
      });
      
      // Link this sale item to the staff inventory
      await prisma.saleitem.update({
        where: { id: item.id },
        data: {
          staffInventoryId: staffInventory.id
        }
      });
      
      inventoryUpdates.push({
        productId,
        productName: item.product?.name,
        quantitySold,
        previousSold: currentSold,
        newSold: newSoldQuantity,
        inventoryId: staffInventory.id
      });
      
      console.log(`✅ Updated inventory ${staffInventory.id}: ${currentSold} → ${newSoldQuantity} sold`);
    }
    
    return {
      success: errors.length === 0,
      saleId,
      staffId,
      inventoryUpdates,
      ...(errors.length > 0 && { errors })
    };
    
  } catch (error: any) {
    console.error(`❌ Error reducing inventory for sale ${saleId}:`, error);
    return {
      success: false,
      error: error.message,
      saleId,
      staffId
    };
  }
}

// NEW FUNCTION: Reduce inventory when a sale is created/updated
async function reduceInventoryForNewSale(saleId: number, staffId?: number, staffEmail?: string): Promise<InventoryOperationResult> {
  try {
    console.log(`🔄 Processing inventory reduction for sale ${saleId}`);
    
    // Determine staff ID from parameters or find by email
    let targetStaffId = staffId;
    
    if (!targetStaffId && staffEmail) {
      const staff = await findStaffByEmailCaseInsensitive(staffEmail);
      targetStaffId = staff?.id;
    }
    
    if (!targetStaffId) {
      console.log(`⚠️ No staff ID provided for sale ${saleId}, skipping inventory reduction`);
      return { 
        success: false, 
        error: 'No staff identified for inventory reduction' 
      };
    }
    
    // Call the reduction function
    return await reduceStaffInventoryFromSale(targetStaffId, saleId);
    
  } catch (error: any) {
    console.error(`❌ Error in inventory reduction for sale ${saleId}:`, error);
    return {
      success: false,
      error: error.message,
      saleId
    };
  }
}

// NEW FUNCTION: Restore inventory when a sale is deleted/cancelled
async function restoreStaffInventoryFromSale(staffId: number, saleId: number): Promise<InventoryOperationResult> {
  try {
    console.log(`🔄 Restoring inventory for staff ${staffId} from cancelled sale ${saleId}`);
    
    // Get the sale with its items
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        saleitem: {
          include: {
            staffInventory: true
          }
        }
      }
    });
    
    if (!sale) {
      console.error(`❌ Sale ${saleId} not found for restoration`);
      return { 
        success: false, 
        error: 'Sale not found' 
      };
    }
    
    const inventoryRestorations = [];
    
    // Process each item in the sale
    for (const item of sale.saleitem) {
      if (!item.staffInventoryId) {
        continue; // Skip items not linked to inventory
      }
      
      const quantitySold = item.quantity;
      const staffInventoryId = item.staffInventoryId;
      
      // Get current inventory
      const staffInventory = await prisma.staffInventory.findUnique({
        where: { id: staffInventoryId }
      });
      
      if (!staffInventory) {
        console.warn(`⚠️ Inventory ${staffInventoryId} not found for restoration`);
        continue;
      }
      
      if (staffInventory.staffId !== staffId) {
        console.warn(`⚠️ Inventory ${staffInventoryId} does not belong to staff ${staffId}`);
        continue;
      }
      
      // Calculate new sold quantity (subtract what was sold)
      const currentSold = staffInventory.quantitySold;
      const newSoldQuantity = Math.max(0, currentSold - quantitySold);
      
      // Update the staff inventory
      await prisma.staffInventory.update({
        where: { id: staffInventoryId },
        data: {
          quantitySold: newSoldQuantity,
          updatedAt: new Date()
        }
      });
      
      // Remove the link from sale item
      await prisma.saleitem.update({
        where: { id: item.id },
        data: {
          staffInventoryId: null
        }
      });
      
      inventoryRestorations.push({
        productId: staffInventory.productId,
        quantityRestored: quantitySold,
        previousSold: currentSold,
        newSold: newSoldQuantity,
        inventoryId: staffInventoryId
      });
      
      console.log(`✅ Restored inventory ${staffInventoryId}: ${currentSold} → ${newSoldQuantity} sold`);
    }
    
    return {
      success: true,
      saleId,
      staffId,
      inventoryRestorations
    };
    
  } catch (error: any) {
    console.error(`❌ Error restoring inventory from sale ${saleId}:`, error);
    return {
      success: false,
      error: error.message,
      saleId,
      staffId
    };
  }
}

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

    // Get staff basic info
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      );
    }

    // DEBUG: Run email matching analysis
    if (staff.email) {
      const debugMatches = await debugEmailMatching(staff.email);
      console.log('🎯 Final matches found:', debugMatches.length);
    }

    // 1. Sales where createdById = staff.id (direct relation)
    // FIXED: Changed 'staff' to 'createdByStaff' and added 'assignedStaff'
    const directSales = await prisma.sale.findMany({
      where: { createdById: staffId },
      include: {
        saleitem: { 
          include: { 
            product: true,
            staffInventory: {
              include: {
                product: true,
                staff: true
              }
            }
          } 
        },
        customer: true,
        payment: true,
        createdByStaff: true,      // FIXED: Changed from 'staff' to 'createdByStaff'
        assignedStaff: true,        // Added assignedStaff relation
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Sales where createdBy email matches staff.email (FIXED matching)
    let emailMatchedSales: Sale[] = [];
    if (staff.email) {
      const matchedSaleIds = await findSalesByFlexibleEmail(staff.email, staffId);
      
      if (matchedSaleIds.length > 0) {
        emailMatchedSales = await prisma.sale.findMany({
          where: {
            id: { in: matchedSaleIds }
          },
          include: {
            saleitem: { 
              include: { 
                product: true,
                staffInventory: {
                  include: {
                    product: true,
                    staff: true
                  }
                }
              } 
            },
            customer: true,
            payment: true,
            createdByStaff: true,      // FIXED: Changed from 'staff' to 'createdByStaff'
            assignedStaff: true,        // Added assignedStaff relation
          },
          orderBy: { createdAt: 'desc' }
        });
      }
      
      console.log(`📊 Email matching results for ${staff.email}:`, {
        directSales: directSales.length,
        emailMatchedIds: matchedSaleIds.length,
        emailMatchedSales: emailMatchedSales.length
      });
    }

    // 3. Get inventory linked sales
    const inventoryLinkedSaleIds = await findInventoryLinkedSales(staffId);
    let inventoryLinkedSales: Sale[] = [];
    
    if (inventoryLinkedSaleIds.length > 0) {
      const existingSaleIds = new Set([
        ...directSales.map(s => s.id),
        ...emailMatchedSales.map(s => s.id)
      ]);
      
      const uniqueInventorySaleIds = inventoryLinkedSaleIds.filter(id => !existingSaleIds.has(id));
      
      if (uniqueInventorySaleIds.length > 0) {
        inventoryLinkedSales = await prisma.sale.findMany({
          where: {
            id: { in: uniqueInventorySaleIds }
          },
          include: {
            saleitem: { 
              include: { 
                product: true,
                staffInventory: {
                  include: {
                    product: true,
                    staff: true
                  }
                }
              } 
            },
            customer: true,
            payment: true,
            createdByStaff: true,      // FIXED: Changed from 'staff' to 'createdByStaff'
            assignedStaff: true,        // Added assignedStaff relation
          },
          orderBy: { createdAt: 'desc' }
        });
      }
    }

    // Get staff inventories with their sales
    const staffInventories = await prisma.staffInventory.findMany({
      where: { staffId },
      include: { 
        product: true,
        saleItems: {
          include: {
            sale: {
              include: {
                customer: true,
                payment: true
              }
            },
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Combine and deduplicate ALL sales
    const allSalesMap = new Map<number, Sale>();
    
    [...directSales, ...emailMatchedSales, ...inventoryLinkedSales].forEach(sale => {
      allSalesMap.set(sale.id, sale);
    });

    const allSales = Array.from(allSalesMap.values())
      .sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    // Calculate stats
    const totalSales = allSales.length;
    const totalSalesAmount = allSales.reduce((sum, sale) => sum + sale.amount, 0);
    const totalPaid = allSales.reduce((sum, sale) => {
      const paid = sale.payment
        ?.filter((p: any) => p.status === "CLEARED" || p.status === "COMPLETED")
        ?.reduce((pSum: number, p: any) => pSum + p.amount, 0) || 0;
      return sum + paid;
    }, 0);

    // Inventory calculations
    const totalInventoryGiven = staffInventories.reduce((sum, inv) => sum + inv.quantityGiven, 0);
    const totalInventorySold = staffInventories.reduce((sum, inv) => sum + inv.quantitySold, 0);
    const totalInventoryReturned = staffInventories.reduce((sum, inv) => sum + inv.quantityReturned, 0);
    const totalInventoryRemaining = totalInventoryGiven - totalInventorySold - totalInventoryReturned;
    
    // Calculate inventory value (using product cost)
    const totalInventoryValue = staffInventories.reduce((sum, inv) => {
      const productCost = inv.product?.productionCost || inv.product?.price * 0.7 || 0;
      return sum + (productCost * inv.quantityGiven);
    }, 0);

    // Calculate inventory sales value
    const inventorySalesValue = staffInventories.reduce((sum, inv) => {
      return sum + inv.saleItems.reduce((itemSum, saleItem) => {
        return itemSum + saleItem.total;
      }, 0);
    }, 0);

    // Helper functions with proper typing
    const getSalesByMethod = (sales: Sale[]) => {
      interface MethodData {
        count: number;
        amount: number;
      }
      
      const methods: { [key: string]: MethodData } = {};
      
      sales.forEach(sale => {
        const method = sale.paymentMethod || 'UNKNOWN';
        if (!methods[method]) {
          methods[method] = { count: 0, amount: 0 };
        }
        methods[method].count++;
        methods[method].amount += sale.amount;
      });
      
      return Object.entries(methods)
        .map(([method, data]) => ({ method, ...data }))
        .sort((a, b) => b.amount - a.amount);
    };

    const getSalesByMonth = (sales: Sale[]) => {
      interface MonthData {
        count: number;
        amount: number;
      }
      
      const months: { [key: string]: MonthData } = {};
      
      sales.forEach(sale => {
        const date = new Date(sale.createdAt);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!months[monthYear]) {
          months[monthYear] = { count: 0, amount: 0 };
        }
        
        months[monthYear].count++;
        months[monthYear].amount += sale.amount;
      });
      
      return Object.entries(months)
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, 6);
    };

    // Get sales linked to inventory (from staffInventory)
    const inventoryLinkedSaleIdsAll = staffInventories.flatMap(inv => 
      inv.saleItems.map(si => si.sale.id)
    );
    const uniqueInventoryLinkedSales = [...new Set(inventoryLinkedSaleIdsAll)];
    
    // Get products sold by this staff
    interface ProductStats {
      product: any;
      totalQuantity: number;
      totalAmount: number;
    }
    
    const staffProducts = new Map<number, ProductStats>();
    allSales.forEach(sale => {
      sale.saleitem?.forEach((item: any) => {
        if (item.product) {
          const productId = item.product.id;
          if (!staffProducts.has(productId)) {
            staffProducts.set(productId, {
              product: item.product,
              totalQuantity: 0,
              totalAmount: 0
            });
          }
          const productData = staffProducts.get(productId)!;
          productData.totalQuantity += item.quantity;
          productData.totalAmount += item.total;
        }
      });
    });

    // Add comprehensive debug log
    console.log("🔄 Staff ID API Complete Response:", {
      staffId,
      staffEmail: staff.email,
      normalizedStaffEmail: staff.email ? normalizeEmail(staff.email) : 'No email',
      directSalesCount: directSales.length,
      emailMatchedSalesCount: emailMatchedSales.length,
      inventoryLinkedSalesCount: inventoryLinkedSales.length,
      totalSales: allSales.length,
      staffInventoriesCount: staffInventories.length,
      inventorySummary: {
        given: totalInventoryGiven,
        sold: totalInventorySold,
        returned: totalInventoryReturned,
        remaining: totalInventoryRemaining,
        salesValue: inventorySalesValue
      },
      sampleSales: allSales.slice(0, 3).map(s => ({
        id: s.id,
        createdBy: s.createdBy,
        createdById: s.createdById,
        amount: s.amount,
        date: s.date,
        hasCreatedByStaff: !!s.createdByStaff,
        hasAssignedStaff: !!s.assignedStaff,
        itemCount: s.saleitem?.length || 0
      }))
    });

    return NextResponse.json({
      // Staff info
      ...staff,
      
      // Data
      staffInventories,
      sales: allSales,
      
      // Sales breakdown
      salesBreakdown: {
        directSales: directSales.length,
        emailMatchedSales: emailMatchedSales.length,
        inventoryLinkedSales: inventoryLinkedSales.length,
        totalSales: allSales.length
      },
      
      // Inventory linked sales (from staffInventory -> saleItems)
      inventoryLinkedSales: uniqueInventoryLinkedSales,
      
      // Products sold by this staff
      productsSold: Array.from(staffProducts.values()).sort((a, b) => b.totalAmount - a.totalAmount),
      
      // Stats
      stats: {
        sales: {
          total: totalSales,
          totalAmount: totalSalesAmount,
          totalPaid,
          outstanding: totalSalesAmount - totalPaid,
          averageSale: totalSales > 0 ? totalSalesAmount / totalSales : 0
        },
        inventory: {
          given: totalInventoryGiven,
          sold: totalInventorySold,
          returned: totalInventoryReturned,
          remaining: totalInventoryRemaining,
          value: totalInventoryValue,
          salesValue: inventorySalesValue,
          efficiency: totalInventoryGiven > 0 ? (totalInventorySold / totalInventoryGiven) * 100 : 0
        },
        performance: {
          salesByMethod: getSalesByMethod(allSales),
          salesByMonth: getSalesByMonth(allSales),
          salesSources: {
            directRelation: directSales.length,
            emailMatched: emailMatchedSales.length,
            inventoryLinked: inventoryLinkedSales.length,
            totalUnique: allSales.length
          }
        }
      },
      
      // Metadata
      _metadata: {
        queryTime: new Date().toISOString(),
        staffId,
        totalRecords: {
          sales: allSales.length,
          inventory: staffInventories.length,
          products: staffProducts.size
        }
      }
    });
  } catch (error: any) {
    console.error("Error fetching staff:", error);
    return NextResponse.json(
      { error: "Failed to fetch staff data", details: error.message },
      { status: 500 }
    );
  }
}

// NEW ENDPOINT: Process inventory reduction for a specific sale
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
    const body = await req.json();
    const { saleId, action = 'reduce' } = body;
    
    if (!saleId) {
      return NextResponse.json(
        { error: "Sale ID is required" },
        { status: 400 }
      );
    }
    
    // Verify staff exists
    const staff = await prisma.staff.findUnique({
      where: { id: staffId }
    });
    
    if (!staff) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      );
    }
    
    let result: InventoryOperationResult;
    
    if (action === 'reduce') {
      // Reduce inventory for this sale
      result = await reduceStaffInventoryFromSale(staffId, saleId);
    } else if (action === 'restore') {
      // Restore inventory from this sale (for cancelled/returned sales)
      result = await restoreStaffInventoryFromSale(staffId, saleId);
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'reduce' or 'restore'" },
        { status: 400 }
      );
    }
    
    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error || "Failed to process inventory",
          details: result.errors
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `Inventory ${action === 'reduce' ? 'reduced' : 'restored'} successfully`,
      staffId,
      saleId,
      result
    });
    
  } catch (error: any) {
    console.error("Error processing inventory:", error);
    return NextResponse.json(
      { error: "Failed to process inventory", details: error.message },
      { status: 500 }
    );
  }
}

// NEW ENDPOINT: Bulk inventory reduction for all linked sales
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: "Valid staff ID is required" },
        { status: 400 }
      );
    }

    const staffId = parseInt(id);
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

    console.log(`🔄 Starting bulk inventory reduction for staff: ${staff.name}`);
    
    // Get all sales linked to this staff (direct and email)
    const directSaleIds = await prisma.sale.findMany({
      where: { createdById: staffId },
      select: { id: true }
    }).then(sales => sales.map(s => s.id));
    
    let emailMatchedSaleIds: number[] = [];
    if (staff.email) {
      emailMatchedSaleIds = await findSalesByFlexibleEmail(staff.email, staffId);
    }
    
    const allSaleIds = [...new Set([...directSaleIds, ...emailMatchedSaleIds])];
    
    console.log(`📊 Found ${allSaleIds.length} sales to process`);
    
    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      details: [] as any[]
    };
    
    // Process each sale
    for (const saleId of allSaleIds) {
      try {
        const result = await reduceStaffInventoryFromSale(staffId, saleId);
        results.processed++;
        
        if (result.success) {
          results.successful++;
          console.log(`✅ Processed sale ${saleId}: SUCCESS`);
        } else {
          results.failed++;
          console.log(`❌ Processed sale ${saleId}: FAILED - ${result.error}`);
        }
        
        results.details.push({
          saleId,
          success: result.success,
          inventoryUpdates: result.inventoryUpdates,
          error: result.error
        });
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        results.failed++;
        results.details.push({
          saleId,
          success: false,
          error: error.message
        });
        console.error(`❌ Error processing sale ${saleId}:`, error);
      }
    }
    
    // Get updated inventory summary
    const staffInventories = await prisma.staffInventory.findMany({
      where: { staffId },
      select: {
        productId: true,
        product: { select: { name: true } },
        quantityGiven: true,
        quantitySold: true,
        quantityReturned: true
      }
    });
    
    const inventorySummary = staffInventories.map(inv => ({
      productId: inv.productId,
      productName: inv.product?.name,
      given: inv.quantityGiven,
      sold: inv.quantitySold,
      returned: inv.quantityReturned,
      remaining: inv.quantityGiven - inv.quantitySold - inv.quantityReturned
    }));
    
    return NextResponse.json({
      success: true,
      message: `Bulk inventory processing completed for ${staff.name}`,
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email
      },
      summary: {
        totalSales: allSaleIds.length,
        ...results
      },
      inventorySummary,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error("Error in bulk inventory processing:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process bulk inventory reduction",
        details: error.message
      },
      { status: 500 }
    );
  }
}

// Helper endpoint to check inventory status before sale
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: "Valid staff ID is required" },
        { status: 400 }
      );
    }

    const staffId = parseInt(id);
    const body = await req.json();
    const { items } = body; // Array of { productId: number, quantity: number }
    
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Items array is required" },
        { status: 400 }
      );
    }
    
    // Verify staff exists
    const staff = await prisma.staff.findUnique({
      where: { id: staffId }
    });
    
    if (!staff) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      );
    }
    
    const inventoryCheckResults = [];
    let allItemsAvailable = true;
    
    // Check each item's availability
    for (const item of items) {
      const { productId, quantity } = item;
      
      if (!productId || !quantity || quantity <= 0) {
        inventoryCheckResults.push({
          productId,
          quantity,
          available: false,
          error: "Invalid product ID or quantity"
        });
        allItemsAvailable = false;
        continue;
      }
      
      // Get staff's inventory for this product
      const staffInventory = await prisma.staffInventory.findFirst({
        where: {
          staffId,
          productId
        }
      });
      
      if (!staffInventory) {
        inventoryCheckResults.push({
          productId,
          quantity,
          available: false,
          error: "No inventory assigned for this product"
        });
        allItemsAvailable = false;
        continue;
      }
      
      // Calculate available quantity
      const availableQuantity = staffInventory.quantityGiven - 
                               staffInventory.quantitySold - 
                               staffInventory.quantityReturned;
      
      const isAvailable = availableQuantity >= quantity;
      
      inventoryCheckResults.push({
        productId,
        quantity,
        available: isAvailable,
        availableQuantity,
        inventoryId: staffInventory.id,
        productName: (await prisma.product.findUnique({
          where: { id: productId },
          select: { name: true }
        }))?.name
      });
      
      if (!isAvailable) {
        allItemsAvailable = false;
      }
    }
    
    return NextResponse.json({
      success: true,
      staffId,
      allItemsAvailable,
      items: inventoryCheckResults,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error("Error checking inventory:", error);
    return NextResponse.json(
      { error: "Failed to check inventory", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: "Valid staff ID is required" },
        { status: 400 }
      );
    }

    const staffId = parseInt(id);

    const staff = await prisma.staff.findUnique({
      where: { id: staffId }
    });

    if (!staff) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      );
    }

    const hasInventory = await prisma.staffInventory.findFirst({
      where: { staffId }
    });

    if (hasInventory) {
      return NextResponse.json(
        { error: "Cannot delete staff with assigned inventory. Remove inventory first." },
        { status: 400 }
      );
    }

    const directSales = await prisma.sale.findFirst({
      where: { createdById: staffId }
    });

    // Check sales by email (using flexible matching)
    let emailMatchedSales = null;
    if (staff.email) {
      const matchedIds = await findSalesByFlexibleEmail(staff.email);
      if (matchedIds.length > 0) {
        emailMatchedSales = await prisma.sale.findFirst({
          where: { id: matchedIds[0] }
        });
      }
    }

    if (directSales || emailMatchedSales) {
      return NextResponse.json(
        { 
          error: "Cannot delete staff with sales records.",
          details: {
            directSales: !!directSales,
            emailMatchedSales: !!emailMatchedSales,
            totalSales: (directSales ? 1 : 0) + (emailMatchedSales ? 1 : 0)
          }
        },
        { status: 400 }
      );
    }

    await prisma.staff.delete({
      where: { id: staffId }
    });

    console.log(`🗑️ Deleted staff: ${staff.name} (${staff.email}) ID: ${staff.id}`);

    return NextResponse.json({ 
      success: true,
      message: "Staff member deleted successfully" 
    });
  } catch (error: any) {
    console.error("Error deleting staff:", error);
    
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete staff member", details: error.message },
      { status: 500 }
    );
  }
}