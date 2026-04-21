import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/deleted-sales
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";
    const filter = searchParams.get("filter"); // today, week, month, all
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status");

    const skip = (page - 1) * limit;

    // Build where clause
    let where: any = {
      restoredAt: null, // Only show not restored
      expiresAt: { gt: new Date() } // Not expired
    };

    // Search functionality
    if (search) {
      where.OR = [
        { customerName: { contains: search } },
        { deletedBy: { contains: search } },
        { deletionReason: { contains: search } },
        { saleItemsSummary: { contains: search } }
      ];
    }

    // Date filter
    if (filter && filter !== "all" && filter !== "custom") {
      const now = new Date();
      let startDateFilter: Date;

      switch (filter) {
        case "today":
          startDateFilter = new Date();
          startDateFilter.setHours(0, 0, 0, 0);
          where.deletedAt = { gte: startDateFilter };
          break;
        case "week":
          startDateFilter = new Date();
          startDateFilter.setDate(now.getDate() - 7);
          where.deletedAt = { gte: startDateFilter };
          break;
        case "month":
          startDateFilter = new Date();
          startDateFilter.setMonth(now.getMonth() - 1);
          where.deletedAt = { gte: startDateFilter };
          break;
      }
    }

    // Custom date range
    if (startDate && endDate) {
      where.deletedAt = {
        gte: new Date(startDate),
        lte: new Date(endDate + "T23:59:59")
      };
    }

    // Status filter
    if (status) {
      where.statusAtDeletion = status;
    }

    // Get deleted sales with pagination
    const [deletedSales, total] = await Promise.all([
      prisma.deletedsale.findMany({
        where,
        orderBy: { deletedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.deletedsale.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      deletedSales,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit
    });
  } catch (error: any) {
    console.error("❌ Error fetching deleted sales:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch deleted sales" },
      { status: 500 }
    );
  }
}

// DELETE /api/deleted-sales (Cleanup expired records)
export async function DELETE(req: NextRequest) {
  try {
    // Optional: Add authentication check here
    const authHeader = req.headers.get("authorization");
    // Verify admin access if needed
    
    // Permanently delete expired records (older than 7 days)
    const result = await prisma.deletedsale.deleteMany({
      where: {
        expiresAt: { lte: new Date() }
      }
    });

    console.log(`🧹 Cleaned up ${result.count} expired deleted sales`);

    return NextResponse.json({
      success: true,
      permanentlyDeleted: result.count,
      message: `Permanently deleted ${result.count} expired sales`
    });
  } catch (error: any) {
    console.error("❌ Error cleaning up deleted sales:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cleanup deleted sales" },
      { status: 500 }
    );
  }
}