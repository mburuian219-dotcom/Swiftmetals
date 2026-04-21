import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/sales/[id]/audit
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const saleId = parseInt(id);

    if (isNaN(saleId)) {
      return NextResponse.json(
        { error: "Invalid sale ID" },
        { status: 400 }
      );
    }

    // Check if sale exists
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      select: { id: true, customer: { select: { name: true } } }
    });

    if (!sale) {
      return NextResponse.json(
        { error: "Sale not found" },
        { status: 404 }
      );
    }

    // Get audit logs for this sale
    const auditLogs = await prisma.saleauditlog.findMany({
      where: { saleId },
      orderBy: { changedAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      logs: auditLogs,
      count: auditLogs.length,
      sale: {
        id: sale.id,
        customerName: sale.customer?.name
      }
    });
  } catch (error: any) {
    console.error("❌ Error fetching audit logs:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}