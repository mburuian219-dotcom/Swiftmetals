import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import ExcelJS from "exceljs";

export async function GET() {
  try {
    // Fetch sales with related product + customer
    const sales = await prisma.sale.findMany({
      include: {
        customer: true,
        saleitem: { include: { product: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch expenses
    const expenses = await prisma.expense.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Financial Report");

    // Columns
    sheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Type", key: "type", width: 18 },
      { header: "Description", key: "description", width: 40 },
      { header: "Amount", key: "amount", width: 15 },
      { header: "Date", key: "date", width: 20 },
    ];

    // Header style
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };

    // Calculate total production costs from items sold
    let totalProductionCosts = 0;

    // Sales rows + production costs
    sales.forEach((s) => {
      s.saleitem.forEach((item) => {
        // Sale row
        sheet.addRow({
          id: `S-${s.id}`,
          type: "Sale",
          description: `${item.product?.name || "Product"} sold to ${
            s.customer?.name || "Unknown"
          } (Qty: ${item.quantity})`,
          amount: Number(s.amount),
          date: s.createdAt.toISOString(),
        });

        // Calculate production cost for this sale item
        if (item.product && item.product.productionCost) {
          const itemProductionCost = Number(item.product.productionCost) * item.quantity;
          totalProductionCosts += itemProductionCost;
        }
      });
    });

    // Production costs section (based on items sold)
    sheet.addRow({});
    sheet.addRow({
      id: "",
      type: "--- PRODUCTION COSTS ---",
      description: "",
      amount: "",
      date: "",
    }).font = { bold: true };

    // Group production costs by product for display
    const productionCostsByProduct: Record<string, { quantity: number; cost: number; productionCost: number }> = {};
    
    sales.forEach((s) => {
      s.saleitem.forEach((item) => {
        if (item.product && item.product.productionCost) {
          const productName = item.product.name;
          const productionCost = Number(item.product.productionCost);
          const itemCost = productionCost * item.quantity;

          if (!productionCostsByProduct[productName]) {
            productionCostsByProduct[productName] = {
              quantity: 0,
              cost: 0,
              productionCost: productionCost,
            };
          }

          productionCostsByProduct[productName].quantity += item.quantity;
          productionCostsByProduct[productName].cost += itemCost;
        }
      });
    });

    // Add production cost rows
    Object.entries(productionCostsByProduct).forEach(([productName, data]) => {
      sheet.addRow({
        id: `PC-${productName}`,
        type: "Production Cost",
        description: `${productName} (Qty Sold: ${data.quantity} × Cost: ${data.productionCost})`,
        amount: -Math.abs(data.cost),
        date: new Date().toISOString(),
      });
    });

    // Expenses section
    sheet.addRow({});
    sheet.addRow({
      id: "",
      type: "--- EXPENSES ---",
      description: "",
      amount: "",
      date: "",
    }).font = { bold: true };

    expenses.forEach((e) => {
      sheet.addRow({
        id: `E-${e.id}`,
        type: "Expense",
        description: `${e.title} (${e.category || "General"}) - ${
          e.notes || ""
        }`,
        amount: -Math.abs(Number(e.amount)),
        date: e.createdAt.toISOString(),
      });
    });

    // Totals
    const totalSales = sales.reduce((sum: number, s) => sum + Number(s.amount), 0);
    const totalExpenses = expenses.reduce(
      (sum: number, e) => sum + Number(e.amount),
      0
    );
    const netProfit = totalSales - totalProductionCosts - totalExpenses;

    // Add summary
    sheet.addRow({});
    sheet.addRow({});
    const summaryStartRow = sheet.lastRow ? sheet.lastRow.number + 1 : 1;

    sheet.addRow({ description: "FINANCIAL SUMMARY", amount: "" });
    sheet.getRow(summaryStartRow).font = { bold: true, size: 14 };

    sheet.addRow({});

    // Total Sales
    sheet.addRow({ description: "TOTAL SALES", amount: totalSales }).font = { bold: true };

    // Total Production Costs
    sheet.addRow({
      description: "TOTAL PRODUCTION COSTS (Items Sold)",
      amount: -totalProductionCosts,
    }).font = { bold: true };

    // Total Expenses
    sheet.addRow({
      description: "TOTAL EXPENSES",
      amount: -totalExpenses,
    }).font = { bold: true };

    sheet.addRow({});

    // Net Profit
    const profitRow = sheet.addRow({
      description: "NET PROFIT",
      amount: netProfit,
    });
    profitRow.font = { bold: true, size: 12 };
    profitRow.getCell("amount").numFmt = "#,##0.00";
    profitRow.getCell("amount").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: netProfit >= 0 ? "FF92D050" : "FFFF0000" },
    };
    profitRow.getCell("amount").font = {
      bold: true,
      size: 12,
      color: { argb: "FFFFFFFF" },
    };

    // Stream buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=financial-report-${new Date()
          .toISOString()
          .split("T")[0]}.xlsx`,
      },
    });
  } catch (error) {
    console.error("GET /api/reports error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}