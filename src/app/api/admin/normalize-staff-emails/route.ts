import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    console.log("🔄 Starting staff email normalization...");
    
    // Get all staff with emails
    const allStaff = await prisma.staff.findMany({
      where: { email: { not: null } },
      select: { id: true, name: true, email: true }
    });
    
    console.log(`👥 Found ${allStaff.length} staff with emails`);
    
    const results = [];
    let updatedCount = 0;
    
    for (const staff of allStaff) {
      if (!staff.email) continue;
      
      const currentEmail = staff.email;
      const normalizedEmail = currentEmail.trim().toLowerCase();
      
      // Check if email needs normalization
      if (currentEmail !== normalizedEmail) {
        try {
          // Update to normalized email
          await prisma.staff.update({
            where: { id: staff.id },
            data: { email: normalizedEmail }
          });
          
          results.push({
            staffId: staff.id,
            staffName: staff.name,
            oldEmail: currentEmail,
            newEmail: normalizedEmail,
            changed: true
          });
          
          updatedCount++;
          console.log(`🔄 Normalized: ${currentEmail} → ${normalizedEmail}`);
        } catch (error: any) { // Fix: Add type annotation
          console.error(`❌ Failed to update staff ${staff.id}:`, error);
          results.push({
            staffId: staff.id,
            staffName: staff.name,
            email: currentEmail,
            changed: false,
            error: error?.message || 'Unknown error'
          });
        }
      } else {
        results.push({
          staffId: staff.id,
          staffName: staff.name,
          email: currentEmail,
          changed: false
        });
      }
    }
    
    // Also normalize sales createdBy emails
    console.log("🔄 Normalizing sales createdBy emails...");
    
    let salesUpdated = 0;
    try {
      // Get sales with non-normalized emails
      const salesWithEmail = await prisma.sale.findMany({
        where: {
          createdBy: { not: null }
        },
        select: {
          id: true,
          createdBy: true
        }
      });
      
      for (const sale of salesWithEmail) {
        if (!sale.createdBy) continue;
        
        const current = sale.createdBy;
        const normalized = current.trim().toLowerCase();
        
        if (current !== normalized) {
          await prisma.sale.update({
            where: { id: sale.id },
            data: { createdBy: normalized }
          });
          salesUpdated++;
        }
      }
      
      console.log(`✅ Normalized ${salesUpdated} sales emails`);
    } catch (error: any) { // Fix: Add type annotation
      console.error("❌ Error normalizing sales emails:", error);
    }
    
    return NextResponse.json({
      success: true,
      message: `Normalized ${updatedCount} staff emails and ${salesUpdated} sales emails`,
      summary: {
        totalStaff: allStaff.length,
        staffUpdated: updatedCount,
        salesUpdated: salesUpdated
      },
      details: results.filter(r => r.changed),
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) { // Fix: Add type annotation
    console.error("❌ Email normalization error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Email normalization failed",
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}