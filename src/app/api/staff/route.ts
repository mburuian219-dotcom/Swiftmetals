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

// DELETE staff
export async function DELETE(req: NextRequest) {
  try {
    const data = await req.json();
    
    if (!data.id) {
      return NextResponse.json(
        { error: "Staff ID is required" },
        { status: 400 }
      );
    }

    // Check if staff has any inventory assigned
    const hasInventory = await prisma.staffInventory.findFirst({
      where: { staffId: data.id }
    });

    if (hasInventory) {
      return NextResponse.json(
        { error: "Cannot delete staff with assigned inventory. Remove inventory first." },
        { status: 400 }
      );
    }

    // Check if staff has any sales
    const hasSales = await prisma.sale.findFirst({
      where: { createdById: data.id }
    });

    if (hasSales) {
      return NextResponse.json(
        { error: "Cannot delete staff with sales records." },
        { status: 400 }
      );
    }

    const deletedStaff = await prisma.staff.delete({
      where: { id: data.id }
    });

    console.log(`🗑️ Deleted staff: ${deletedStaff.name} (${deletedStaff.email}) ID: ${deletedStaff.id}`);

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
      { error: "Failed to delete staff member" },
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