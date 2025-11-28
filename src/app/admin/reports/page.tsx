"use client";
import { useEffect, useState, useMemo } from "react";
import { TrendingUp, Wallet, CreditCard, Users, Package, DollarSign, Download, BookOpen, Search, X, Edit2, Check } from "lucide-react";

// Import separated components
import DailyTransactionsTracker from "../CashLedger"; 
import CreditorsSection from "../CreditorsSection";
import DebtorsSection from "../DebtorsSection";
import BalanceSheetSection from "../BalanceSheetSection";
import InventorySection from "../inventory";

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
export type CashLedgerProps = {
  transactions: CashTransaction[];
  cashBalance: number;
  onDownload: () => void;
};

type BalanceSheet = {
  assets: {
    currentAssets: {
      cash: number;
      accountsReceivable: number;
      inventory: number;
      total: number;
    };
    nonCurrentAssets?: {
      machinery: number;
      motorVehicle: number;
      phoneAndAccessories: number;
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
  const [openingCash, setOpeningCash] = useState(0);
  const [isEditingOpeningCash, setIsEditingOpeningCash] = useState(false);
  const [tempOpeningCash, setTempOpeningCash] = useState(0);
  const [rawData, setRawData] = useState<any>(null);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [inventoryHistory, setInventoryHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [stats, setStats] = useState({
    cashBalance: 0,
    totalCreditors: 0,
    totalDebtors: 0,
    inventoryValue: 0,
    estimatedInventoryValue: 0,
    salesRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    costOfGoodsSold: 0,
    grossProfit: 0,
  });

  useEffect(() => {
    loadOpeningCash();
    fetchAllData();
  }, []);

  const loadOpeningCash = async () => {
    try {
      const res = await fetch("/api/opening-balance");
      if (!res.ok) {
        console.error(`Failed to fetch opening balance - Status: ${res.status}`);
        setOpeningCash(50000);
        setTempOpeningCash(50000);
        return;
      }
      const data = await res.json();
      const amount = Number(data?.amount || data?.balance || 0);
      if (amount > 0) {
        setOpeningCash(amount);
        setTempOpeningCash(amount);
      } else {
        setOpeningCash(50000);
        setTempOpeningCash(50000);
      }
    } catch (error) {
      console.error('Error fetching opening balance:', error);
      setOpeningCash(50000);
      setTempOpeningCash(50000);
    }
  };

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

      const safeFetch = async (url: string) => {
        try {
          const res = await fetch(url);
          if (!res.ok) {
            console.error(`Failed to fetch ${url} - Status: ${res.status}`);
            return [];
          }
          const data = await res.json();
          return data;
        } catch (err) {
          console.error(`Network error fetching ${url}:`, err);
          return [];
        }
      };

      const [sales, expenses, stock, customers, creditors] = await Promise.all([
        safeFetch("/api/sales"),
        safeFetch("/api/expenses"),
        safeFetch("/api/stock"),
        safeFetch("/api/customer"),
        safeFetch("/api/creditors"),
      ]);

      const salesData = Array.isArray(sales) ? sales : sales?.data || [];
      const expensesData = Array.isArray(expenses?.expenses)
        ? expenses.expenses
        : [];

      const stockData = Array.isArray(stock) ? stock : stock?.data || [];
      const customersData = Array.isArray(customers) ? customers : customers?.data || [];
      const creditorsData = Array.isArray(creditors) ? creditors : creditors?.data || [];

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

    // Process creditors
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

    // Build product cost map for COGS calculation
    const productCostMap = new Map<number, number>();
    stockArray.forEach((stock: any) => {
      const prodId = Number(stock?.productId || stock?.id || 0);
      const costPrice = Number(stock?.costPrice || 0);
      if (prodId > 0 && costPrice > 0) {
        productCostMap.set(prodId, costPrice);
      }
    });

    // Process sales
    salesArray.forEach((sale: any) => {
      const saleAmount = Number(sale?.amount || 0);
      totalSalesRevenue += saleAmount;

      let saleCOGS = 0;
      if (sale?.saleitem && Array.isArray(sale.saleitem)) {
        sale.saleitem.forEach((item: any) => {
          const quantity = Number(item?.quantity || 0);
          const productId = Number(item?.productId || 0);
          
          let costPrice = productCostMap.get(productId) || 0;
          
          if (costPrice === 0 && item?.product?.costPrice) {
            costPrice = Number(item.product.costPrice);
          }
          
          const itemCost = quantity * costPrice;
          saleCOGS += itemCost;
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

    // Sort and recalculate running balances
    cashTxns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBal = 0;
    cashTxns.forEach(txn => {
      if (txn.type === "INFLOW") {
        runningBal += txn.amount;
      } else {
        runningBal -= txn.amount;
      }
      txn.runningBalance = runningBal;
    });

    // Process inventory - CORRECTED CALCULATION
    const invItems: InventoryItem[] = stockArray.map((item: any) => {
      const quantity = Number(item?.quantity || 0);
      const costPrice = Number(item?.costPrice || 0);
      const sellingPrice = Number(item?.sellingPrice || 0);
      
      return {
        id: item?.id || 0,
        name: item?.name || "Item",
        quantity,
        costPrice,
        sellingPrice,
        totalValue: quantity * costPrice, // This is the cost value
        supplier: item?.supplier || "",
        dateAdded: item?.createdAt || new Date().toISOString(),
      };
    });

    // Calculate inventory values correctly
    totalInventoryValue = invItems.reduce((sum, item) => sum + item.totalValue, 0); // Total cost
    const estimatedInventoryValue = invItems.reduce((sum, item) => {
      return sum + (item.quantity * item.sellingPrice); // Total potential revenue at selling price
    }, 0);

    const totalCreditorBalance = Array.from(creditorMap.values()).reduce((sum, c) => sum + c.balance, 0);
    const totalDebtorBalance = Array.from(debtorMap.values()).reduce((sum, d) => sum + d.balance, 0);
    
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
        nonCurrentAssets: {
          machinery: 0,
          motorVehicle: 0,
          phoneAndAccessories: 0,
          total: 0
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
      estimatedInventoryValue,
      salesRevenue: totalSalesRevenue,
      totalExpenses,
      netIncome,
      costOfGoodsSold: totalCostOfGoodsSold,
      grossProfit,
    });
  };

  const handleSaveOpeningCash = async () => {
    const newAmount = Number(tempOpeningCash);
    if (isNaN(newAmount) || newAmount < 0) {
      alert("Please enter a valid positive number");
      return;
    }
    
    try {
      const res = await fetch("/api/opening-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: newAmount }),
      });
      
      if (!res.ok) {
        throw new Error(`Failed to save: ${res.status}`);
      }
      
      setOpeningCash(newAmount);
      setIsEditingOpeningCash(false);
      alert("Opening cash balance saved successfully!");
    } catch (error) {
      console.error('Failed to save opening cash balance:', error);
      alert("Failed to save opening cash balance. Please try again.");
    }
  };

  // FIXED: Download COGS Ledger function with proper error handling
 // DEBUG VERSION: Download COGS Ledger with detailed logging
const downloadCOGSLedger = async () => {
  try {
    console.log("🔄 Starting COGS ledger download...");
    
    const apiUrl = "/api/reports/cogs-ledger";
    console.log("📡 Fetching from:", apiUrl);
    
    const response = await fetch(apiUrl);
    
    console.log("📨 Response status:", response.status, response.statusText);
    console.log("📨 Response OK:", response.ok);
    
    if (!response.ok) {
      console.error("❌ API response not OK");
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log("📊 Raw API result:", result);
    console.log("📊 Result type:", typeof result);
    console.log("📊 Result keys:", Object.keys(result));

    // Check if we have the data property
    if (!result.hasOwnProperty('data')) {
      console.error("❌ No 'data' property in response");
      console.error("❌ Available properties:", Object.keys(result));
      throw new Error("API response missing 'data' property");
    }

    const cogsData = result.data;
    console.log("📦 cogsData type:", typeof cogsData);
    console.log("📦 cogsData is array:", Array.isArray(cogsData));
    
    if (Array.isArray(cogsData)) {
      console.log("📦 cogsData length:", cogsData.length);
      if (cogsData.length > 0) {
        console.log("📦 First item:", cogsData[0]);
      }
    } else {
      console.error("❌ cogsData is not an array:", cogsData);
      throw new Error("cogsData is not an array");
    }

    // Handle empty data
    if (cogsData.length === 0) {
      console.warn("⚠️ No data in cogsData array");
      alert("No COGS data available to download");
      return;
    }

    console.log("✅ Data validation passed, creating CSV...");

    // Create CSV content
    const headers = ["Date", "Sale ID", "Product ID", "Product Name", "Quantity Sold", "Unit Production Cost", "Total Production Cost", "Sale Amount", "Sale Status"];
    console.log("📋 Headers:", headers);
    
    const rows = cogsData.map((item, index) => {
      const row = [
        item.date || "N/A",
        item.saleId || "N/A",
        item.productId || "N/A",
        item.productName || "Unknown",
        item.quantitySold || 0,
        Number(item.unitProductionCost || 0).toFixed(2),
        Number(item.totalProductionCost || 0).toFixed(2),
        Number(item.saleAmount || 0).toFixed(2),
        item.saleStatus || "N/A"
      ];
      
      if (index === 0) {
        console.log("📋 First row sample:", row);
      }
      
      return row;
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map((cell: string | number) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    console.log("📄 CSV content length:", csvContent.length);
    console.log("📄 First 200 chars of CSV:", csvContent.substring(0, 200));

    // Download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cogs-ledger-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    console.log("✅ COGS ledger downloaded successfully!");
    
  } catch (error) {
    console.error('❌ Error downloading COGS ledger:', error);
    
    if (error instanceof Error) {
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      
      alert(`Failed to download COGS ledger: ${error.message}\n\nCheck browser console for details.`);
    } else {
      console.error('❌ Unknown error type:', error);
      alert("An unexpected error occurred while downloading the COGS ledger. Check console for details.");
    }
  }
};

  // FIXED: Download Cash Ledger function with proper error handling
  const downloadCashLedger = async () => {
    try {
      // Fetch cash ledger data from API
      const response = await fetch("/api/money");
      if (!response.ok) {
        throw new Error(`Failed to fetch cash ledger: ${response.status}`);
      }
      
      const cashData = await response.json();
      
      // Validate response data
      const dataToUse = Array.isArray(cashData) ? cashData : cashTransactions;
      
      if (!Array.isArray(dataToUse)) {
        throw new Error("Invalid cash data format");
      }

      // Handle empty data gracefully
      if (dataToUse.length === 0) {
        alert("No cash ledger data available to download");
        return;
      }

      // Create CSV content with proper validation
      const csvContent = [
        ["Date", "Description", "Category", "Type", "Amount", "Balance", "Accounts Affected"],
        ...dataToUse.map((txn: any) => [
          new Date(txn.date || txn.createdAt || new Date()).toLocaleDateString(),
          txn.description || "",
          txn.category || "",
          txn.type || "",
          Number(txn.amount || 0).toFixed(2),
          Number(txn.runningBalance || txn.balance || 0).toFixed(2),
          txn.affectedAccounts || ""
        ])
      ].map(row => row.map((cell: string | number) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cash-ledger-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up URL object after download
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
    } catch (error) {
      console.error('Error downloading cash ledger:', error);
      alert("Failed to download cash ledger. Please try again.");
    }
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

  const downloadInventoryReport = () => {
    // Validate inventory data
    if (!Array.isArray(inventory) || inventory.length === 0) {
      alert("No inventory data available to download");
      return;
    }

    const csvContent = [
      ["Item Name", "Supplier", "Quantity", "Cost Price", "Selling Price", "Total Cost Value", "Total Selling Value", "Markup %", "Date Added"],
      ...inventory.map(item => {
        const markup = Number(item.sellingPrice || 0) > 0 && Number(item.costPrice || 0) > 0
          ? ((Number(item.sellingPrice || 0) - Number(item.costPrice || 0)) / Number(item.costPrice || 0) * 100).toFixed(1)
          : "0.0";
        return [
          item.name || "Unknown",
          item.supplier || "N/A",
          item.quantity || 0,
          Number(item.costPrice || 0).toFixed(2),
          Number(item.sellingPrice || 0).toFixed(2),
          Number(item.totalValue || 0).toFixed(2),
          (item.quantity * item.sellingPrice).toFixed(2),
          markup,
          new Date(item.dateAdded).toLocaleDateString()
        ];
      })
    ].map(row => row.map((cell: string | number) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const fetchInventoryHistory = async (productId: number) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/restock?productId=${productId}`);
      if (!res.ok) {
        console.error(`Failed to fetch restock history - Status: ${res.status}`);
        setInventoryHistory([]);
        return;
      }
      const data = await res.json();
      const historyData = Array.isArray(data) ? data : data?.data || [];
      setInventoryHistory(historyData);
    } catch (error) {
      console.error('Error fetching restock history:', error);
      setInventoryHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewItemDetails = (item: InventoryItem) => {
    setSelectedInventoryItem(item);
    fetchInventoryHistory(item.id);
  };

  const downloadItemHistory = (item: InventoryItem) => {
    // Validate history data
    if (!Array.isArray(inventoryHistory) || inventoryHistory.length === 0) {
      alert("No history data available for this item");
      return;
    }

    const csvContent = [
      ["Item History Report"],
      [`Item: ${item.name}`],
      [`Current Quantity: ${item.quantity}`],
      [`Cost Price: KES ${Number(item.costPrice || 0).toFixed(2)}`],
      [`Selling Price: KES ${Number(item.sellingPrice || 0).toFixed(2)}`],
      [""],
      ["Restock History"],
      ["Date", "Quantity Added", "Cost Price", "Supplier/Notes", "Added By"],
      ...inventoryHistory.map(record => [
        new Date(record?.createdAt || record?.date || new Date()).toLocaleDateString(),
        record?.quantity || 0,
        Number(record?.costPrice || 0).toFixed(2),
        record?.supplier || record?.notes || "N/A",
        record?.addedBy || "System"
      ])
    ].map(row => Array.isArray(row) ? row.map((cell: string | number) => `"${String(cell).replace(/"/g, '""')}"`).join(",") : `"${String(row).replace(/"/g, '""')}"`).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.name.replace(/[^a-z0-9]/gi, '-')}-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  // Memoized filtered data for better performance
  const filteredCashTxns = useMemo(() => 
    Array.isArray(cashTransactions) 
      ? cashTransactions.filter(txn =>
          txn.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          txn.category.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : [], [cashTransactions, searchTerm]
  );

  const filteredCreditors = useMemo(() =>
    Array.isArray(creditors)
      ? creditors.filter(c =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : [], [creditors, searchTerm]
  );

  const filteredDebtors = useMemo(() =>
    Array.isArray(debtors)
      ? debtors.filter(d =>
          d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.email.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : [], [debtors, searchTerm]
  );

  const filteredInventory = useMemo(() =>
    Array.isArray(inventory)
      ? inventory.filter(i =>
          i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          i.supplier?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : [], [inventory, searchTerm]
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

        {/* UPDATED: Download Section in Overview - REMOVED Balance Sheet Button */}
        {activeTab === "overview" && (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6 sm:mb-8 border-2 border-green-200">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Download Reports</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={downloadCashLedger}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
              >
                <Download className="w-5 h-5" />
                <span>Cash Ledger</span>
              </button>
              
              <button
                onClick={downloadCOGSLedger}
                className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
              >
                <Download className="w-5 h-5" />
                <span>COGS Ledger</span>
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-gray-600">Creditors (Payable)</span>
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-all">
              KES {Number(stats.totalCreditors || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">{Array.isArray(creditors) ? creditors.length : 0} suppliers</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-amber-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-gray-600">Debtors (Receivable)</span>
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-all">
              KES {Number(stats.totalDebtors || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">{Array.isArray(debtors) ? debtors.length : 0} customers</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-gray-600">Inventory Value</span>
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-all">
              KES {Number(stats.inventoryValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">{Array.isArray(inventory) ? inventory.length : 0} items</p>
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
                    <h3 className="text-lg sm:text-xl font-bold text-black mb-4">Balance Sheet Summary</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-black mb-2">Assets</p>
                        <div className="space-y-1 text-xs sm:text-sm text-black">
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
  <DailyTransactionsTracker />
)}

            {activeTab === "creditors" && (
              <CreditorsSection />
            )}

            {activeTab === "debtors" && (
              <DebtorsSection />
            )}

            {activeTab === "inventory" && (
              <InventorySection/>
            )}

{activeTab === "balance-sheet" && (
  <BalanceSheetSection 
    balanceSheet={
      balanceSheet ? {
        assets: {
          currentAssets: {
            inventory: balanceSheet.assets.currentAssets.inventory,
            cash: balanceSheet.assets.currentAssets.cash,
            bankBalances: 0, // Add default
            accountsReceivable: balanceSheet.assets.currentAssets.accountsReceivable,
            pettyCash: 0, // Add default
            total: balanceSheet.assets.currentAssets.total
          },
          nonCurrentAssets: {
            machinery: 0, // Add default
            motorVehicle: 0, // Add default
            phoneAndAccessories: 0, // Add default
            total: 0 // Add default
          },
          totalAssets: balanceSheet.assets.totalAssets
        },
        liabilities: {
          currentLiabilities: {
            shortTermLoans: 0, // Add default
            creditors: balanceSheet.liabilities.currentLiabilities.accountsPayable,
            total: balanceSheet.liabilities.currentLiabilities.total
          },
          nonCurrentLiabilities: {
            longTermLoans: 0, // Add default
            total: 0 // Add default
          },
          totalLiabilities: balanceSheet.liabilities.totalLiabilities
        },
        equity: {
          shareCapital: balanceSheet.equity.capital,
          retainedEarnings: balanceSheet.equity.retainedEarnings,
          totalEquity: balanceSheet.equity.totalEquity
        },
        netAssets: 0, // Add default
        date: balanceSheet.date
      } : undefined
    }
    pettyCashBalance={0}
    onDownload={() => {
      // Simple download function
      if (balanceSheet) {
        const csvContent = [
          ["Balance Sheet", `As of ${new Date(balanceSheet.date).toLocaleDateString()}`],
          [""],
          ["ASSETS", "Amount (KES)"],
          ["Cash", balanceSheet.assets.currentAssets.cash.toLocaleString()],
          ["Accounts Receivable", balanceSheet.assets.currentAssets.accountsReceivable.toLocaleString()],
          ["Inventory", balanceSheet.assets.currentAssets.inventory.toLocaleString()],
          ["Total Assets", balanceSheet.assets.totalAssets.toLocaleString()],
          [""],
          ["LIABILITIES & EQUITY", "Amount (KES)"],
          ["Accounts Payable", balanceSheet.liabilities.currentLiabilities.accountsPayable.toLocaleString()],
          ["Total Liabilities", balanceSheet.liabilities.totalLiabilities.toLocaleString()],
          ["Capital", balanceSheet.equity.capital.toLocaleString()],
          ["Retained Earnings", balanceSheet.equity.retainedEarnings.toLocaleString()],
          ["Total Equity", balanceSheet.equity.totalEquity.toLocaleString()]
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
      }
    }}
    onManualInputChange={(category, field, value) => {
      console.log('Manual input changed:', category, field, value);
      // You can implement manual input handling here if needed
    }}
  />
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