import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Helper function to normalize email
function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

// Helper function for case-insensitive email search in MySQL
async function findStaffByEmailCaseInsensitive(email: string) {
  if (!email) return null;
  
  const normalizedEmail = normalizeEmail(email);
  
  // For MySQL, we need to handle case-insensitive search differently
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

// GET all staff with their inventory and sales
export async function GET(req: NextRequest) {
  try {
    const staff = await prisma.staff.findMany({
      include: {
        staffInventories: {
          include: {
            product: true
          }
        },
        sales: {
          include: {
            saleitem: {
              include: {
                product: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json(staff);
  } catch (error: any) {
    console.error("Error fetching staff:", error);
    return NextResponse.json(
      { error: "Failed to fetch staff data" },
      { status: 500 }
    );
  }
}

// POST create new staff
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    if (!data.name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    let normalizedEmail = null;
    if (data.email) {
      normalizedEmail = normalizeEmail(data.email);
      
      // Check if email already exists (case-insensitive for MySQL)
      const existingStaff = await findStaffByEmailCaseInsensitive(normalizedEmail);

      if (existingStaff) {
        return NextResponse.json(
          { 
            error: "A staff member with this email already exists",
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

    const newStaff = await prisma.staff.create({
      data: {
        name: data.name,
        email: normalizedEmail, // Store normalized email
        phone: data.phone ? data.phone.trim() : null
      }
    });

    console.log(`👤 Created staff: ${newStaff.name} (${newStaff.email}) ID: ${newStaff.id}`);

    return NextResponse.json(newStaff, { status: 201 });
  } catch (error: any) {
    console.error("Error creating staff:", error);
    return NextResponse.json(
      { error: "Failed to create staff member" },
      { status: 500 }
    );
  }
}

// PUT update staff
export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    
    if (!data.id) {
      return NextResponse.json(
        { error: "Staff ID is required" },
        { status: 400 }
      );
    }

    let normalizedEmail = null;
    if (data.email) {
      normalizedEmail = normalizeEmail(data.email);
      
      // Check if another staff has this email (case-insensitive)
      const existingStaff = await findStaffByEmailCaseInsensitive(normalizedEmail);

      if (existingStaff && existingStaff.id !== data.id) {
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
      where: { id: data.id },
      data: {
        name: data.name,
        email: normalizedEmail,
        phone: data.phone ? data.phone.trim() : null
      }
    });

    console.log(`✏️ Updated staff: ${updatedStaff.name} (${updatedStaff.email}) ID: ${updatedStaff.id}`);

    return NextResponse.json(updatedStaff);
  } catch (error: any) {
    console.error("Error updating staff:", error);
    return NextResponse.json(
      { error: "Failed to update staff member" },
      { status: 500 }
    );
  }
}

// DELETE staff (with cascade deletion of related records)
export async function DELETE(req: NextRequest) {
  try {
    const data = await req.json();
    
    if (!data.id) {
      return NextResponse.json(
        { error: "Staff ID is required" },
        { status: 400 }
      );
    }

    // Check if staff exists first
    const staff = await prisma.staff.findUnique({
      where: { id: data.id },
      include: {
        staffInventories: true,
        sales: {
          include: {
            saleitem: true,
            invoice: true,
            payment: true,
            paymentschedule: true,
            smsreminder: true,
            cashledger: true
          }
        }
      }
    });

    if (!staff) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      );
    }

    console.log(`🗑️ Starting cascade deletion for staff: ${staff.name} (ID: ${staff.id})`);
    console.log("=".repeat(60));
    
    // Get counts for logging
    const inventoryCount = staff.staffInventories.length;
    const salesCount = staff.sales.length;
    
    console.log(`📊 Related records found:`);
    console.log(`   📦 Staff Inventories: ${inventoryCount}`);
    console.log(`   💰 Sales: ${salesCount}`);
    
    let totalSaleItems = 0;
    let totalInvoices = 0;
    let totalPayments = 0;
    let totalSchedules = 0;
    let totalSMS = 0;
    let totalLedgerEntries = 0;
    
    // Count related sales items
    staff.sales.forEach(sale => {
      totalSaleItems += sale.saleitem?.length || 0;
      totalInvoices += sale.invoice?.length || 0;
      totalPayments += sale.payment?.length || 0;
      totalSchedules += sale.paymentschedule?.length || 0;
      totalSMS += sale.smsreminder?.length || 0;
      totalLedgerEntries += sale.cashledger?.length || 0;
    });
    
    console.log(`   📝 Sale Items: ${totalSaleItems}`);
    console.log(`   🧾 Invoices: ${totalInvoices}`);
    console.log(`   💳 Payments: ${totalPayments}`);
    console.log(`   📅 Payment Schedules: ${totalSchedules}`);
    console.log(`   📱 SMS Reminders: ${totalSMS}`);
    console.log(`   📒 Ledger Entries: ${totalLedgerEntries}`);
    console.log("=".repeat(60));

    // Use a transaction to ensure all deletions succeed or none do
    const deletionResults = await prisma.$transaction(async (tx) => {
      const results = {
        staffInventory: 0,
        saleItems: 0,
        invoices: 0,
        payments: 0,
        paymentSchedules: 0,
        smsReminders: 0,
        ledgerEntries: 0,
        sales: 0,
        staff: false
      };

      // Get all sale IDs for this staff
      const staffSaleIds = staff.sales.map(sale => sale.id);
      
      // 1. Delete sale items that belong to staff's sales
      if (staffSaleIds.length > 0) {
        const saleItemDeletion = await tx.saleitem.deleteMany({
          where: {
            saleId: { in: staffSaleIds }
          }
        });
        results.saleItems = saleItemDeletion.count;
        console.log(`✅ Deleted ${results.saleItems} sale items`);
      }

      // 2. Delete invoices
      const invoiceDeletion = await tx.invoice.deleteMany({
        where: {
          saleId: { in: staffSaleIds }
        }
      });
      results.invoices = invoiceDeletion.count;
      console.log(`✅ Deleted ${results.invoices} invoices`);

      // 3. Delete payments
      const paymentDeletion = await tx.payment.deleteMany({
        where: {
          saleId: { in: staffSaleIds }
        }
      });
      results.payments = paymentDeletion.count;
      console.log(`✅ Deleted ${results.payments} payments`);

      // 4. Delete payment schedules
      const scheduleDeletion = await tx.paymentschedule.deleteMany({
        where: {
          saleId: { in: staffSaleIds }
        }
      });
      results.paymentSchedules = scheduleDeletion.count;
      console.log(`✅ Deleted ${results.paymentSchedules} payment schedules`);

      // 5. Delete SMS reminders
      const smsDeletion = await tx.smsreminder.deleteMany({
        where: {
          saleId: { in: staffSaleIds }
        }
      });
      results.smsReminders = smsDeletion.count;
      console.log(`✅ Deleted ${results.smsReminders} SMS reminders`);

      // 6. Delete ledger entries related to these sales
      const ledgerDeletion = await tx.cashledger.deleteMany({
        where: {
          saleId: { in: staffSaleIds }
        }
      });
      results.ledgerEntries = ledgerDeletion.count;
      console.log(`✅ Deleted ${results.ledgerEntries} ledger entries`);

      // 7. Now delete the sales themselves
      const saleDeletion = await tx.sale.deleteMany({
        where: {
          id: { in: staffSaleIds }
        }
      });
      results.sales = saleDeletion.count;
      console.log(`✅ Deleted ${results.sales} sales`);

      // 8. Delete staff inventories (unlink from sale items first if needed)
      const inventoryDeletion = await tx.staffInventory.deleteMany({
        where: {
          staffId: data.id
        }
      });
      results.staffInventory = inventoryDeletion.count;
      console.log(`✅ Deleted ${results.staffInventory} staff inventory items`);

      // 9. Finally delete the staff member
      await tx.staff.delete({
        where: { id: data.id }
      });
      results.staff = true;
      console.log(`✅ Deleted staff member: ${staff.name}`);

      return results;
    });

    const totalDeleted = 
      deletionResults.staffInventory +
      deletionResults.saleItems +
      deletionResults.sales +
      deletionResults.invoices +
      deletionResults.payments +
      deletionResults.paymentSchedules +
      deletionResults.smsReminders +
      deletionResults.ledgerEntries +
      1; // +1 for the staff member

    console.log("=".repeat(60));
    console.log(`🎉 COMPLETE: Deleted ${totalDeleted} total records for staff ${staff.name}`);
    console.log(`🏁 Staff ${staff.name} (ID: ${staff.id}) has been completely removed from the system`);
    console.log("=".repeat(60));

    return NextResponse.json({ 
      success: true,
      message: `Staff member and all related records deleted successfully`,
      details: {
        staffName: staff.name,
        staffId: staff.id,
        totalRecordsDeleted: totalDeleted,
        breakdown: {
          staff: 1,
          staffInventory: deletionResults.staffInventory,
          sales: deletionResults.sales,
          saleItems: deletionResults.saleItems,
          invoices: deletionResults.invoices,
          payments: deletionResults.payments,
          paymentSchedules: deletionResults.paymentSchedules,
          smsReminders: deletionResults.smsReminders,
          ledgerEntries: deletionResults.ledgerEntries
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error("❌ Error deleting staff with cascade:", error);
    console.error("Stack trace:", error.stack);
    
    // Handle specific Prisma errors
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      );
    }
    
    if (error.code === "P2003") {
      return NextResponse.json(
        { 
          error: "Foreign key constraint failed. There might be records referencing this staff that cannot be deleted automatically.",
          details: error.message,
          suggestion: "Check if there are any sale items still linked to staff inventories, or update your Prisma schema to include cascade delete relations."
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        error: "Failed to delete staff member with cascade",
        details: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }
}

// BULK normalize existing staff emails (one-time use)
export async function PATCH(req: NextRequest) {
  try {
    console.log("🔄 Starting bulk staff email normalization...");
    
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
      const normalizedEmail = normalizeEmail(currentEmail);
      
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
        } catch (error: any) {
          console.error(`❌ Failed to update staff ${staff.id}:`, error);
          results.push({
            staffId: staff.id,
            staffName: staff.name,
            email: currentEmail,
            changed: false,
            error: error.message
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
    
    return NextResponse.json({
      success: true,
      message: `Normalized ${updatedCount} staff emails`,
      summary: {
        totalStaff: allStaff.length,
        staffUpdated: updatedCount
      },
      details: results.filter(r => r.changed),
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error("❌ Email normalization error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Email normalization failed",
        details: error.message
      },
      { status: 500 }
    );
  }
}