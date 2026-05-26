// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{
    id: string;
  }>;
}

// Helper to normalize email
function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

// Find sales by flexible email matching
async function findSalesByFlexibleEmail(staffEmail: string, excludeStaffId?: number) {
  if (!staffEmail) return [];
  
  const normalizedStaffEmail = normalizeEmail(staffEmail);
  
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
  
  return sales.map(s => s.id);
}

// Define return type for reduceStaffInventoryFromSale
interface ReduceInventoryResult {
  success: boolean;
  saleId: number;
  staffId: number;
  inventoryUpdates?: Array<{
    productId: number;
    productName?: string;
    quantitySold: number;
    previousSold: number;
    newSold: number;
    inventoryId: number;
  }>;
  errors?: string[];
  error?: string;
}

// Reduce staff inventory from sale
async function reduceStaffInventoryFromSale(staffId: number, saleId: number): Promise<ReduceInventoryResult> {
  try {
    console.log(`🔄 Syncing inventory for staff ${staffId} from sale ${saleId}`);
    
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
        error: 'Sale not found',
        saleId,
        staffId
      };
    }
    
    const inventoryUpdates = [];
    const errors = [];
    
    // Process each item in the sale
    for (const item of sale.saleitem) {
      const productId = item.productId;
      const quantitySold = item.quantity;
      
      // Skip if already linked to inventory
      if (item.staffInventoryId) {
        console.log(`⏭️ Sale item ${item.id} already linked to inventory ${item.staffInventoryId}, skipping`);
        continue;
      }
      
      console.log(`📦 Processing sale item: ${quantitySold}x ${item.product?.name} (ID: ${productId})`);
      
      // Find the staff's inventory for this product
      const staffInventory = await prisma.staffInventory.findFirst({
        where: {
          staffId: staffId,
          productId: productId,
          quantityGiven: {
            gt: 0
          }
        },
        orderBy: {
          createdAt: 'asc' // FIFO: Process oldest inventory first
        }
      });
      
      if (!staffInventory) {
        const error = `No inventory found for product ${productId} assigned to staff ${staffId}`;
        console.warn(`⚠️ ${error}`);
        errors.push(error);
        continue;
      }
      
      // Calculate remaining quantity before this sale
      const currentSold = staffInventory.quantitySold;
      const currentReturned = staffInventory.quantityReturned;
      const currentRemaining = staffInventory.quantityGiven - currentSold - currentReturned;
      
      if (currentRemaining < quantitySold) {
        const error = `Insufficient inventory for product ${productId}. Available: ${currentRemaining}, Required: ${quantitySold}`;
        console.warn(`⚠️ ${error}`);
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
    
    if (errors.length > 0) {
      return {
        success: false,
        saleId,
        staffId,
        errors,
        ...(inventoryUpdates.length > 0 && { inventoryUpdates })
      };
    }
    
    return {
      success: true,
      saleId,
      staffId,
      inventoryUpdates
    };
    
  } catch (error: any) {
    console.error(`❌ Error syncing inventory for sale ${saleId}:`, error);
    return {
      success: false,
      error: error.message,
      saleId,
      staffId
    };
  }
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

    console.log(`🔄 Starting sales sync for staff: ${staff.name}`);
    
    // Get all sales linked to this staff
    // 1. Direct sales (createdById = staffId)
    const directSaleIds = await prisma.sale.findMany({
      where: { createdById: staffId },
      select: { id: true }
    }).then(sales => sales.map(s => s.id));
    
    // 2. Sales by email matching
    let emailMatchedSaleIds: number[] = [];
    if (staff.email) {
      emailMatchedSaleIds = await findSalesByFlexibleEmail(staff.email, staffId);
    }
    
    // Combine and deduplicate
    const allSaleIds = [...new Set([...directSaleIds, ...emailMatchedSaleIds])];
    
    console.log(`📊 Found ${allSaleIds.length} sales to sync:`, {
      direct: directSaleIds.length,
      emailMatched: emailMatchedSaleIds.length
    });

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      totalItemsUpdated: 0,
      details: [] as any[]
    };
    
    // Process each sale
    for (const saleId of allSaleIds) {
      try {
        const result = await reduceStaffInventoryFromSale(staffId, saleId);
        results.processed++;
        
        if (result.success) {
          results.successful++;
          const itemsUpdated = result.inventoryUpdates?.length || 0;
          results.totalItemsUpdated += itemsUpdated;
          
          results.details.push({
            saleId,
            success: true,
            itemsUpdated,
            inventoryUpdates: result.inventoryUpdates || []
          });
          
          console.log(`✅ Synced sale ${saleId}: ${itemsUpdated} items updated`);
        } else {
          results.failed++;
          results.details.push({
            saleId,
            success: false,
            error: result.error || 'Unknown error',
            errors: result.errors || []
          });
          console.log(`❌ Failed to sync sale ${saleId}: ${result.error || 'Unknown error'}`);
        }
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 50));
        
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
      include: {
        product: {
          select: {
            name: true,
            price: true,
            productionCost: true
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

    return NextResponse.json({
      success: true,
      message: `Sales sync completed for ${staff.name}`,
      summary: {
        staff: {
          id: staff.id,
          name: staff.name,
          email: staff.email
        },
        sales: {
          totalFound: allSaleIds.length,
          ...results
        },
        inventorySummary
      },
      details: results.details,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error("❌ Error in sales sync:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to sync sales with inventory",
        details: error.message
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check sync status
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

    // Get sales linked to this staff
    const directSaleIds = await prisma.sale.findMany({
      where: { createdById: staffId },
      select: { id: true }
    }).then(sales => sales.map(s => s.id));
    
    let emailMatchedSaleIds: number[] = [];
    if (staff.email) {
      emailMatchedSaleIds = await findSalesByFlexibleEmail(staff.email, staffId);
    }
    
    const allSaleIds = [...new Set([...directSaleIds, ...emailMatchedSaleIds])];
    
    // Get inventory linked sales
    const inventoryLinkedSales = await prisma.staffInventory.findMany({
      where: { staffId },
      include: {
        saleItems: {
          select: {
            saleId: true
          }
        }
      }
    });
    
    const inventoryLinkedSaleIds = inventoryLinkedSales.flatMap(inv => 
      inv.saleItems.map(si => si.saleId)
    );
    
    // Get sales that need syncing (not linked to inventory)
    const unsyncedSaleIds = allSaleIds.filter(id => !inventoryLinkedSaleIds.includes(id));
    
    // Get staff inventory
    const staffInventories = await prisma.staffInventory.findMany({
      where: { staffId },
      include: {
        product: {
          select: {
            name: true
          }
        }
      }
    });

    return NextResponse.json({
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email
      },
      syncStatus: {
        totalSalesFound: allSaleIds.length,
        alreadySynced: inventoryLinkedSaleIds.length,
        needsSyncing: unsyncedSaleIds.length,
        syncPercentage: allSaleIds.length > 0 
          ? (inventoryLinkedSaleIds.length / allSaleIds.length) * 100 
          : 0
      },
      inventory: {
        totalAssignments: staffInventories.length,
        itemsGiven: staffInventories.reduce((sum, inv) => sum + inv.quantityGiven, 0),
        itemsSold: staffInventories.reduce((sum, inv) => sum + inv.quantitySold, 0),
        itemsReturned: staffInventories.reduce((sum, inv) => sum + inv.quantityReturned, 0)
      },
      readyForSync: unsyncedSaleIds.length > 0,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Error checking sync status:", error);
    return NextResponse.json(
      { error: "Failed to check sync status", details: error.message },
      { status: 500 }
    );
  }
}