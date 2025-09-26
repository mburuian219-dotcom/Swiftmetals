import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import ExcelJS from "exceljs";

export async function GET() {
  try {
    // Fetch sales with relations
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
      { header: "Type", key: "type", width: 12 },
      { header: "Description", key: "description", width: 40 },
      { header: "Amount", key: "amount", width: 15 },
      { header: "Date", key: "date", width: 20 },
    ];

    // Sales rows
    sales.forEach((s) => {
      s.saleitem.forEach((item) => {
        sheet.addRow({
          id: `S-${s.id}`,
          type: "Sale",
          description: `${item.product?.name || "Product"} sold to ${
            s.customer?.name || "Unknown"
          }`,
          amount: s.amount,
          date: s.createdAt.toISOString(),
        });
      });
    });

    // Expenses rows
    expenses.forEach((e) => {
      sheet.addRow({
        id: `E-${e.id}`,
        type: "Expense",
        description: `${e.title} (${e.category || "General"}) - ${e.notes || ""}`,
        amount: -Math.abs(e.amount),
        date: e.createdAt.toISOString(),
      });
    });

    // Totals
    const totalSales = sales.reduce((sum, s) => sum + Number(s.amount), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const netIncome = totalSales - totalExpenses;

    sheet.addRow({});
    sheet.addRow({ description: "TOTAL SALES", amount: totalSales });
    sheet.addRow({ description: "TOTAL EXPENSES", amount: -totalExpenses });
    sheet.addRow({ description: "NET INCOME", amount: netIncome });

    // ✅ Stream buffer (no fs.writeFileSync)
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=financial-report.xlsx`,
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
