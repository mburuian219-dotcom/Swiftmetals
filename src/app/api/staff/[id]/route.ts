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
  staff?: any;
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

// Enhanced email matching with multiple strategies
function emailsMatch(email1: string, email2: string): boolean {
  if (!email1 || !email2) return false;
  
  const norm1 = normalizeEmail(email1);
  const norm2 = normalizeEmail(email2);
  
  // Exact match
  if (norm1 === norm2) return true;
  
  // Match without dots (gmail style)
  const norm1NoDots = norm1.replace(/\./g, '');
  const norm2NoDots = norm2.replace(/\./g, '');
  if (norm1NoDots === norm2NoDots) return true;
  
  // Match username part (before @)
  const [user1, domain1] = norm1.split('@');
  const [user2, domain2] = norm2.split('@');
  
  if (!user1 || !user2 || !domain1 || !domain2) return false;
  
  // Same domain, compare usernames without dots
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
  
  // Get all unique createdBy values
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
    // Get sales through staff inventory -> saleItems
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
    
    return [...new Set(saleIds)]; // Remove duplicates
  } catch (error) {
    console.error('Error finding inventory linked sales:', error);
    return [];
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
        staff: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Sales where createdBy email matches staff.email (FIXED matching)
    let emailMatchedSales: Sale[] = [];
    if (staff.email) {
      const matchedSaleIds = await findSalesByFlexibleEmail(staff.email, staffId);
      
      if (matchedSaleIds.length > 0) {
        // Fetch full sale details
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
            staff: true
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
      // Remove duplicates that are already in directSales or emailMatchedSales
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
            staff: true
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
        hasStaffObject: !!s.staff,
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
    const data = await req.json();
    
    if (!data.name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    let normalizedEmail: string | null = null;
    if (data.email) {
      normalizedEmail = normalizeEmail(data.email);
      
      // Check if another staff has this email (case-insensitive)
      const existingStaff = await findStaffByEmailCaseInsensitive(normalizedEmail);

      if (existingStaff && existingStaff.id !== staffId) {
        return NextResponse.json(
          { 
            error: "Another staff member already has this email",
            existingStaff: {
              id: existingStaff.id,
              name: existingStaff.name,
              email: existingStaff.email
            }
          },
          { status: 409 }
        );
      }
    }

    const updatedStaff = await prisma.staff.update({
      where: { id: staffId },
      data: {
        name: data.name,
        email: normalizedEmail, // Store normalized email
        phone: data.phone ? data.phone.trim() : null
      }
    });

    console.log(`✏️ Updated staff: ${updatedStaff.name} (${updatedStaff.email}) ID: ${updatedStaff.id}`);

    return NextResponse.json(updatedStaff);
  } catch (error: any) {
    console.error("Error updating staff:", error);
    
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update staff member", details: error.message },
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

// Special endpoint to link staff's existing sales
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

    if (!staff.email) {
      return NextResponse.json(
        { error: "Staff has no email to match against" },
        { status: 400 }
      );
    }

    console.log(`🔗 Linking sales for staff: ${staff.name} (${staff.email})`);
    
    // Find sales using flexible matching
    const matchedSaleIds = await findSalesByFlexibleEmail(staff.email, staffId);
    
    console.log(`📊 Found ${matchedSaleIds.length} matching unlinked sales`);

    if (matchedSaleIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No matching unlinked sales found",
        staffId: staff.id,
        staffName: staff.name,
        staffEmail: staff.email,
        linkedCount: 0
      });
    }

    // Link the sales
    const updateResult = await prisma.sale.updateMany({
      where: {
        id: { in: matchedSaleIds }
      },
      data: {
        createdById: staff.id
      }
    });

    console.log(`✅ Linked ${updateResult.count} sales to staff ${staff.name}`);

    // Get sample of linked sales
    const sampleSales = await prisma.sale.findMany({
      where: {
        id: { in: matchedSaleIds.slice(0, 5) }
      },
      include: {
        customer: {
          select: { name: true }
        },
        saleitem: {
          include: {
            product: {
              select: { name: true }
            }
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Linked ${updateResult.count} sales to ${staff.name}`,
      staffId: staff.id,
      staffName: staff.name,
      staffEmail: staff.email,
      linkedCount: updateResult.count,
      matchedCount: matchedSaleIds.length,
      sampleSales: sampleSales.map(s => ({
        id: s.id,
        createdBy: s.createdBy,
        createdById: s.createdById,
        amount: s.amount,
        date: s.date,
        customer: s.customer?.name,
        items: s.saleitem?.map((si: any) => ({
          product: si.product?.name,
          quantity: si.quantity,
          total: si.total
        }))
      }))
    });
    
  } catch (error: any) {
    console.error("Error linking staff sales:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to link staff sales",
        details: error.message
      },
      { status: 500 }
    );
  }
}

// Additional helper endpoint to fix ALL staff links
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

    // Also fix inventory links
    console.log(`🛠️ Running comprehensive fix for staff: ${staff.name}`);
    
    interface FixResults {
      salesLinked: number;
      inventoryChecked: number;
      inventoryLinked: number;
      errors: string[];
    }
    
    const results: FixResults = {
      salesLinked: 0,
      inventoryChecked: 0,
      inventoryLinked: 0,
      errors: []
    };

    // 1. Link sales by email
    if (staff.email) {
      try {
        const matchedSaleIds = await findSalesByFlexibleEmail(staff.email, staffId);
        
        if (matchedSaleIds.length > 0) {
          await prisma.sale.updateMany({
            where: { id: { in: matchedSaleIds } },
            data: { createdById: staff.id }
          });
          results.salesLinked = matchedSaleIds.length;
          console.log(`✅ Linked ${matchedSaleIds.length} sales`);
        }
      } catch (error: any) {
        results.errors.push(`Sales linking failed: ${error.message}`);
      }
    }

    // 2. Link inventory sales (update saleitems with staffInventoryId)
    try {
      // Get staff inventory items
      const staffInventoryItems = await prisma.staffInventory.findMany({
        where: { staffId },
        select: { id: true, productId: true }
      });
      
      results.inventoryChecked = staffInventoryItems.length;
      
      // For each inventory item, find sales of that product and link them
      for (const inventory of staffInventoryItems) {
        // Find sales of this product by this staff
        const salesToLink = await prisma.sale.findMany({
          where: {
            createdById: staffId,
            saleitem: {
              some: {
                productId: inventory.productId,
                staffInventoryId: null
              }
            }
          },
          select: { id: true }
        });
        
        if (salesToLink.length > 0) {
          // Update the saleitems
          await prisma.saleitem.updateMany({
            where: {
              saleId: { in: salesToLink.map(s => s.id) },
              productId: inventory.productId,
              staffInventoryId: null
            },
            data: {
              staffInventoryId: inventory.id
            }
          });
          
          results.inventoryLinked += salesToLink.length;
        }
      }
      
      console.log(`✅ Linked ${results.inventoryLinked} inventory items to sales`);
    } catch (error: any) {
      results.errors.push(`Inventory linking failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `Comprehensive fix completed for ${staff.name}`,
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email
      },
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error("Error in comprehensive fix:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to run comprehensive fix",
        details: error.message
      },
      { status: 500 }
    );
  }
}