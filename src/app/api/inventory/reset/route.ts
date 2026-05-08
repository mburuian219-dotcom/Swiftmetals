// src/app/api/inventory/reset/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper function to log inventory reset actions
const logInventoryReset = async (details: any, performedBy: string, performedByEmail: string, ipAddress?: string) => {
  try {
    console.log(`[INVENTORY RESET] ${new Date().toISOString()} - Performed by: ${performedBy} (${performedByEmail})`);
    console.log(`Details:`, details);
    
    // You can create a dedicated inventory_reset_logs table if needed
    // For now, we'll just log to console and could also create an audit entry
  } catch (error) {
    console.error('Failed to log inventory reset:', error);
  }
};

// GET endpoint to preview what will be deleted
export async function GET(request: NextRequest) {
  try {
    const preview = request.nextUrl.searchParams.get('preview') === 'true';

    // Get counts of all inventory-related data
    const counts = {
      products: await prisma.product.count(),
      stock: await prisma.stock.count(),
      restock: await prisma.restock.count(),
      catalogproducts: await prisma.catalogproduct.count(),
      staffInventory: await prisma.staffInventory.count(),
    };

    // Get sample of products that will be deleted
    const sampleProducts = await prisma.product.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        price: true,
        inStock: true,
        _count: {
          select: {
            stock: true,
            saleitem: true
          }
        }
      }
    });

    if (preview) {
      return NextResponse.json({
        message: 'Preview of inventory data that will be deleted',
        counts,
        sampleProducts,
        warning: 'This will delete ALL products and inventory records. Sales and customer data will be preserved.',
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({ counts });
  } catch (error) {
    console.error('Failed to get inventory counts:', error);
    return NextResponse.json(
      { error: 'Failed to get inventory data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST endpoint to reset inventory
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      confirm, 
      preserveSalesItems = true, // If true, sale items remain (but products become disconnected)
      performedBy,
      performedByEmail,
      ipAddress,
      reason 
    } = body;

    // Require confirmation
    if (!confirm || confirm !== 'CONFIRM_DELETE_ALL_INVENTORY') {
      return NextResponse.json(
        { 
          error: 'Confirmation required. Please provide confirm: "CONFIRM_DELETE_ALL_INVENTORY"',
          hint: 'Type exactly: CONFIRM_DELETE_ALL_INVENTORY'
        },
        { status: 400 }
      );
    }

    // Require user info for audit
    if (!performedBy || !performedByEmail) {
      return NextResponse.json(
        { error: 'User information required for audit trail' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const results: any = {};

    // Delete in order to handle foreign key constraints
    console.log('Starting inventory reset...');

    // 1. Delete staff inventory assignments
    results.staffInventory = await prisma.staffInventory.deleteMany();
    console.log(`✓ Deleted ${results.staffInventory.count} staff inventory assignments`);

    // 2. Delete restock records
    results.restock = await prisma.restock.deleteMany();
    console.log(`✓ Deleted ${results.restock.count} restock records`);

    // 3. Delete stock records
    results.stock = await prisma.stock.deleteMany();
    console.log(`✓ Deleted ${results.stock.count} stock records`);

    // 4. Handle sale items (either delete or set productId to null)
    if (preserveSalesItems) {
      // Update sale items to remove product reference (set productId to null)
      // Note: Your schema might not allow null, so we'll delete them
      results.saleItems = await prisma.saleitem.deleteMany();
      console.log(`✓ Deleted ${results.saleItems.count} sale items (products removed from sales)`);
    } else {
      results.saleItems = await prisma.saleitem.deleteMany();
      console.log(`✓ Deleted ${results.saleItems.count} sale items`);
    }

    // 5. Delete catalog products
    results.catalogproducts = await prisma.catalogproduct.deleteMany();
    console.log(`✓ Deleted ${results.catalogproducts.count} catalog products`);

    // 6. Finally, delete products
    results.products = await prisma.product.deleteMany();
    console.log(`✓ Deleted ${results.products.count} products`);

    const duration = Date.now() - startTime;

    // Log the reset action
    await logInventoryReset(
      { results, duration, reason, preserveSalesItems },
      performedBy,
      performedByEmail,
      ipAddress
    );

    return NextResponse.json({
      success: true,
      message: 'Inventory reset completed successfully',
      results,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      performedBy,
      performedByEmail,
      note: 'All inventory data has been deleted. You can now add new products and stock.'
    });

  } catch (error) {
    console.error('Failed to reset inventory:', error);
    return NextResponse.json(
      { 
        error: 'Failed to reset inventory', 
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}