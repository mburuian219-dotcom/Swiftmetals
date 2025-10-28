import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import ExcelJS from "exceljs";

export async function GET() {
  try {
    console.log("Starting financial report generation...");
    
    // Fetch all required data including creditors, restocks, and opening balance
    const [sales, expenses, stock, customers, creditors, restocks, openingBalanceRecord] = await Promise.all([
      prisma.sale.findMany({
        include: {
          customer: true,
          saleitem: { 
            include: { 
              product: {
                select: {
                  id: true,
                  name: true,
                  productionCost: true,
                  price: true,
                }
              } 
            } 
          },
          payment: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.expense.findMany({
        orderBy: { createdAt: "asc" },
      }),
      prisma.stock.findMany({
        include: { 
          product: {
            select: {
              id: true,
              name: true,
              productionCost: true,
            }
          } 
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.customer.findMany(),
      prisma.creditor.findMany({
        include: {
          restocks: {
            include: {
              product: {
                select: {
                  name: true,
                }
              }
            },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      prisma.restock.findMany({
        include: {
          product: {
            select: {
              name: true,
            }
          },
          creditor: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      // Fetch the most recent opening balance
      prisma.openingbalance.findFirst({
        orderBy: { date: "desc" },
      }),
    ]);

    console.log(`Fetched: ${sales.length} sales, ${expenses.length} expenses, ${stock.length} stock items, ${creditors.length} creditors, ${restocks.length} restocks`);

    // Create workbook with multiple sheets
    const workbook = new ExcelJS.Workbook();
    
    // ========================================
    // CALCULATIONS
    // ========================================
    // Use opening balance from database, or default to 0 if not set
    const openingCash = openingBalanceRecord ? Number(openingBalanceRecord.amount) : 0;
    const openingBalanceDate = openingBalanceRecord ? new Date(openingBalanceRecord.date) : new Date(new Date().setMonth(new Date().getMonth() - 6));
    const openingBalanceDescription = openingBalanceRecord?.description || "Opening Balance - Business Capital";
    
    console.log(`Opening Balance: ${openingCash} (Date: ${openingBalanceDate.toLocaleDateString()})`);
    
    let cashBalance = openingCash;
    const cashTransactions: any[] = [];
    const debtorMap = new Map<number, any>();
    let totalSalesRevenue = 0;
    let totalCostOfGoodsSold = 0;
    let totalExpenses = 0;

    // Opening balance
    cashTransactions.push({
      date: openingBalanceDate,
      description: openingBalanceDescription,
      category: "Capital",
      accounts: "Cash (+) | Capital (+)",
      amount: openingCash,
      type: "INFLOW",
    });

    // Process Restocks (actual inventory purchases)
    restocks.forEach((restock) => {
      const totalCost = restock.totalCost;

      if (restock.paymentSource === "cash") {
        // Cash purchase - reduces cash immediately
        cashTransactions.push({
          date: new Date(restock.createdAt),
          description: `Purchased ${restock.quantity} units of ${restock.product?.name || "Product"} (Paid Cash)`,
          category: "Inventory Purchase",
          accounts: "Cash (-) | Inventory (+)",
          amount: totalCost,
          type: "OUTFLOW",
        });
      } else if (restock.paymentSource === "credit") {
        // Credit purchase - no cash movement initially
        // The creditor balance is already tracked in the creditor table
        cashTransactions.push({
          date: new Date(restock.createdAt),
          description: `Purchased ${restock.quantity} units of ${restock.product?.name || "Product"} on credit from ${restock.creditor?.name || "Supplier"}`,
          category: "Inventory Purchase (Credit)",
          accounts: "Inventory (+) | Accounts Payable (+)",
          amount: 0, // No cash movement
          type: "INFO",
        });
      }
    });

    // Process Sales
    sales.forEach((sale) => {
      const saleAmount = Number(sale.amount);
      totalSalesRevenue += saleAmount;

      // Calculate COGS for this sale
      let saleCOGS = 0;
      if (sale.saleitem && Array.isArray(sale.saleitem)) {
        sale.saleitem.forEach((item: any) => {
          const quantity = Number(item?.quantity || 0);
          // Get cost price from product's productionCost field
          let costPrice = Number(item?.product?.productionCost || 0);
          
          // If not available in product, try to find in stock by productId
          if (!costPrice && item?.productId) {
            const stockItem = stock.find(s => s.productId === item.productId);
            if (stockItem) {
              costPrice = Number(stockItem.costPrice || 0);
            }
          }
          
          // Log for debugging
          if (costPrice > 0) {
            console.log(`Product ${item?.product?.name}: quantity=${quantity}, costPrice=${costPrice}, COGS=${quantity * costPrice}`);
          } else {
            console.warn(`No cost price found for product ${item?.productId} (${item?.product?.name}) in sale ${sale.id}`);
          }
          
          saleCOGS += quantity * costPrice;
        });
      }
      totalCostOfGoodsSold += saleCOGS;
      
      console.log(`Sale #${sale.id}: Revenue=${saleAmount}, COGS=${saleCOGS}`);

      const itemsList = sale.saleitem?.map((item) => 
        `${item.product?.name || "Product"} (${item.quantity})`
      ).join(", ") || "Items";

      // Initialize debtor tracking
      if (!debtorMap.has(sale.customerId)) {
        debtorMap.set(sale.customerId, {
          name: sale.customer?.name || "Unknown Customer",
          totalSales: 0,
          paid: 0,
          sales: [],
        });
      }
      const debtor = debtorMap.get(sale.customerId);
      debtor.totalSales += saleAmount;

      if (sale.status === "PAID" || sale.status === "COMPLETED") {
        // Cash sale
        cashTransactions.push({
          date: new Date(sale.createdAt),
          description: `Cash sale to ${sale.customer?.name || "Customer"} - ${itemsList}`,
          category: "Sales Revenue",
          accounts: "Cash (+) | Inventory (-) | Revenue (+)",
          amount: saleAmount,
          type: "INFLOW",
        });
        debtor.paid += saleAmount;
      } else {
        // Credit sale - no immediate cash
        debtor.sales.push({
          id: sale.id,
          date: sale.createdAt,
          amount: saleAmount,
        });
      }

      // Process partial payments
      if (sale.payment && sale.payment.length > 0) {
        sale.payment.forEach((payment) => {
          const payAmount = Number(payment.amount);
          if (sale.status !== "PAID") {
            cashTransactions.push({
              date: new Date(payment.paidAt),
              description: `Payment from ${sale.customer?.name || "Customer"} for Sale #${sale.id} (${payment.method})`,
              category: "Debt Collection",
              accounts: "Cash (+) | Accounts Receivable (-)",
              amount: payAmount,
              type: "INFLOW",
            });
            debtor.paid += payAmount;
          }
        });
      }
    });

    // Process Expenses
    expenses.forEach((expense) => {
      const expAmount = Number(expense.amount);
      totalExpenses += expAmount;
      cashTransactions.push({
        date: new Date(expense.createdAt),
        description: `${expense.title} - ${expense.category || "General"}`,
        category: "Operating Expense",
        accounts: "Cash (-) | Expenses (+)",
        amount: expAmount,
        type: "OUTFLOW",
      });
    });

    // Note: Creditor payments would be recorded separately if you implement a payment feature
    // For now, we just show the outstanding balances

    // Sort transactions by date and calculate running balance
    cashTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    cashBalance = 0;
    cashTransactions.forEach((txn) => {
      if (txn.type === "INFLOW") {
        cashBalance += txn.amount;
      } else if (txn.type === "OUTFLOW") {
        cashBalance -= txn.amount;
      }
      // INFO type doesn't affect balance
      txn.runningBalance = cashBalance;
    });

    // Calculate financial metrics
    const grossProfit = totalSalesRevenue - totalCostOfGoodsSold;
    const netIncome = grossProfit - totalExpenses;
    
    // Total creditor balance from database
    const totalCreditorBalance = creditors.reduce((sum, c) => sum + Number(c.totalOwed || 0), 0);
    
    // Total debtor balance
    const totalDebtorBalance = Array.from(debtorMap.values()).reduce(
      (sum, d) => sum + (d.totalSales - d.paid), 
      0
    );
    
    // Total inventory value from current stock
    const totalInventoryValue = stock.reduce(
      (sum, item) => sum + (item.quantity * item.costPrice), 
      0
    );
    
    const capital = openingCash;
    const retainedEarnings = netIncome;
    
    const totalAssets = cashBalance + totalInventoryValue + totalDebtorBalance;
    const totalLiabilities = totalCreditorBalance;
    const totalEquity = capital + retainedEarnings;

    console.log("Financial Metrics:", {
      totalSalesRevenue,
      totalCostOfGoodsSold,
      grossProfit,
      totalExpenses,
      netIncome,
      cashBalance,
      totalInventoryValue,
      totalCreditorBalance,
      totalDebtorBalance,
      totalAssets,
      totalLiabilities,
      totalEquity
    });

    // ========================================
    // SHEET 1: CASH LEDGER
    // ========================================
    const cashSheet = workbook.addWorksheet("Cash Ledger");
    
    cashSheet.columns = [
      { header: "Date", key: "date", width: 15 },
      { header: "Description", key: "description", width: 50 },
      { header: "Category", key: "category", width: 25 },
      { header: "Accounts Affected", key: "accounts", width: 35 },
      { header: "Inflow", key: "inflow", width: 15 },
      { header: "Outflow", key: "outflow", width: 15 },
      { header: "Balance", key: "balance", width: 15 },
    ];

    // Style header
    cashSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    cashSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };

    cashTransactions.forEach((txn) => {
      const row = cashSheet.addRow({
        date: txn.date.toLocaleDateString(),
        description: txn.description,
        category: txn.category,
        accounts: txn.accounts,
        inflow: txn.type === "INFLOW" ? txn.amount : "",
        outflow: txn.type === "OUTFLOW" ? txn.amount : "",
        balance: txn.runningBalance,
      });

      // Format numbers
      if (txn.type === "INFLOW") {
        row.getCell("inflow").numFmt = "#,##0.00";
        row.getCell("inflow").font = { color: { argb: "FF008000" } };
      } else if (txn.type === "OUTFLOW") {
        row.getCell("outflow").numFmt = "#,##0.00";
        row.getCell("outflow").font = { color: { argb: "FFFF0000" } };
      }
      row.getCell("balance").numFmt = "#,##0.00";
      row.getCell("balance").font = { bold: true };
    });

    // ========================================
    // SHEET 2: INVENTORY
    // ========================================
    const inventorySheet = workbook.addWorksheet("Inventory");
    
    inventorySheet.columns = [
      { header: "Item ID", key: "id", width: 10 },
      { header: "Item Name", key: "name", width: 30 },
      { header: "Supplier", key: "supplier", width: 25 },
      { header: "Quantity", key: "quantity", width: 12 },
      { header: "Cost Price", key: "costPrice", width: 15 },
      { header: "Selling Price", key: "sellingPrice", width: 15 },
      { header: "Total Value", key: "totalValue", width: 15 },
      { header: "Markup %", key: "markup", width: 12 },
      { header: "Date Added", key: "dateAdded", width: 15 },
    ];

    inventorySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    inventorySheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };

    stock.forEach((item) => {
      const totalValue = item.quantity * item.costPrice;
      const markup = item.sellingPrice > 0 
        ? ((item.sellingPrice - item.costPrice) / item.costPrice * 100)
        : 0;

      const row = inventorySheet.addRow({
        id: item.id,
        name: item.name,
        supplier: item.supplier || "N/A",
        quantity: item.quantity,
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice,
        totalValue: totalValue,
        markup: markup.toFixed(1) + "%",
        dateAdded: new Date(item.createdAt).toLocaleDateString(),
      });

      row.getCell("costPrice").numFmt = "#,##0.00";
      row.getCell("sellingPrice").numFmt = "#,##0.00";
      row.getCell("totalValue").numFmt = "#,##0.00";
    });

    // Add total
    inventorySheet.addRow({});
    const invTotalRow = inventorySheet.addRow({
      name: "TOTAL INVENTORY VALUE",
      totalValue: totalInventoryValue,
    });
    invTotalRow.font = { bold: true };
    invTotalRow.getCell("totalValue").numFmt = "#,##0.00";
    invTotalRow.getCell("totalValue").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFF00" },
    };

    // ========================================
    // SHEET 3: CREDITORS (Accounts Payable)
    // ========================================
    const creditorsSheet = workbook.addWorksheet("Creditors");
    
    creditorsSheet.columns = [
      { header: "Creditor ID", key: "id", width: 12 },
      { header: "Name", key: "name", width: 30 },
      { header: "Phone", key: "phone", width: 20 },
      { header: "Email", key: "email", width: 30 },
      { header: "Total Owed", key: "totalOwed", width: 15 },
      { header: "# of Purchases", key: "purchases", width: 15 },
    ];

    creditorsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    creditorsSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFF0000" },
    };

    creditors.forEach((creditor) => {
      const row = creditorsSheet.addRow({
        id: creditor.id,
        name: creditor.name,
        phone: creditor.phone || "N/A",
        email: creditor.email || "N/A",
        totalOwed: creditor.totalOwed,
        purchases: creditor.restocks?.length || 0,
      });

      row.getCell("totalOwed").numFmt = "#,##0.00";
      if (creditor.totalOwed > 0) {
        row.getCell("totalOwed").font = { color: { argb: "FFFF0000" }, bold: true };
      }
    });

    // Add total
    creditorsSheet.addRow({});
    const credTotalRow = creditorsSheet.addRow({
      name: "TOTAL ACCOUNTS PAYABLE",
      totalOwed: totalCreditorBalance,
    });
    credTotalRow.font = { bold: true };
    credTotalRow.getCell("totalOwed").numFmt = "#,##0.00";
    credTotalRow.getCell("totalOwed").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFF0000" },
    };
    credTotalRow.getCell("totalOwed").font = { color: { argb: "FFFFFFFF" }, bold: true };

    // ========================================
    // SHEET 4: DEBTORS (Accounts Receivable)
    // ========================================
    const debtorsSheet = workbook.addWorksheet("Debtors");
    
    debtorsSheet.columns = [
      { header: "Customer Name", key: "name", width: 30 },
      { header: "Total Sales", key: "totalSales", width: 15 },
      { header: "Amount Paid", key: "paid", width: 15 },
      { header: "Balance Owed", key: "balance", width: 15 },
    ];

    debtorsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    debtorsSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF00B050" },
    };

    debtorMap.forEach((debtor) => {
      const balance = debtor.totalSales - debtor.paid;
      if (balance > 0) {
        const row = debtorsSheet.addRow({
          name: debtor.name,
          totalSales: debtor.totalSales,
          paid: debtor.paid,
          balance: balance,
        });

        row.getCell("totalSales").numFmt = "#,##0.00";
        row.getCell("paid").numFmt = "#,##0.00";
        row.getCell("balance").numFmt = "#,##0.00";
        row.getCell("balance").font = { color: { argb: "FF00B050" }, bold: true };
      }
    });

    // Add total
    debtorsSheet.addRow({});
    const debtTotalRow = debtorsSheet.addRow({
      name: "TOTAL ACCOUNTS RECEIVABLE",
      balance: totalDebtorBalance,
    });
    debtTotalRow.font = { bold: true };
    debtTotalRow.getCell("balance").numFmt = "#,##0.00";
    debtTotalRow.getCell("balance").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF00B050" },
    };
    debtTotalRow.getCell("balance").font = { color: { argb: "FFFFFFFF" }, bold: true };

    // ========================================
    // SHEET 5: BALANCE SHEET
    // ========================================
    const balanceSheet = workbook.addWorksheet("Balance Sheet");
    
    balanceSheet.columns = [
      { header: "Account", key: "account", width: 40 },
      { header: "Amount", key: "amount", width: 20 },
    ];

    balanceSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    balanceSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };

    // Add Balance Sheet Title
    balanceSheet.addRow({});
    const titleRow = balanceSheet.addRow({
      account: "BALANCE SHEET",
    });
    titleRow.font = { bold: true, size: 16 };
    balanceSheet.addRow({
      account: `As of ${new Date().toLocaleDateString()}`,
    });
    balanceSheet.addRow({});

    // ASSETS
    const assetsHeaderRow = balanceSheet.addRow({ account: "ASSETS" });
    assetsHeaderRow.font = { bold: true, size: 14 };
    assetsHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    assetsHeaderRow.getCell("account").font = { bold: true, color: { argb: "FFFFFFFF" } };

    balanceSheet.addRow({ account: "Current Assets" }).font = { bold: true };
    
    const cashRow = balanceSheet.addRow({ account: "  Cash", amount: cashBalance });
    cashRow.getCell("amount").numFmt = "#,##0.00";
    
    const arRow = balanceSheet.addRow({ account: "  Accounts Receivable (Debtors)", amount: totalDebtorBalance });
    arRow.getCell("amount").numFmt = "#,##0.00";
    
    const invRow = balanceSheet.addRow({ account: "  Inventory", amount: totalInventoryValue });
    invRow.getCell("amount").numFmt = "#,##0.00";
    
    const totalCARow = balanceSheet.addRow({
      account: "Total Current Assets",
      amount: totalAssets,
    });
    totalCARow.font = { bold: true };
    totalCARow.getCell("amount").numFmt = "#,##0.00";
    
    balanceSheet.addRow({});
    const totalAssetsRow = balanceSheet.addRow({
      account: "TOTAL ASSETS",
      amount: totalAssets,
    });
    totalAssetsRow.font = { bold: true, size: 12 };
    totalAssetsRow.getCell("amount").numFmt = "#,##0.00";
    totalAssetsRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFF00" },
    };

    balanceSheet.addRow({});
    balanceSheet.addRow({});

    // LIABILITIES
    const liabilitiesHeaderRow = balanceSheet.addRow({ account: "LIABILITIES" });
    liabilitiesHeaderRow.font = { bold: true, size: 14 };
    liabilitiesHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFF0000" },
    };
    liabilitiesHeaderRow.getCell("account").font = { bold: true, color: { argb: "FFFFFFFF" } };

    balanceSheet.addRow({ account: "Current Liabilities" }).font = { bold: true };
    
    const apRow = balanceSheet.addRow({
      account: "  Accounts Payable (Creditors)",
      amount: totalCreditorBalance,
    });
    apRow.getCell("amount").numFmt = "#,##0.00";
    
    const totalCLRow = balanceSheet.addRow({
      account: "Total Current Liabilities",
      amount: totalLiabilities,
    });
    totalCLRow.font = { bold: true };
    totalCLRow.getCell("amount").numFmt = "#,##0.00";
    
    balanceSheet.addRow({});
    const totalLiabRow = balanceSheet.addRow({
      account: "TOTAL LIABILITIES",
      amount: totalLiabilities,
    });
    totalLiabRow.font = { bold: true, size: 12 };
    totalLiabRow.getCell("amount").numFmt = "#,##0.00";
    totalLiabRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFF0000" },
    };
    totalLiabRow.getCell("account").font = { color: { argb: "FFFFFFFF" } };

    balanceSheet.addRow({});
    balanceSheet.addRow({});

    // EQUITY
    const equityHeaderRow = balanceSheet.addRow({ account: "EQUITY" });
    equityHeaderRow.font = { bold: true, size: 14 };
    equityHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF00B050" },
    };
    equityHeaderRow.getCell("account").font = { bold: true, color: { argb: "FFFFFFFF" } };

    const capitalRow = balanceSheet.addRow({
      account: "  Owner's Capital",
      amount: capital,
    });
    capitalRow.getCell("amount").numFmt = "#,##0.00";
    
    const reRow = balanceSheet.addRow({
      account: "  Retained Earnings (Net Income)",
      amount: retainedEarnings,
    });
    reRow.getCell("amount").numFmt = "#,##0.00";
    
    const totalEquityRow = balanceSheet.addRow({
      account: "TOTAL EQUITY",
      amount: totalEquity,
    });
    totalEquityRow.font = { bold: true, size: 12 };
    totalEquityRow.getCell("amount").numFmt = "#,##0.00";
    totalEquityRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF00B050" },
    };
    totalEquityRow.getCell("account").font = { color: { argb: "FFFFFFFF" } };

    balanceSheet.addRow({});
    const totalLERow = balanceSheet.addRow({
      account: "TOTAL LIABILITIES & EQUITY",
      amount: totalLiabilities + totalEquity,
    });
    totalLERow.font = { bold: true, size: 12 };
    totalLERow.getCell("amount").numFmt = "#,##0.00";
    totalLERow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFF00" },
    };

    // ========================================
    // SHEET 6: INCOME STATEMENT
    // ========================================
    const incomeSheet = workbook.addWorksheet("Income Statement");
    
    incomeSheet.columns = [
      { header: "Description", key: "description", width: 40 },
      { header: "Amount", key: "amount", width: 20 },
    ];

    incomeSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    incomeSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };

    incomeSheet.addRow({});
    const incTitleRow = incomeSheet.addRow({ description: "INCOME STATEMENT" });
    incTitleRow.font = { bold: true, size: 16 };
    incomeSheet.addRow({ description: `For period ending ${new Date().toLocaleDateString()}` });
    incomeSheet.addRow({});

    // Revenue
    const revenueRow = incomeSheet.addRow({
      description: "Sales Revenue",
      amount: totalSalesRevenue,
    });
    revenueRow.font = { bold: true };
    revenueRow.getCell("amount").numFmt = "#,##0.00";
    revenueRow.getCell("amount").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF92D050" },
    };

    incomeSheet.addRow({});

    // COGS
    const cogsRow = incomeSheet.addRow({
      description: "Cost of Goods Sold (COGS)",
      amount: -totalCostOfGoodsSold,
    });
    cogsRow.getCell("amount").numFmt = "#,##0.00";
    cogsRow.getCell("amount").font = { color: { argb: "FFFF0000" } };

    incomeSheet.addRow({});

    // Gross Profit
    const grossProfitRow = incomeSheet.addRow({
      description: "Gross Profit",
      amount: grossProfit,
    });
    grossProfitRow.font = { bold: true };
    grossProfitRow.getCell("amount").numFmt = "#,##0.00";
    grossProfitRow.getCell("amount").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF92D050" },
    };

    incomeSheet.addRow({});

    // Operating Expenses
    incomeSheet.addRow({ description: "Operating Expenses" }).font = { bold: true };
    const expRow = incomeSheet.addRow({
      description: "  Total Expenses",
      amount: -totalExpenses,
    });
    expRow.getCell("amount").numFmt = "#,##0.00";
    expRow.getCell("amount").font = { color: { argb: "FFFF0000" } };

    incomeSheet.addRow({});

    // Net Income
    const netIncomeRow = incomeSheet.addRow({
      description: "NET INCOME (PROFIT)",
      amount: netIncome,
    });
    netIncomeRow.font = { bold: true, size: 14 };
    netIncomeRow.getCell("amount").numFmt = "#,##0.00";
    netIncomeRow.getCell("amount").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: netIncome >= 0 ? "FF92D050" : "FFFF0000" },
    };
    netIncomeRow.getCell("amount").font = { bold: true, color: { argb: "FFFFFFFF" } };

    // Generate buffer and return
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