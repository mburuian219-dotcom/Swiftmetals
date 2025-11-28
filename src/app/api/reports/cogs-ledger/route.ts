import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// CSV helper (no libraries needed)
const toCSV = (rows: any[][]) => {
  return rows
    .map((row) =>
      row.map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format");

    // ✅ CORRECT MODEL NAME
    const items: any[] = await prisma.saleitem.findMany({
      include: {
        sale: true,
        product: true
      }
    });

    const ledger = items.map((item) => {
      const quantity = Number(item.quantity || 0);
      const unitCost = Number(item.product?.productionCost || 0);
      const totalCost = quantity * unitCost;

      return {
        date: item.sale?.date
          ? new Date(item.sale.date).toISOString().split("T")[0]
          : "N/A",
        saleId: item.saleId ?? "N/A",
        productId: item.productId ?? "N/A",
        productName: item.product?.name ?? "Unknown",
        quantitySold: quantity,
        unitProductionCost: unitCost,
        totalProductionCost: totalCost,
        saleAmount: Number(item.total || 0),
        saleStatus: item.sale?.status ?? "N/A"
      };
    });

    // CSV download
    if (format === "csv") {
      const headers = [
        "Date",
        "Sale ID",
        "Product ID",
        "Product Name",
        "Quantity Sold",
        "Unit Production Cost",
        "Total Production Cost",
        "Sale Amount",
        "Sale Status"
      ];

      const rows = ledger.map((r) => [
        r.date,
        r.saleId,
        r.productId,
        r.productName,
        r.quantitySold,
        r.unitProductionCost,
        r.totalProductionCost,
        r.saleAmount,
        r.saleStatus
      ]);

      const csv = toCSV([headers, ...rows]);

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=cogs-ledger.csv"
        }
      });
    }

    return NextResponse.json({
      count: ledger.length,
      data: ledger
    });
  } catch (err: any) {
    console.error("COGS LEDGER ERROR:", err.message);

    return NextResponse.json(
      { error: "Failed to generate COGS Ledger", details: err.message },
      { status: 500 }
    );
  }
}

