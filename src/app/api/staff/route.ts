// src/app/api/staff/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ================== Type Definitions ==================
interface StaffWithRelations {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
  staffInventories?: any[];
  createdSales?: any[];
  assignedSales?: any[];
  createdExpenses?: any[];
  updatedExpenses?: any[];
}

// Helper function to normalize email
function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

// Helper function for case-insensitive email search in MySQL
async function findStaffByEmailCaseInsensitive(email: string) {
  if (!email) return null;
  
  const normalizedEmail = normalizeEmail(email);
  
  // Try exact match first
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
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const includeInventory = searchParams.get('includeInventory') === 'true';
    const includeSales = searchParams.get('includeSales') === 'true';
    const includeExpenses = searchParams.get('includeExpenses') === 'true';

    // If email is provided, return single staff member
    if (email) {
      // For MySQL, we need to do case-insensitive search manually
      const normalizedEmail = normalizeEmail(email);
      
      const staff = await prisma.staff.findFirst({
        where: {
          email: normalizedEmail
        }
      });

      if (!staff) {
        // If not found with exact case, try to find by comparing normalized emails
        const allStaff = await prisma.staff.findMany({
          where: {
            email: { not: null }
          }
        });
        
        const foundStaff = allStaff.find(s => 
          s.email && normalizeEmail(s.email) === normalizedEmail
        );
        
        if (!foundStaff) {
          return NextResponse.json({ error: "Staff not found" }, { status: 404 });
        }
        
        // Now fetch the full staff data with includes
        const fullStaff = await prisma.staff.findUnique({
          where: { id: foundStaff.id },
          include: {
            staffInventories: includeInventory ? {
              include: {
                product: true,
                saleItems: {
                  include: {
                    sale: true,
                    product: true
                  }
                }
              }
            } : false,
            createdSales: includeSales ? {
              include: {
                customer: true,
                saleitem: {
                  include: {
                    product: true,
                    staffInventory: true
                  }
                },
                payment: true,
                invoice: true,
                paymentschedule: true
              },
              orderBy: { createdAt: "desc" },
              take: 50
            } : false,
            assignedSales: includeSales ? {
              include: {
                customer: true,
                saleitem: {
                  include: {
                    product: true,
                    staffInventory: true
                  }
                },
                payment: true,
                invoice: true,
                paymentschedule: true
              },
              orderBy: { createdAt: "desc" },
              take: 50
            } : false,
            createdExpenses: includeExpenses ? {
              include: {
                cashledger: true
              }
            } : false,
            updatedExpenses: includeExpenses ? {
              include: {
                cashledger: true
              }
            } : false
          }
        });

        const transformedStaff = {
          ...fullStaff,
          sales: includeSales ? [...(fullStaff?.createdSales || []), ...(fullStaff?.assignedSales || [])] : undefined
        };

        return NextResponse.json(transformedStaff);
      }

      // Fetch full staff data with includes
      const fullStaff = await prisma.staff.findUnique({
        where: { id: staff.id },
        include: {
          staffInventories: includeInventory ? {
            include: {
              product: true,
              saleItems: {
                include: {
                  sale: true,
                  product: true
                }
              }
            }
          } : false,
          createdSales: includeSales ? {
            include: {
              customer: true,
              saleitem: {
                include: {
                  product: true,
                  staffInventory: true
                }
              },
              payment: true,
              invoice: true,
              paymentschedule: true
            },
            orderBy: { createdAt: "desc" },
            take: 50
          } : false,
          assignedSales: includeSales ? {
            include: {
              customer: true,
              saleitem: {
                include: {
                  product: true,
                  staffInventory: true
                }
              },
              payment: true,
              invoice: true,
              paymentschedule: true
            },
            orderBy: { createdAt: "desc" },
            take: 50
          } : false,
          createdExpenses: includeExpenses ? {
            include: {
              cashledger: true
            }
          } : false,
          updatedExpenses: includeExpenses ? {
            include: {
              cashledger: true
            }
          } : false
        }
      });

      // Transform for backward compatibility
      const transformedStaff = {
        ...fullStaff,
        sales: includeSales ? [...(fullStaff?.createdSales || []), ...(fullStaff?.assignedSales || [])] : undefined
      };

      return NextResponse.json(transformedStaff);
    }

    // Build include object for all staff
    const include: any = {
      staffInventories: includeInventory ? {
        include: {
          product: true,
          saleItems: {
            include: {
              sale: true,
              product: true
            }
          }
        }
      } : false,
      createdSales: includeSales ? {
        include: {
          customer: true,
          saleitem: {
            include: {
              product: true,
              staffInventory: true
            }
          },
          payment: true,
          invoice: true,
          paymentschedule: true
        },
        orderBy: { createdAt: "desc" },
        take: 10
      } : false,
      assignedSales: includeSales ? {
        include: {
          customer: true,
          saleitem: {
            include: {
              product: true,
              staffInventory: true
            }
          },
          payment: true,
          invoice: true,
          paymentschedule: true
        },
        orderBy: { createdAt: "desc" },
        take: 10
      } : false,
      createdExpenses: includeExpenses ? {
        include: {
          cashledger: true
        }
      } : false,
      updatedExpenses: includeExpenses ? {
        include: {
          cashledger: true
        }
      } : false
    };

    const staff = await prisma.staff.findMany({
      include,
      orderBy: {
        createdAt: "desc"
      }
    });

    // Transform for backward compatibility
    const transformedStaff = staff.map(member => ({
      ...member,
      sales: includeSales ? [...(member.createdSales || []), ...(member.assignedSales || [])] : undefined
    }));

    return NextResponse.json(transformedStaff);
  } catch (error: any) {
    console.error("Error fetching staff:", error);
    return NextResponse.json(
      { error: "Failed to fetch staff data", details: error.message },
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
      
      // Check if email already exists
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
        email: normalizedEmail,
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
      
      // Check if another staff has this email
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
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: "Staff ID is required" },
        { status: 400 }
      );
    }

    const staffId = parseInt(id);
    if (isNaN(staffId)) {
      return NextResponse.json(
        { error: "Invalid staff ID" },
        { status: 400 }
      );
    }

    // Check if staff exists
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      include: {
        staffInventories: {
          include: {
            product: true,
            saleItems: true
          }
        },
        createdSales: {
          include: {
            saleitem: true,
            invoice: true,
            payment: true,
            paymentschedule: true,
            smsreminder: true,
            cashledger: true,
            auditLogs: true
          }
        },
        assignedSales: {
          include: {
            saleitem: true,
            invoice: true,
            payment: true,
            paymentschedule: true,
            smsreminder: true,
            cashledger: true,
            auditLogs: true
          }
        },
        createdExpenses: {
          include: {
            cashledger: true
          }
        },
        updatedExpenses: {
          include: {
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
    
    // Combine all sales from both relations
    const allSales = [...(staff.createdSales || []), ...(staff.assignedSales || [])];
    const uniqueSaleIds = [...new Set(allSales.map((sale: any) => sale.id))];
    
    // Get counts for logging
    const inventoryCount = staff.staffInventories?.length || 0;
    const salesCount = allSales.length;
    const createdSalesCount = staff.createdSales?.length || 0;
    const assignedSalesCount = staff.assignedSales?.length || 0;
    const createdExpensesCount = staff.createdExpenses?.length || 0;
    const updatedExpensesCount = staff.updatedExpenses?.length || 0;
    
    console.log(`📊 Related records found:`);
    console.log(`   📦 Staff Inventories: ${inventoryCount}`);
    console.log(`   💰 Created Sales: ${createdSalesCount}`);
    console.log(`   📋 Assigned Sales: ${assignedSalesCount}`);
    console.log(`   💸 Total Sales: ${salesCount}`);
    console.log(`   📝 Created Expenses: ${createdExpensesCount}`);
    console.log(`   ✏️ Updated Expenses: ${updatedExpensesCount}`);
    
    let totalSaleItems = 0;
    let totalInvoices = 0;
    let totalPayments = 0;
    let totalSchedules = 0;
    let totalSMS = 0;
    let totalLedgerEntries = 0;
    let totalAuditLogs = 0;
    
    // Count related items from all sales
    allSales.forEach((sale: any) => {
      totalSaleItems += sale.saleitem?.length || 0;
      totalInvoices += sale.invoice?.length || 0;
      totalPayments += sale.payment?.length || 0;
      totalSchedules += sale.paymentschedule?.length || 0;
      totalSMS += sale.smsreminder?.length || 0;
      totalLedgerEntries += sale.cashledger?.length || 0;
      totalAuditLogs += sale.auditLogs?.length || 0;
    });
    
    console.log(`   📝 Sale Items: ${totalSaleItems}`);
    console.log(`   🧾 Invoices: ${totalInvoices}`);
    console.log(`   💳 Payments: ${totalPayments}`);
    console.log(`   📅 Payment Schedules: ${totalSchedules}`);
    console.log(`   📱 SMS Reminders: ${totalSMS}`);
    console.log(`   📒 Ledger Entries: ${totalLedgerEntries}`);
    console.log(`   📜 Audit Logs: ${totalAuditLogs}`);
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
        auditLogs: 0,
        sales: 0,
        createdExpenses: 0,
        updatedExpenses: 0,
        staff: false
      };

      // 1. Delete sale items that belong to staff's sales
      if (uniqueSaleIds.length > 0) {
        const saleItemDeletion = await tx.saleitem.deleteMany({
          where: {
            saleId: { in: uniqueSaleIds }
          }
        });
        results.saleItems = saleItemDeletion.count;
        console.log(`✅ Deleted ${results.saleItems} sale items`);
      }

      // 2. Delete audit logs
      if (uniqueSaleIds.length > 0) {
        const auditLogDeletion = await tx.saleauditlog.deleteMany({
          where: {
            saleId: { in: uniqueSaleIds }
          }
        });
        results.auditLogs = auditLogDeletion.count;
        console.log(`✅ Deleted ${results.auditLogs} audit logs`);
      }

      // 3. Delete invoices
      if (uniqueSaleIds.length > 0) {
        const invoiceDeletion = await tx.invoice.deleteMany({
          where: {
            saleId: { in: uniqueSaleIds }
          }
        });
        results.invoices = invoiceDeletion.count;
        console.log(`✅ Deleted ${results.invoices} invoices`);
      }

      // 4. Delete payments
      if (uniqueSaleIds.length > 0) {
        const paymentDeletion = await tx.payment.deleteMany({
          where: {
            saleId: { in: uniqueSaleIds }
          }
        });
        results.payments = paymentDeletion.count;
        console.log(`✅ Deleted ${results.payments} payments`);
      }

      // 5. Delete payment schedules
      if (uniqueSaleIds.length > 0) {
        const scheduleDeletion = await tx.paymentschedule.deleteMany({
          where: {
            saleId: { in: uniqueSaleIds }
          }
        });
        results.paymentSchedules = scheduleDeletion.count;
        console.log(`✅ Deleted ${results.paymentSchedules} payment schedules`);
      }

      // 6. Delete SMS reminders
      if (uniqueSaleIds.length > 0) {
        const smsDeletion = await tx.smsreminder.deleteMany({
          where: {
            saleId: { in: uniqueSaleIds }
          }
        });
        results.smsReminders = smsDeletion.count;
        console.log(`✅ Deleted ${results.smsReminders} SMS reminders`);
      }

      // 7. Delete ledger entries related to these sales
      if (uniqueSaleIds.length > 0) {
        const ledgerDeletion = await tx.cashledger.deleteMany({
          where: {
            saleId: { in: uniqueSaleIds }
          }
        });
        results.ledgerEntries = ledgerDeletion.count;
        console.log(`✅ Deleted ${results.ledgerEntries} ledger entries`);
      }

      // 8. Delete the sales themselves
      if (uniqueSaleIds.length > 0) {
        const saleDeletion = await tx.sale.deleteMany({
          where: {
            id: { in: uniqueSaleIds }
          }
        });
        results.sales = saleDeletion.count;
        console.log(`✅ Deleted ${results.sales} sales`);
      }

      // 9. Delete expenses created by this staff
      if (staff.createdExpenses && staff.createdExpenses.length > 0) {
        const expenseIds = staff.createdExpenses.map((e: any) => e.id);
        const expenseDeletion = await tx.expense.deleteMany({
          where: {
            id: { in: expenseIds }
          }
        });
        results.createdExpenses = expenseDeletion.count;
        console.log(`✅ Deleted ${results.createdExpenses} expenses created by staff`);
      }

      // 10. Update expenses where staff is the updater (set to null)
      if (staff.updatedExpenses && staff.updatedExpenses.length > 0) {
        const updatedExpenseIds = staff.updatedExpenses.map((e: any) => e.id);
        await tx.expense.updateMany({
          where: {
            id: { in: updatedExpenseIds }
          },
          data: {
            updatedById: null
          }
        });
        results.updatedExpenses = staff.updatedExpenses.length;
        console.log(`✅ Updated ${results.updatedExpenses} expenses (removed staff as updater)`);
      }

      // 11. Delete staff inventories
      const inventoryDeletion = await tx.staffInventory.deleteMany({
        where: {
          staffId: staffId
        }
      });
      results.staffInventory = inventoryDeletion.count;
      console.log(`✅ Deleted ${results.staffInventory} staff inventory items`);

      // 12. Finally delete the staff member
      await tx.staff.delete({
        where: { id: staffId }
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
      deletionResults.auditLogs +
      deletionResults.createdExpenses +
      deletionResults.updatedExpenses +
      1; // +1 for the staff member

    console.log("=".repeat(60));
    console.log(`🎉 COMPLETE: Deleted ${totalDeleted} total records for staff ${staff.name}`);
    console.log(`🏁 Staff ${staff.name} (ID: ${staff.id}) has been completely removed`);
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
          createdSales: createdSalesCount,
          assignedSales: assignedSalesCount,
          totalSales: deletionResults.sales,
          saleItems: deletionResults.saleItems,
          invoices: deletionResults.invoices,
          payments: deletionResults.payments,
          paymentSchedules: deletionResults.paymentSchedules,
          smsReminders: deletionResults.smsReminders,
          ledgerEntries: deletionResults.ledgerEntries,
          auditLogs: deletionResults.auditLogs,
          createdExpenses: deletionResults.createdExpenses,
          updatedExpenses: deletionResults.updatedExpenses
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
    
    const results: any[] = [];
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