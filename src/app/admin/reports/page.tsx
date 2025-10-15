"use client";
import { useEffect, useState } from "react";
import { TrendingUp, Wallet, CreditCard, Users, Package, DollarSign, Download, BookOpen, Send, FileText, ArrowUpRight, ArrowDownRight, Search, X, Mail, Phone, Edit2, Check } from "lucide-react";

type CashTransaction = {
  id: string;
  date: string;
  description: string;
  type: "INFLOW" | "OUTFLOW";
  category: string;
  amount: number;
  runningBalance: number;
  relatedTo?: string;
  affectedAccounts?: string;
};

type Creditor = {
  id: string | number;
  name: string;
  totalOwed: number;
  paid: number;
  balance: number;
  purchases: Array<{ date: string; item: string; amount: number }>;
  payments: Array<{ date: string; amount: number; method: string }>;
};

type Debtor = {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalSales: number;
  paid: number;
  balance: number;
  sales: Array<{ id: number; date: string; items: string; amount: number }>;
  payments: Array<{ date: string; amount: number; method: string }>;
};

type InventoryItem = {
  id: number;
  name: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  totalValue: number;
  supplier?: string;
  dateAdded: string;
};

type BalanceSheet = {
  assets: {
    currentAssets: {
      cash: number;
      accountsReceivable: number;
      inventory: number;
      total: number;
    };
    totalAssets: number;
  };
  liabilities: {
    currentLiabilities: {
      accountsPayable: number;
      total: number;
    };
    totalLiabilities: number;
  };
  equity: {
    capital: number;
    retainedEarnings: number;
    totalEquity: number;
  };
  date: string;
};

