// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Helper to normalize email
function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  try {
    console.log("🔄 Starting bulk staff-sales linking...");
    
    // Get all sales with createdBy but no createdById
    const unlinkedSales = await prisma.sale.findMany({
      where: {
        createdBy: { not: null },
        createdById: null
      },
      select: {
        id: true,
        createdBy: true,
        amount: true,
        date: true,
        customerId: true
      },
      orderBy: { date: 'desc' }
    });
    
    console.log(`📊 Found ${unlinkedSales.length} unlinked sales`);
    
    // Get all staff with emails
    const allStaff = await prisma.staff.findMany({
      where: { email: { not: null } },
      select: { id: true, name: true, email: true }
    });
    
    console.log(`👥 Found ${allStaff.length} staff with emails`);
    
    // Create email-to-staff mapping
    const staffMap = new Map<string, any>();
    allStaff.forEach(staff => {
      if (staff.email) {
        const normalizedEmail = normalizeEmail(staff.email);
        staffMap.set(normalizedEmail, staff);
      }
    });
    
    // Results tracking
    const results = {
      linked: [] as any[],
      failed: [] as any[],
      createdStaff: [] as any[]
    };
    
    // Process each unlinked sale
    for (const sale of unlinkedSales) {
      if (!sale.createdBy) continue;
      
      const saleEmail = normalizeEmail(sale.createdBy);
      
      // Skip invalid emails
      if (!saleEmail.includes('@')) {
        results.failed.push({
          saleId: sale.id,
          reason: 'Invalid email format',
          email: sale.createdBy
        });
        continue;
      }
      
      // Find or create staff
      let staff = staffMap.get(saleEmail);
      
      if (!staff) {
        try {
          // Create staff name from email
          const name = saleEmail.split('@')[0]
            .replace(/[._-]/g, ' ')
            .replace(/\b\w/g, (l: string) => l.toUpperCase());
          
          // Create new staff
          const newStaff = await prisma.staff.create({
            data: {
              name,
              email: saleEmail,
              phone: null
            }
          });
          
          console.log(`👤 Created staff: ${newStaff.name} for email: ${saleEmail}`);
          
          staff = newStaff;
          staffMap.set(saleEmail, staff);
          results.createdStaff.push({
            staffId: staff.id,
            staffName: staff.name,
            email: staff.email
          });
          
        } catch (error) {
          console.error(`❌ Failed to create staff for ${saleEmail}:`, error);
          results.failed.push({
            saleId: sale.id,
            reason: 'Failed to create staff',
            email: sale.createdBy
          });
          continue;
        }
      }
      
      // Link sale to staff
      try {
        await prisma.sale.update({
          where: { id: sale.id },
          data: { createdById: staff.id }
        });
        
        results.linked.push({
          saleId: sale.id,
          staffId: staff.id,
          staffName: staff.name,
          email: saleEmail,
          amount: sale.amount,
          date: sale.date
        });
        
        console.log(`🔗 Linked sale ${sale.id} to staff ${staff.name} (${staff.id})`);
        
      } catch (error) {
        console.error(`❌ Failed to link sale ${sale.id}:`, error);
        results.failed.push({
          saleId: sale.id,
          reason: 'Update failed',
          email: sale.createdBy,
          staffId: staff.id
        });
      }
    }
    
    // Summary
    const summary = {
      totalUnlinked: unlinkedSales.length,
      successfullyLinked: results.linked.length,
      staffCreated: results.createdStaff.length,
      failed: results.failed.length,
      successRate: unlinkedSales.length > 0 
        ? ((results.linked.length / unlinkedSales.length) * 100).toFixed(1) + '%'
        : 'N/A'
    };
    
    console.log("🎯 Linking Summary:", summary);
    
    // Also link sales where createdBy is null but we can infer from email patterns
    console.log("🔄 Attempting to link null createdBy sales...");
    
    const nullCreatedBySales = await prisma.sale.findMany({
      where: {
        createdBy: null,
        createdById: null
      },
      select: {
        id: true,
        amount: true,
        date: true
      },
      take: 100 // Limit to prevent infinite loop
    });
    
    console.log(`📊 Found ${nullCreatedBySales.length} sales with null createdBy`);
    
    return NextResponse.json({
      success: true,
      message: `Linked ${results.linked.length} sales to staff members`,
      timestamp: new Date().toISOString(),
      summary,
      details: {
        linkedSales: results.linked.slice(0, 20), // First 20
        createdStaff: results.createdStaff,
        failedSales: results.failed.slice(0, 10), // First 10 failures
        nullCreatedBySales: nullCreatedBySales.length
      }
    });
    
  } catch (error: any) {
    console.error("❌ Bulk linking error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Bulk linking failed",
        details: error.message
      },
      { status: 500 }
    );
  }
}

// Manual linking for specific staff
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const staffId = data.staffId;
    
    if (!staffId) {
      return NextResponse.json(
        { error: "Staff ID is required" },
        { status: 400 }
      );
    }
    
    // Get staff details
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, name: true, email: true }
    });
    
    if (!staff) {
      return NextResponse.json(
        { error: "Staff not found" },
        { status: 404 }
      );
    }
    
    if (!staff.email) {
      return NextResponse.json(
        { error: "Staff has no email to match against" },
        { status: 400 }
      );
    }
    
    const normalizedEmail = normalizeEmail(staff.email);
    
    console.log(`🔗 Manually linking sales for staff: ${staff.name} (${normalizedEmail})`);
    
    // Find matching unlinked sales
    const matchingSales = await prisma.sale.findMany({
      where: {
        OR: [
          { createdBy: normalizedEmail },
          { createdBy: staff.email } // Also check original case
        ],
        createdById: null
      },
      select: {
        id: true,
        createdBy: true,
        amount: true,
        date: true
      }
    });
    
    console.log(`📊 Found ${matchingSales.length} matching unlinked sales`);
    
    if (matchingSales.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No matching unlinked sales found",
        staffId: staff.id,
        staffName: staff.name,
        linkedCount: 0
      });
    }
    
    // Link the sales
    const updateResult = await prisma.sale.updateMany({
      where: {
        id: { in: matchingSales.map(s => s.id) }
      },
      data: {
        createdById: staff.id
      }
    });
    
    console.log(`✅ Linked ${updateResult.count} sales to staff ${staff.name}`);
    
    return NextResponse.json({
      success: true,
      message: `Linked ${updateResult.count} sales to ${staff.name}`,
      staffId: staff.id,
      staffName: staff.name,
      staffEmail: staff.email,
      linkedCount: updateResult.count,
      matchedCount: matchingSales.length,
      sampleSales: matchingSales.slice(0, 5)
    });
    
  } catch (error: any) {
    console.error("❌ Manual linking error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Manual linking failed",
        details: error.message
      },
      { status: 500 }
    );
  }
}