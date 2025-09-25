import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    // ✅ Fetch sales with customer and products via saleitem (correct relation name)
    const sales = await prisma.sale.findMany({
      include: {
        customer: true,
        saleitem: { include: { product: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // ✅ Fetch expenses
    const expenses = await prisma.expense.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Financial Report");

    // Add headers
    sheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Type", key: "type", width: 12 },
      { header: "Description", key: "description", width: 40 },
      { header: "Amount", key: "amount", width: 15 },
      { header: "Date", key: "date", width: 20 },
    ];

    // ✅ Populate sales rows (with multiple products per sale)
    sales.forEach((s) => {
      s.saleitem.forEach((item) => {
        sheet.addRow({
          id: `S-${s.id}`,
          type: "Sale",
          description: `${item.product?.name || "Product"} sold to ${
            s.customer?.name || "Unknown"
          }`,
          amount: s.amount, // total sale amount
          date: s.createdAt.toISOString(),
        });
      });
    });

    // ✅ Populate expenses rows
    expenses.forEach((e) => {
      sheet.addRow({
        id: `E-${e.id}`,
        type: "Expense",
        description: `${e.title} (${e.category || "General"}) - ${e.notes || ""}`,
        amount: -Math.abs(e.amount), // negative for expenses
        date: e.createdAt.toISOString(),
      });
    });

    // ✅ Add totals summary at the bottom
    const totalSales = sales.reduce((sum, s) => sum + Number(s.amount), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const netIncome = totalSales - totalExpenses;

    sheet.addRow({});
    sheet.addRow({ description: "TOTAL SALES", amount: totalSales });
    sheet.addRow({ description: "TOTAL EXPENSES", amount: -totalExpenses });
    sheet.addRow({ description: "NET INCOME", amount: netIncome });

    // Save to buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Save file to "reports" folder
    const reportsDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir);
    }
    const filename = `financial-report-${Date.now()}.xlsx`;
    const filePath = path.join(reportsDir, filename);
    fs.writeFileSync(filePath, Buffer.from(buffer));

    // Return as download
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=${filename}`,
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