export default function AccountingSystem() {
  const [activeTab, setActiveTab] = useState<"overview" | "cash" | "creditors" | "debtors" | "inventory" | "balance-sheet">("overview");
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [openingCash, setOpeningCash] = useState(50000);
  const [isEditingOpeningCash, setIsEditingOpeningCash] = useState(false);
  const [tempOpeningCash, setTempOpeningCash] = useState(50000);
  const [rawData, setRawData] = useState<any>(null);
  const [showAddCreditor, setShowAddCreditor] = useState(false);
  const [newCreditor, setNewCreditor] = useState({ name: "", balance: 0 });

  const [stats, setStats] = useState({
    cashBalance: 0,
    totalCreditors: 0,
    totalDebtors: 0,
    inventoryValue: 0,
    salesRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    costOfGoodsSold: 0,
    grossProfit: 0,
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (rawData) {
      const salesData = rawData.sales || [];
      const expensesData = rawData.expenses || [];
      const stockData = rawData.stock || [];
      const customersData = rawData.customers || [];
      const creditorsData = rawData.creditors || [];
      
      processAccountingData(salesData, expensesData, stockData, customersData, creditorsData);
    }
  }, [rawData, openingCash]);

 const fetchAllData = async () => {
  try {
    setLoading(true);

    // ✅ Helper function to safely fetch and parse JSON
    const safeFetch = async (url: string) => {
      try {
        const res = await fetch(url);

        if (!res.ok) {
          console.error(`Failed to fetch ${url} - Status: ${res.status}`);
          return []; // return empty array on error
        }

        const data = await res.json();
        return data;
      } catch (err) {
        console.error(`Network error fetching ${url}:`, err);
        return []; // return empty array if fetch fails
      }
    };

    // ✅ Fetch all endpoints concurrently
    const [sales, expenses, stock, customers, creditors] = await Promise.all([
      safeFetch("/api/sales"),
      safeFetch("/api/expenses"),
      safeFetch("/api/stock"),
      safeFetch("/api/customer"),
      safeFetch("/api/creditors"),
    ]);

    // ✅ Handle flexible response formats (array or { data: [] })
    const salesData = Array.isArray(sales) ? sales : sales?.data || [];
    const expensesData = Array.isArray(expenses) ? expenses : expenses?.data || [];
    const stockData = Array.isArray(stock) ? stock : stock?.data || [];
    const customersData = Array.isArray(customers) ? customers : customers?.data || [];
    const creditorsData = Array.isArray(creditors) ? creditors : creditors?.data || [];

    // ✅ Log and set state
    console.log("API Data loaded successfully", {
      sales: salesData.length,
      expenses: expensesData.length,
      stock: stockData.length,
      customers: customersData.length,
      creditors: creditorsData.length,
    });

    setRawData({
      sales: salesData,
      expenses: expensesData,
      stock: stockData,
      customers: customersData,
      creditors: creditorsData,
    });
  } catch (err) {
    console.error("Failed to fetch data from API:", err);
    alert(`Error loading financial data: ${err instanceof Error ? err.message : "Unknown error"}`);
  } finally {
    setLoading(false);
  }
};


  const processAccountingData = (sales: any, expenses: any, stock: any, customers: any, creditorsApiData: any) => {
    const salesArray = Array.isArray(sales) ? sales : [];
    const expensesArray = Array.isArray(expenses) ? expenses : [];
    const stockArray = Array.isArray(stock) ? stock : [];
    const customersArray = Array.isArray(customers) ? customers : [];
    const creditorsArray = Array.isArray(creditorsApiData) ? creditorsApiData : [];

    let cashBalance = openingCash;
    const cashTxns: CashTransaction[] = [];
    const creditorMap: Map<string, Creditor> = new Map();
    const debtorMap: Map<number, Debtor> = new Map();
    let totalSalesRevenue = 0;
    let totalExpenses = 0;
    let totalInventoryValue = 0;
    let totalCostOfGoodsSold = 0;

    // Opening balance
    cashTxns.push({
      id: "OPENING-BALANCE",
      date: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString(),
      description: "Opening Balance - Business Capital",
      type: "INFLOW",
      category: "Capital",
      amount: openingCash,
      runningBalance: openingCash,
      affectedAccounts: "Cash (+) | Capital (+)",
    });

    // Process creditors from API
    creditorsArray.forEach((creditor: any) => {
      const creditorId = String(creditor?.id || creditor?.name || Math.random());
      const totalOwed = Number(creditor?.totalOwed || 0);
      const paid = Number(creditor?.paid || 0);
      const balance = totalOwed - paid;

      let purchases = [];
      if (creditor?.purchases && Array.isArray(creditor.purchases)) {
        purchases = creditor.purchases.map((p: any) => ({
          date: p?.date || new Date().toISOString(),
          item: p?.item || "Purchase",
          amount: Number(p?.amount || 0),
        }));
      }

      let payments = [];
      if (creditor?.payments && Array.isArray(creditor.payments)) {
        payments = creditor.payments.map((p: any) => ({
          date: p?.date || new Date().toISOString(),
          amount: Number(p?.amount || 0),
          method: p?.method || "Payment",
        }));
      }

      creditorMap.set(creditorId, {
        id: creditorId,
        name: creditor?.name || "Supplier",
        totalOwed,
        paid,
        balance,
        purchases,
        payments,
      });

      if (paid > 0) {
        cashBalance -= paid;
        cashTxns.push({
          id: `CREDPAY-${creditorId}`,
          date: creditor?.lastPaymentDate || new Date().toISOString(),
          description: `Payment to ${creditor?.name || "Supplier"}`,
          type: "OUTFLOW",
          category: "Creditor Payment",
          amount: paid,
          runningBalance: cashBalance,
          relatedTo: creditor?.name || "Supplier",
          affectedAccounts: "Cash (-) | Accounts Payable (-)",
        });
      }
    });

    // Process inventory purchases
    stockArray.forEach((item: any) => {
      const quantity = Number(item?.quantity || 0);
      const costPrice = Number(item?.costPrice || 0);
      const totalCost = quantity * costPrice;
      
      cashBalance -= totalCost;
      cashTxns.push({
        id: `STOCK-${item?.id}`,
        date: item?.createdAt || new Date().toISOString(),
        description: `Stock purchase: ${item?.name || "Item"}`,
        type: "OUTFLOW",
        category: "Inventory Purchase",
        amount: totalCost,
        runningBalance: cashBalance,
        relatedTo: `Stock #${item?.id}`,
        affectedAccounts: "Cash (-) | Inventory (+)",
      });
    });

    // Process sales
    salesArray.forEach((sale: any) => {
      const saleAmount = Number(sale?.amount || 0);
      totalSalesRevenue += saleAmount;

      let saleCOGS = 0;
      if (sale?.saleitem && Array.isArray(sale.saleitem)) {
        sale.saleitem.forEach((item: any) => {
          const quantity = Number(item?.quantity || 0);
          const costPrice = Number(item?.product?.costPrice || 0);
          saleCOGS += quantity * costPrice;
        });
      }
      totalCostOfGoodsSold += saleCOGS;

      const itemsList = sale?.saleitem?.map((item: any) => 
        `${item?.product?.name || "Product"} (${item?.quantity || 0})`
      ).join(", ") || "Items";

      const customerId = Number(sale?.customerId || 0);
      if (!debtorMap.has(customerId)) {
        const customer = customersArray.find(c => c?.id === customerId) || {
          id: customerId,
          name: sale?.customer?.name || "Customer",
          email: sale?.customer?.email || "",
          phone: sale?.customer?.phone || "",
        };

        debtorMap.set(customerId, {
          id: String(customerId),
          name: customer?.name || "Unknown",
          email: customer?.email || "",
          phone: customer?.phone || "",
          totalSales: 0,
          paid: 0,
          balance: 0,
          sales: [],
          payments: [],
        });
      }

      const debtor = debtorMap.get(customerId)!;
      debtor.totalSales += saleAmount;
      debtor.sales.push({
        id: sale?.id || 0,
        date: sale?.createdAt || new Date().toISOString(),
        items: itemsList,
        amount: saleAmount,
      });

      if (sale?.status === "PAID" || sale?.status === "COMPLETED") {
        cashBalance += saleAmount;
        debtor.paid += saleAmount;

        cashTxns.push({
          id: `SALE-${sale?.id}`,
          date: sale?.createdAt || new Date().toISOString(),
          description: `Cash sale to ${sale?.customer?.name || "Customer"}`,
          type: "INFLOW",
          category: "Sales Revenue",
          amount: saleAmount,
          runningBalance: cashBalance,
          relatedTo: `Sale #${sale?.id}`,
          affectedAccounts: "Cash (+) | Revenue (+)",
        });
      } else {
        debtor.balance += saleAmount;
      }

      if (sale?.payment && Array.isArray(sale.payment)) {
        sale.payment.forEach((payment: any) => {
          const payAmount = Number(payment?.amount || 0);
          
          if (sale?.status !== "PAID") {
            cashBalance += payAmount;
            debtor.paid += payAmount;
            debtor.balance -= payAmount;

            cashTxns.push({
              id: `PMT-${payment?.id}`,
              date: payment?.paidAt || new Date().toISOString(),
              description: `Payment from ${sale?.customer?.name || "Customer"}`,
              type: "INFLOW",
              category: "Debt Collection",
              amount: payAmount,
              runningBalance: cashBalance,
              relatedTo: `Sale #${sale?.id}`,
              affectedAccounts: "Cash (+) | Accounts Receivable (-)",
            });
          }

          debtor.payments.push({
            date: payment?.paidAt || new Date().toISOString(),
            amount: payAmount,
            method: payment?.method || "Payment",
          });
        });
      }
    });

    // Process expenses
    expensesArray.forEach((expense: any) => {
      const expAmount = Number(expense?.amount || 0);
      totalExpenses += expAmount;
      cashBalance -= expAmount;

      cashTxns.push({
        id: `EXP-${expense?.id}`,
        date: expense?.createdAt || new Date().toISOString(),
        description: `${expense?.title || "Expense"} - ${expense?.category || "General"}`,
        type: "OUTFLOW",
        category: "Operating Expense",
        amount: expAmount,
        runningBalance: cashBalance,
        relatedTo: `Expense #${expense?.id}`,
        affectedAccounts: "Cash (-) | Expenses (+)",
      });
    });

    // Sort transactions by date
    cashTxns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Recalculate running balance
    let runningBal = 0;
    cashTxns.forEach(txn => {
      if (txn.type === "INFLOW") {
        runningBal += txn.amount;
      } else {
        runningBal -= txn.amount;
      }
      txn.runningBalance = runningBal;
    });

    // Process inventory
    const invItems: InventoryItem[] = stockArray.map((item: any) => ({
      id: item?.id || 0,
      name: item?.name || "Item",
      quantity: Number(item?.quantity || 0),
      costPrice: Number(item?.costPrice || 0),
      sellingPrice: Number(item?.sellingPrice || 0),
      totalValue: Number(item?.quantity || 0) * Number(item?.costPrice || 0),
      supplier: item?.supplier || "",
      dateAdded: item?.createdAt || new Date().toISOString(),
    }));

    totalInventoryValue = invItems.reduce((sum, item) => sum + (item.totalValue || 0), 0);
    const totalCreditorBalance = Array.from(creditorMap.values()).reduce((sum, c) => sum + (c.balance || 0), 0);
    const totalDebtorBalance = Array.from(debtorMap.values()).reduce((sum, d) => sum + (d.balance || 0), 0);

    // Balance sheet calculations
    const totalAssets = runningBal + totalInventoryValue + totalDebtorBalance;
    const totalLiabilities = totalCreditorBalance;
    const capital = openingCash;
    const grossProfit = totalSalesRevenue - totalCostOfGoodsSold;
    const netIncome = grossProfit - totalExpenses;
    const retainedEarnings = netIncome;
    const totalEquity = capital + retainedEarnings;

    const balanceSheetData: BalanceSheet = {
      assets: {
        currentAssets: {
          cash: runningBal,
          accountsReceivable: totalDebtorBalance,
          inventory: totalInventoryValue,
          total: runningBal + totalDebtorBalance + totalInventoryValue,
        },
        totalAssets,
      },
      liabilities: {
        currentLiabilities: {
          accountsPayable: totalCreditorBalance,
          total: totalCreditorBalance,
        },
        totalLiabilities,
      },
      equity: {
        capital,
        retainedEarnings,
        totalEquity,
      },
      date: new Date().toISOString(),
    };

    setCashTransactions(cashTxns);
    setCreditors(Array.from(creditorMap.values()));
    setDebtors(Array.from(debtorMap.values()));
    setInventory(invItems);
    setBalanceSheet(balanceSheetData);
    setStats({
      cashBalance: runningBal,
      totalCreditors: totalCreditorBalance,
      totalDebtors: totalDebtorBalance,
      inventoryValue: totalInventoryValue,
      salesRevenue: totalSalesRevenue,
      totalExpenses,
      netIncome,
      costOfGoodsSold: totalCostOfGoodsSold,
      grossProfit,
    });
  };

  const handleAddCreditor = () => {
    if (!newCreditor.name.trim()) return alert("Enter a creditor name");

    const newEntry: Creditor = {
      id: Date.now(),
      name: newCreditor.name,
      balance: newCreditor.balance,
      totalOwed: newCreditor.balance,
      paid: 0,
      purchases: [],
      payments: [],
    };

    setCreditors((prev) => [...prev, newEntry]);
    setShowAddCreditor(false);
    setNewCreditor({ name: "", balance: 0 });
  };

  const handleDeleteCreditor = (id: string | number) => {
    if (confirm("Are you sure you want to delete this creditor?")) {
      setCreditors((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const handleSaveOpeningCash = () => {
    const newAmount = Number(tempOpeningCash);
    if (isNaN(newAmount) || newAmount < 0) {
      alert("Please enter a valid positive number");
      return;
    }
    setOpeningCash(newAmount);
    setIsEditingOpeningCash(false);
  };

  const generateReceipt = (debtor: Debtor, sale: any) => {
    const receiptWindow = window.open("", "_blank");
    if (receiptWindow) {
      receiptWindow.document.write(`
        <html>
          <head>
            <title>Receipt - Sale #${sale.id}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
              .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
              .info { margin: 20px 0; }
              .total { font-size: 24px; font-weight: bold; margin-top: 20px; text-align: right; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>OFFICIAL RECEIPT</h1>
              <p>Sale #${sale.id}</p>
              <p>Date: ${new Date(sale.date).toLocaleDateString()}</p>
            </div>
            <div class="info">
              <p><strong>Customer:</strong> ${debtor.name}</p>
              <p><strong>Email:</strong> ${debtor.email}</p>
              <p><strong>Phone:</strong> ${debtor.phone}</p>
            </div>
            <div class="info">
              <p><strong>Items Purchased:</strong> ${sale.items}</p>
            </div>
            <div class="total">
              Total Amount: KES ${Number(sale.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p style="text-align: center; margin-top: 40px; color: #666;">Thank you for your business!</p>
          </body>
        </html>
      `);
      receiptWindow.document.close();
      receiptWindow.print();
    }
  };

  const downloadCashLedger = () => {
    const csvContent = [
      ["Date", "Description", "Category", "Type", "Amount", "Balance", "Accounts Affected"],
      ...cashTransactions.map(txn => [
        new Date(txn.date).toLocaleDateString(),
        txn.description,
        txn.category,
        txn.type,
        Number(txn.amount || 0).toFixed(2),
        Number(txn.runningBalance || 0).toFixed(2),
        txn.affectedAccounts || ""
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash-ledger-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadInventoryReport = () => {
    const csvContent = [
      ["Item Name", "Supplier", "Quantity", "Cost Price", "Selling Price", "Total Value", "Markup %", "Date Added"],
      ...inventory.map(item => {
        const markup = Number(item.sellingPrice || 0) > 0 
          ? ((Number(item.sellingPrice || 0) - Number(item.costPrice || 0)) / Number(item.costPrice || 0) * 100).toFixed(1)
          : "0.0";
        return [
          item.name || "Unknown",
          item.supplier || "N/A",
          item.quantity || 0,
          Number(item.costPrice || 0).toFixed(2),
          Number(item.sellingPrice || 0).toFixed(2),
          Number(item.totalValue || 0).toFixed(2),
          markup,
          new Date(item.dateAdded).toLocaleDateString()
        ];
      })
    ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadBalanceSheet = () => {
    if (!balanceSheet) return;

    const csvContent = [
      ["BALANCE SHEET"],
      [`As of ${new Date(balanceSheet.date).toLocaleDateString()}`],
      [""],
      ["ASSETS"],
      ["Current Assets"],
      ["  Cash", balanceSheet.assets.currentAssets.cash.toFixed(2)],
      ["  Accounts Receivable", balanceSheet.assets.currentAssets.accountsReceivable.toFixed(2)],
      ["  Inventory", balanceSheet.assets.currentAssets.inventory.toFixed(2)],
      ["Total Current Assets", balanceSheet.assets.currentAssets.total.toFixed(2)],
      [""],
      ["TOTAL ASSETS", balanceSheet.assets.totalAssets.toFixed(2)],
      [""],
      ["LIABILITIES"],
      ["Current Liabilities"],
      ["  Accounts Payable", balanceSheet.liabilities.currentLiabilities.accountsPayable.toFixed(2)],
      ["Total Current Liabilities", balanceSheet.liabilities.currentLiabilities.total.toFixed(2)],
      [""],
      ["TOTAL LIABILITIES", balanceSheet.liabilities.totalLiabilities.toFixed(2)],
      [""],
      ["EQUITY"],
      ["  Capital", balanceSheet.equity.capital.toFixed(2)],
      ["  Retained Earnings", balanceSheet.equity.retainedEarnings.toFixed(2)],
      ["TOTAL EQUITY", balanceSheet.equity.totalEquity.toFixed(2)],
      [""],
      ["TOTAL LIABILITIES & EQUITY", (balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity).toFixed(2)],
    ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `balance-sheet-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredCashTxns = cashTransactions.filter(txn =>
    txn.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    txn.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCreditors = creditors.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDebtors = debtors.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredInventory = inventory.filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.supplier?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-base sm:text-lg font-medium text-gray-600">Loading financial data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Financial Management System</h1>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600">Complete cash flow tracking, creditor/debtor management & inventory control</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6 sm:mb-8 border-2 border-blue-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1">Opening Cash Balance</h3>
              <p className="text-xs sm:text-sm text-gray-600">Initial capital to start your business</p>
            </div>
            {!isEditingOpeningCash ? (
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="text-right flex-1 sm:flex-initial">
                  <p className="text-xl sm:text-2xl font-bold text-blue-600 break-all">
                    KES {Number(openingCash || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setTempOpeningCash(openingCash);
                    setIsEditingOpeningCash(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-lg transition-all flex items-center gap-2 text-sm whitespace-nowrap"
                >
                  <Edit2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="number"
                  value={tempOpeningCash}
                  onChange={(e) => setTempOpeningCash(Number(e.target.value))}
                  className="border-2 border-blue-500 rounded-lg px-3 py-2 w-full sm:w-48 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Enter amount"
                  min="0"
                />
                <button
                  onClick={handleSaveOpeningCash}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-lg transition-all flex items-center gap-2 text-sm whitespace-nowrap"
                >
                  <Check className="w-4 h-4" />
                  <span className="hidden sm:inline">Save</span>
                </button>
                <button
                  onClick={() => setIsEditingOpeningCash(false)}
                  className="bg-gray-400 hover:bg-gray-500 text-white font-semibold py-2 px-3 sm:px-4 rounded-lg transition-all flex items-center gap-2 text-sm whitespace-nowrap"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Cancel</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-gray-600">Creditors (Payable)</span>
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-all">
              KES {Number(stats.totalCreditors || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">{creditors.length} suppliers</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-amber-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-gray-600">Debtors (Receivable)</span>
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-all">
              KES {Number(stats.totalDebtors || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">{debtors.length} customers</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-gray-600">Inventory Value</span>
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-all">
              KES {Number(stats.inventoryValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">{inventory.length} items</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex gap-2 sm:gap-4 p-4 overflow-x-auto">
              {[
                { id: "overview", label: "Overview", icon: TrendingUp },
                { id: "cash", label: "Cash Ledger", icon: Wallet },
                { id: "creditors", label: "Creditors", icon: CreditCard },
                { id: "debtors", label: "Debtors", icon: Users },
                { id: "inventory", label: "Inventory", icon: Package },
                { id: "balance-sheet", label: "Balance Sheet", icon: BookOpen },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap text-sm ${
                      activeTab === tab.id
                        ? "bg-blue-600 text-white shadow-lg"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {activeTab !== "overview" && activeTab !== "balance-sheet" && (
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="p-4 sm:p-6">
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 sm:p-6 border border-green-200">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Income Statement</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm sm:text-base">
                        <span className="text-gray-700">Sales Revenue</span>
                        <span className="font-bold text-green-600 break-all">
                          KES {Number(stats.salesRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm sm:text-base">
                        <span className="text-gray-700">Cost of Goods Sold (COGS)</span>
                        <span className="font-bold text-orange-600 break-all">
                          -KES {Number(stats.costOfGoodsSold || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="h-px bg-gray-300"></div>
                      <div className="flex justify-between text-sm sm:text-base">
                        <span className="text-gray-700 font-semibold">Gross Profit</span>
                        <span className="font-bold text-blue-600 break-all">
                          KES {Number(stats.grossProfit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm sm:text-base">
                        <span className="text-gray-700">Operating Expenses</span>
                        <span className="font-bold text-red-600 break-all">
                          -KES {Number(stats.totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="h-px bg-gray-300"></div>
                      <div className="flex justify-between items-center">
                        <span className="text-base sm:text-lg font-bold text-gray-800">Net Income (Profit)</span>
                        <span className={`text-xl sm:text-2xl font-bold break-all ${Number(stats.netIncome || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          KES {Number(stats.netIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 border border-blue-200">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Balance Sheet Summary</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Assets</p>
                        <div className="space-y-1 text-xs sm:text-sm">
                          <div className="flex justify-between">
                            <span>Cash</span>
                            <span className="font-semibold break-all">KES {Number(stats.cashBalance || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Inventory</span>
                            <span className="font-semibold break-all">KES {Number(stats.inventoryValue || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Receivables</span>
                            <span className="font-semibold break-all">KES {Number(stats.totalDebtors || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="h-px bg-gray-300"></div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-800 text-sm sm:text-base">Total Assets</span>
                        <span className="text-lg sm:text-xl font-bold text-blue-600 break-all">
                          KES {(Number(stats.cashBalance || 0) + Number(stats.inventoryValue || 0) + Number(stats.totalDebtors || 0)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab("balance-sheet")}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-lg transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl text-sm sm:text-base"
                >
                  <BookOpen className="w-5 h-5" />
                  View Complete Balance Sheet
                </button>
              </div>
            )}

            {activeTab === "cash" && (
              <div>
                <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800">Cash Ledger - All Transactions</h3>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                    <div className="text-left sm:text-right">
                      <p className="text-xs sm:text-sm text-gray-600">Current Balance</p>
                      <p className="text-xl sm:text-2xl font-bold text-green-600 break-all">
                        KES {Number(stats.cashBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <button
                      onClick={downloadCashLedger}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-lg transition-all flex items-center gap-2 text-sm whitespace-nowrap"
                    >
                      <Download className="w-4 h-4" />
                      Download CSV
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full">
                      <thead className="bg-gray-50 border-b-2 border-gray-200">
                        <tr>
                          <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-gray-700 whitespace-nowrap">Date</th>
                          <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-gray-700">Description</th>
                          <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-gray-700 hidden md:table-cell">Category</th>
                          <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-gray-700 hidden lg:table-cell">Accounts Affected</th>
                          <th className="text-right p-2 sm:p-3 text-xs sm:text-sm font-semibold text-gray-700">Amount</th>
                          <th className="text-right p-2 sm:p-3 text-xs sm:text-sm font-semibold text-gray-700 hidden sm:table-cell">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCashTxns.map((txn, idx) => (
                          <tr key={txn.id} className={`border-b hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                            <td className="p-2 sm:p-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                              {new Date(txn.date).toLocaleDateString()}
                            </td>
                            <td className="p-2 sm:p-3 text-xs sm:text-sm text-gray-800 max-w-xs break-words">{txn.description}</td>
                            <td className="p-2 sm:p-3 text-xs sm:text-sm hidden md:table-cell">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                txn.type === "INFLOW" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                              }`}>
                                {txn.category}
                              </span>
                            </td>
                            <td className="p-2 sm:p-3 text-xs text-gray-600 hidden lg:table-cell max-w-xs break-words">
                              {txn.affectedAccounts || "N/A"}
                            </td>
                            <td className="p-2 sm:p-3 text-xs sm:text-sm text-right font-semibold">
                              {txn.amount > 0 ? (
                                <span className="flex items-center justify-end gap-1">
                                  {txn.type === "INFLOW" ? (
                                    <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                                  ) : (
                                    <ArrowDownRight className="w-3 h-3 sm:w-4 sm:h-4 text-red-600 flex-shrink-0" />
                                  )}
                                  <span className={`${txn.type === "INFLOW" ? "text-green-600" : "text-red-600"} break-all`}>
                                    {Number(txn.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">No cash</span>
                              )}
                            </td>
                            <td className="p-2 sm:p-3 text-xs sm:text-sm text-right font-bold text-gray-900 hidden sm:table-cell break-all">
                              {Number(txn.runningBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "creditors" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-0">
                    Accounts Payable - Suppliers / Creditors
                  </h3>
                  <button
                    onClick={() => setShowAddCreditor(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                  >
                    + Add Creditor
                  </button>
                </div>

                {showAddCreditor && (
                  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
                      <h4 className="text-lg font-semibold text-gray-800 mb-4">Add New Creditor</h4>
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Creditor Name"
                          value={newCreditor.name}
                          onChange={(e) => setNewCreditor({ ...newCreditor, name: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Initial Balance (KES)"
                          value={newCreditor.balance}
                          onChange={(e) => setNewCreditor({ ...newCreditor, balance: parseFloat(e.target.value) || 0 })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="flex justify-end mt-5 space-x-3">
                        <button
                          onClick={() => setShowAddCreditor(false)}
                          className="px-4 py-2 text-gray-600 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddCreditor}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {filteredCreditors.map((creditor) => (
                  <div
                    key={creditor.id}
                    className="bg-gray-50 rounded-lg p-4 sm:p-6 border border-gray-200 relative"
                  >
                    <button
                      onClick={() => handleDeleteCreditor(creditor.id)}
                      className="absolute top-4 right-4 text-red-500 hover:text-red-700"
                      title="Delete Creditor"
                    >
                      ✕
                    </button>

                    <div className="flex flex-col sm:flex-row items-start justify-between mb-4 gap-3">
                      <div>
                        <h4 className="text-base sm:text-lg font-bold text-gray-900">
                          {creditor.name}
                        </h4>
                        <p className="text-xs sm:text-sm text-gray-600">
                          Supplier ID: {creditor.id}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-xs sm:text-sm text-gray-600">Balance Owed</p>
                        <p className="text-xl sm:text-2xl font-bold text-red-600 break-all">
                          KES {Number(creditor.balance || 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div className="bg-white rounded-lg p-3 sm:p-4">
                        <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Purchased</p>
                        <p className="text-base sm:text-lg font-bold text-gray-900 break-all">
                          KES {Number(creditor.totalOwed || 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3 sm:p-4">
                        <p className="text-xs sm:text-sm text-gray-600 mb-1">Paid</p>
                        <p className="text-base sm:text-lg font-bold text-green-600 break-all">
                          KES {Number(creditor.paid || 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </div>

                    {creditor.purchases.length > 0 && (
                      <div className="mb-4">
                        <h5 className="font-semibold text-gray-800 mb-2 text-sm sm:text-base">
                          Purchase History
                        </h5>
                        <div className="space-y-2">
                          {creditor.purchases.map((purchase, idx) => (
                            <div
                              key={idx}
                              className="bg-white rounded p-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs sm:text-sm"
                            >
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{purchase.item}</p>
                                <p className="text-gray-500 text-xs">
                                  {new Date(purchase.date).toLocaleDateString()}
                                </p>
                              </div>
                              <p className="font-bold text-gray-900 break-all">
                                KES {Number(purchase.amount || 0).toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {creditor.payments.length > 0 && (
                      <div>
                        <h5 className="font-semibold text-gray-800 mb-2 text-sm sm:text-base">
                          Payment History
                        </h5>
                        <div className="space-y-2">
                          {creditor.payments.map((payment, idx) => (
                            <div
                              key={idx}
                              className="bg-white rounded p-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs sm:text-sm"
                            >
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{payment.method}</p>
                                <p className="text-gray-500 text-xs">
                                  {new Date(payment.date).toLocaleDateString()}
                                </p>
                              </div>
                              <p className="font-bold text-green-600 break-all">
                                -KES {Number(payment.amount || 0).toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {filteredCreditors.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <CreditCard className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-sm sm:text-base">No creditors found</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "debtors" && (
              <div className="space-y-4">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Accounts Receivable - Customers/Debtors</h3>
                {filteredDebtors.map((debtor) => (
                  <div key={debtor.id} className="bg-gray-50 rounded-lg p-4 sm:p-6 border border-gray-200">
                    <div className="flex flex-col sm:flex-row items-start justify-between mb-4 gap-3">
                      <div className="flex-1">
                        <h4 className="text-base sm:text-lg font-bold text-gray-900">{debtor.name}</h4>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1 text-xs sm:text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                            <span className="break-all">{debtor.email || "No email"}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                            {debtor.phone || "No phone"}
                          </span>
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-xs sm:text-sm text-gray-600">Outstanding Balance</p>
                        <p className="text-xl sm:text-2xl font-bold text-amber-600 break-all">
                          KES {Number(debtor.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div className="bg-white rounded-lg p-3 sm:p-4">
                        <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Sales</p>
                        <p className="text-base sm:text-lg font-bold text-gray-900 break-all">
                          KES {Number(debtor.totalSales || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3 sm:p-4">
                        <p className="text-xs sm:text-sm text-gray-600 mb-1">Paid</p>
                        <p className="text-base sm:text-lg font-bold text-green-600 break-all">
                          KES {Number(debtor.paid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h5 className="font-semibold text-gray-800 mb-2 text-sm sm:text-base">Sales History</h5>
                      <div className="space-y-2">
                        {debtor.sales.map((sale) => (
                          <div key={sale.id} className="bg-white rounded p-3">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3 mb-2">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900 text-sm sm:text-base">Sale #{sale.id}</p>
                                <p className="text-xs sm:text-sm text-gray-600 break-words">{sale.items}</p>
                                <p className="text-gray-500 text-xs">{new Date(sale.date).toLocaleDateString()}</p>
                              </div>
                              <div className="text-left sm:text-right">
                                <p className="font-bold text-gray-900 text-sm sm:text-base break-all">
                                  KES {Number(sale.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </p>
                                <button
                                  onClick={() => generateReceipt(debtor, sale)}
                                  className="mt-1 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3" />
                                  Receipt
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {debtor.payments.length > 0 && (
                      <div className="mb-4">
                        <h5 className="font-semibold text-gray-800 mb-2 text-sm sm:text-base">Payment History</h5>
                        <div className="space-y-2">
                          {debtor.payments.map((payment, idx) => (
                            <div key={idx} className="bg-white rounded p-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs sm:text-sm">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{payment.method}</p>
                                <p className="text-gray-500 text-xs">{new Date(payment.date).toLocaleDateString()}</p>
                              </div>
                              <p className="font-bold text-green-600 break-all">
                                KES {Number(payment.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {debtor.balance > 0 && (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => alert(`Payment request would be sent to ${debtor.name} (${debtor.phone})`)}
                          className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-2 sm:py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
                        >
                          <Send className="w-4 h-4" />
                          Send Payment Request
                        </button>
                        <button
                          onClick={() => {
                            const message = `Dear ${debtor.name}, your outstanding balance is KES ${Number(debtor.balance || 0).toLocaleString()}. Please clear your dues. Thank you.`;
                            alert(`SMS would be sent to ${debtor.phone}:\n\n${message}`);
                          }}
                          className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold py-2 sm:py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
                        >
                          <Mail className="w-4 h-4" />
                          Send Reminder SMS
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {filteredDebtors.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-sm sm:text-base">No debtors found</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "inventory" && (
              <div>
                <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800">Inventory/Stock Management</h3>
                  <button
                    onClick={downloadInventoryReport}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-lg transition-all flex items-center gap-2 text-sm whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    Download CSV
                  </button>
                </div>
                <div className="mb-4 bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Total Inventory Value</p>
                      <p className="text-xl sm:text-2xl font-bold text-blue-600 break-all">
                        KES {Number(stats.inventoryValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs sm:text-sm text-gray-600">Total Items</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">{inventory.length}</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full">
                      <thead className="bg-gray-50 border-b-2 border-gray-200">
                        <tr>
                          <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-gray-700">Item Name</th>
                          <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-gray-700 hidden md:table-cell">Supplier</th>
                          <th className="text-right p-2 sm:p-3 text-xs sm:text-sm font-semibold text-gray-700">Quantity</th>
                          <th className="text-right p-2 sm:p-3 text-xs sm:text-sm font-semibold text-gray-700 hidden lg:table-cell">Cost Price</th>
                          <th className="text-right p-2 sm:p-3 text-xs sm:text-sm font-semibold text-gray-700 hidden sm:table-cell">Selling Price</th>
                          <th className="text-right p-2 sm:p-3 text-xs sm:text-sm font-semibold text-gray-700">Total Value</th>
                          <th className="text-right p-2 sm:p-3 text-xs sm:text-sm font-semibold text-gray-700 hidden md:table-cell">Markup</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInventory.map((item, idx) => {
                          const markup = Number(item.sellingPrice || 0) > 0 
                            ? ((Number(item.sellingPrice || 0) - Number(item.costPrice || 0)) / Number(item.costPrice || 0) * 100)
                            : 0;
                          
                          return (
                            <tr key={item.id} className={`border-b hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                              <td className="p-2 sm:p-3">
                                <div>
                                  <p className="font-semibold text-gray-900 text-xs sm:text-sm break-words">{item.name}</p>
                                  <p className="text-xs text-gray-500">Added: {new Date(item.dateAdded).toLocaleDateString()}</p>
                                </div>
                              </td>
                              <td className="p-2 sm:p-3 text-xs sm:text-sm text-gray-600 hidden md:table-cell">{item.supplier || "N/A"}</td>
                              <td className="p-2 sm:p-3 text-right">
                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                  item.quantity > 10 ? "bg-green-100 text-green-800" :
                                  item.quantity > 5 ? "bg-amber-100 text-amber-800" :
                                  "bg-red-100 text-red-800"
                                }`}>
                                  {item.quantity}
                                </span>
                              </td>
                              <td className="p-2 sm:p-3 text-right font-semibold text-gray-700 text-xs sm:text-sm hidden lg:table-cell break-all">
                                {Number(item.costPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-2 sm:p-3 text-right font-semibold text-gray-900 text-xs sm:text-sm hidden sm:table-cell break-all">
                                {Number(item.sellingPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-2 sm:p-3 text-right font-bold text-blue-600 text-xs sm:text-sm break-all">
                                {Number(item.totalValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-2 sm:p-3 text-right hidden md:table-cell">
                                <span className={`font-semibold text-xs sm:text-sm ${markup > 30 ? 'text-green-600' : markup > 15 ? 'text-blue-600' : 'text-amber-600'}`}>
                                  {markup.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                {filteredInventory.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <Package className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-sm sm:text-base">No inventory items found</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "balance-sheet" && balanceSheet && (
              <div>
                <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-800">Balance Sheet</h3>
                    <p className="text-xs sm:text-sm text-gray-600">As of {new Date(balanceSheet.date).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={downloadBalanceSheet}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-lg transition-all flex items-center gap-2 text-sm whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    Download CSV
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 border-2 border-blue-200">
                    <h4 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                      ASSETS
                    </h4>
                    
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg p-3 sm:p-4">
                        <p className="text-xs sm:text-sm font-semibold text-gray-600 mb-3">Current Assets</p>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs sm:text-sm">
                            <span className="text-gray-700">Cash</span>
                            <span className="font-bold break-all">{Number(balanceSheet.assets.currentAssets.cash || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs sm:text-sm">
                            <span className="text-gray-700">A/R</span>
                            <span className="font-bold break-all">{Number(balanceSheet.assets.currentAssets.accountsReceivable || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs sm:text-sm">
                            <span className="text-gray-700">Inventory</span>
                            <span className="font-bold break-all">{Number(balanceSheet.assets.currentAssets.inventory || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="h-px bg-gray-300 my-2"></div>
                          <div className="flex justify-between items-center text-xs sm:text-sm">
                            <span className="font-semibold text-gray-800">Total Current Assets</span>
                            <span className="font-bold text-base text-blue-600 break-all">
                              {Number(balanceSheet.assets.currentAssets.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-100 rounded-lg p-3 sm:p-4 border-2 border-blue-300">
                        <div className="flex justify-between items-center">
                          <span className="text-base sm:text-lg font-bold text-gray-800">TOTAL ASSETS</span>
                          <span className="text-lg sm:text-xl font-bold text-blue-700 break-all">
                            {Number(balanceSheet.assets.totalAssets || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 sm:space-y-6">
                    <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-4 sm:p-6 border-2 border-red-200">
                      <h4 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                        LIABILITIES
                      </h4>
                      
                      <div className="space-y-4">
                        <div className="bg-white rounded-lg p-3 sm:p-4">
                          <p className="text-xs sm:text-sm font-semibold text-gray-600 mb-3">Current Liabilities</p>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs sm:text-sm">
                              <span className="text-gray-700">A/P</span>
                              <span className="font-bold break-all">
                                {Number(balanceSheet.liabilities.currentLiabilities.accountsPayable || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="h-px bg-gray-300 my-2"></div>
                            <div className="flex justify-between items-center text-xs sm:text-sm">
                              <span className="font-semibold text-gray-800">Total Current Liabilities</span>
                              <span className="font-bold text-base text-red-600 break-all">
                                {Number(balanceSheet.liabilities.currentLiabilities.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-red-100 rounded-lg p-3 sm:p-4 border-2 border-red-300">
                          <div className="flex justify-between items-center">
                            <span className="text-base sm:text-lg font-bold text-gray-800">TOTAL LIABILITIES</span>
                            <span className="text-lg sm:text-xl font-bold text-red-700 break-all">
                              {Number(balanceSheet.liabilities.totalLiabilities || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 sm:p-6 border-2 border-green-200">
                      <h4 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                        EQUITY
                      </h4>
                      
                      <div className="space-y-4">
                        <div className="bg-white rounded-lg p-3 sm:p-4">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs sm:text-sm">
                              <span className="text-gray-700">Capital</span>
                              <span className="font-bold break-all">
                                {Number(balanceSheet.equity.capital || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs sm:text-sm">
                              <span className="text-gray-700">Retained Earnings</span>
                              <span className={`font-bold break-all ${balanceSheet.equity.retainedEarnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {Number(balanceSheet.equity.retainedEarnings || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="h-px bg-gray-300 my-2"></div>
                            <div className="flex justify-between items-center text-xs sm:text-sm">
                              <span className="font-semibold text-gray-800">Total Equity</span>
                              <span className="font-bold text-base text-green-600 break-all">
                                {Number(balanceSheet.equity.totalEquity || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-green-100 rounded-lg p-3 sm:p-4 border-2 border-green-300">
                          <div className="flex justify-between items-center">
                            <span className="text-base sm:text-lg font-bold text-gray-800">TOTAL LIAB & EQUITY</span>
                            <span className="text-lg sm:text-xl font-bold text-green-700 break-all">
                              {(Number(balanceSheet.liabilities.totalLiabilities || 0) + Number(balanceSheet.equity.totalEquity || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-300">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <span className="font-semibold text-gray-700 text-sm">Balance Check: Assets = Liabilities + Equity</span>
                    {Math.abs(balanceSheet.assets.totalAssets - (balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity)) < 0.01 ? (
                      <span className="flex items-center gap-2 text-green-600 font-semibold text-sm">
                        ✓ Balanced
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-red-600 font-semibold text-sm">
                        ✗ Not Balanced
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-gray-500 text-xs sm:text-sm mt-8">
          <p>Integrated Financial Management System • Last updated: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}