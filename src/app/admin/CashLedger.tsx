"use client";

import { useEffect, useState } from "react";
import { Download, ArrowUpRight, ArrowDownRight } from "lucide-react";

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

type CashLedgerProps = {
  transactions?: CashTransaction[];
  cashBalance?: number;
  onDownload?: () => void;
};

export default function CashLedger({
  transactions: propTransactions = [],
  cashBalance: propCashBalance,
  onDownload: propOnDownload,
}: CashLedgerProps) {
  const [transactions, setTransactions] = useState<CashTransaction[]>(propTransactions);
  const [cashBalance, setCashBalance] = useState(propCashBalance ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [category, setCategory] = useState("all");

  // Fetch transactions on mount
  useEffect(() => {
    fetchAllTransactions(dateFrom, dateTo, category);
  }, []);

  // Update when props change
  useEffect(() => {
    if (propTransactions.length > 0) {
      setTransactions(propTransactions);
      setCashBalance(propCashBalance ?? 0);
    }
  }, [propTransactions, propCashBalance]);

  const fetchAllTransactions = async (from?: string, to?: string, cat?: string) => {
    setLoading(true);
    setError(null);

    try {
      let allTransactions: CashTransaction[] = [];

      // ---------------- Sales (INFLOW) ----------------
      try {
        const salesRes = await fetch("/api/sales");
        if (salesRes.ok) {
          const salesData = await salesRes.json();
          const transformedSales = (Array.isArray(salesData) ? salesData : [])
            .map((sale: any) => {
              const totalPaid = (sale.payment || sale.payments || [])
                .filter((p: any) => p.status === "CLEARED")
                .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

              return {
                id: `sale-${sale.id}`,
                date: sale.date || new Date().toISOString(),
                description: `Sales Revenue - ${sale.customer?.name || "Customer"}`,
                type: "INFLOW" as const,
                category: "Sales Revenue",
                amount: totalPaid,
                runningBalance: 0,
                relatedTo: `Sale #${sale.id}`,
                affectedAccounts: sale.paymentMethod || "",
              };
            })
            .filter((txn: CashTransaction) => txn.amount > 0);

          allTransactions.push(...transformedSales);
        }
      } catch (err) {
        console.error("Error fetching sales:", err);
      }

      // ---------------- Cash Ledger (INFLOW/OUTFLOW) ----------------
      try {
        const ledgerRes = await fetch("/api/cash-ledger");
        if (ledgerRes.ok) {
          const ledgerData = await ledgerRes.json();
          const transformedLedger = (Array.isArray(ledgerData) ? ledgerData : [])
            .map((entry: any) => {
              const amount = Number(entry.amount || 0);
              const type = entry.type || (amount < 0 ? "OUTFLOW" : "INFLOW");
              return {
                id: `ledger-${entry.id}`,
                date: entry.date || new Date().toISOString(),
                description: entry.description || "Cash transaction",
                type: type as "INFLOW" | "OUTFLOW",
                category: entry.category || "General",
                amount: Math.abs(amount),
                runningBalance: 0,
                relatedTo: entry.relatedTo || "",
                affectedAccounts: entry.affectedAccounts || "",
              };
            })
            .filter((txn: CashTransaction) => txn.amount > 0);
          allTransactions.push(...transformedLedger);
        }
      } catch (err) {
        console.error("Error fetching cash ledger:", err);
      }

      // ---------------- Expenses (OUTFLOW) ----------------
      try {
        let expenseUrl = "/api/expenses";
        const params = new URLSearchParams();
        if (from) params.append("from", from);
        if (to) params.append("to", to);
        const queryStr = params.toString();
        if (queryStr) expenseUrl += "?" + queryStr;

        console.log("Fetching expenses from:", expenseUrl);
        const expenseRes = await fetch(expenseUrl);
        if (expenseRes.ok) {
          const expenseData = await expenseRes.json();
          console.log("Expenses Response:", expenseData);
          
          const transformedExpenses = (expenseData.expenses || expenseData.entries || expenseData || [])
            .map((expense: any) => ({
              id: `expense-${expense.id}`,
              date: expense.date || new Date().toISOString(),
              description: expense.title || expense.description || `Expense: ${expense.name || "Unnamed"}`,
              type: "OUTFLOW" as const,
              category: expense.category || "Operating Expense",
              amount: Number(expense.amount || 0),
              runningBalance: 0,
              relatedTo: expense.relatedTo || "",
              affectedAccounts: expense.affectedAccounts || "",
            }))
            .filter((txn: CashTransaction) => txn.amount > 0);
          
          allTransactions.push(...transformedExpenses);
          console.log("Transformed expenses:", transformedExpenses);
        } else {
          console.warn("Failed to fetch expenses:", expenseRes.status);
        }
      } catch (err) {
        console.error("Error fetching expenses:", err);
      }

      // ---------------- Restocks (OUTFLOW: Inventory Purchase) ----------------
      try {
        console.log("Fetching restocks from: /api/restock");
        const restockRes = await fetch("/api/restock");
        if (restockRes.ok) {
          const restockData = await restockRes.json();
          const restocks = restockData.restocks || [];

          const transformedRestocks = restocks.map((restock: any) => ({
            id: `restock-${restock.id}`,
            date: restock.createdAt || new Date().toISOString(),
            description: `Inventory Purchase - ${restock.product?.name || "Product"}`,
            type: "OUTFLOW" as const,
            category: "Inventory Purchase",
            amount: Number(restock.totalCost || 0),
            runningBalance: 0,
            relatedTo: `Restock #${restock.id}`,
            affectedAccounts:
              restock.paymentSource === "credit"
                ? `Creditor: ${restock.creditor?.name || "Unknown"}`
                : "Cash Account",
          }));

          allTransactions.push(...transformedRestocks);
        } else {
          console.warn("Failed to fetch restocks:", restockRes.status);
        }
      } catch (err) {
        console.error("Error fetching restocks:", err);
      }

      // ---------------- Filtering & Sorting ----------------
      if (from || to) {
        allTransactions = allTransactions.filter((txn) => {
          const txnDate = new Date(txn.date);
          if (from && txnDate < new Date(from)) return false;
          if (to && txnDate > new Date(to)) return false;
          return true;
        });
      }

      if (cat && cat !== "all") {
        allTransactions = allTransactions.filter((txn) => txn.category === cat);
      }

      allTransactions.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // ---------------- Running Balance ----------------
      let runningBalance = 0;
      const txnsWithBalance = allTransactions.map((txn) => {
        if (txn.type === "INFLOW") runningBalance += txn.amount;
        else runningBalance -= txn.amount;
        return { ...txn, runningBalance };
      });

      console.log("Final combined transactions:", txnsWithBalance);
      console.log("Final balance:", runningBalance);

      setTransactions(txnsWithBalance);
      setCashBalance(runningBalance);
    } catch (err) {
      console.error("Error in fetchAllTransactions:", err);
      setError("Failed to load cash ledger. Please check the console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = () => {
    fetchAllTransactions(dateFrom, dateTo, category);
  };

  const handleClearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setCategory("all");
    fetchAllTransactions();
  };

  const handleDownload = async () => {
    if (propOnDownload) {
      propOnDownload();
      return;
    }

    try {
      const csvContent = generateCSV();
      const element = document.createElement("a");
      element.setAttribute(
        "href",
        "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent)
      );
      element.setAttribute(
        "download",
        `cash-ledger-${new Date().toISOString().split("T")[0]}.csv`
      );
      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download CSV");
    }
  };

  const generateCSV = (): string => {
    const headers = [
      "Date",
      "Description",
      "Category",
      "Type",
      "Amount",
      "Running Balance",
      "Related To",
      "Accounts Affected",
    ];

    const rows = transactions.map((txn: CashTransaction) => [
      new Date(txn.date).toLocaleDateString(),
      txn.description,
      txn.category,
      txn.type,
      txn.amount.toFixed(2),
      txn.runningBalance.toFixed(2),
      txn.relatedTo || "",
      txn.affectedAccounts || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) =>
            typeof cell === "string" && cell.includes(",")
              ? `"${cell}"`
              : cell
          )
          .join(",")
      ),
    ].join("\n");

    return csvContent;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <div className="inline-block">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
        <p className="text-gray-600 mt-4">Loading cash ledger and expenses...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={() => fetchAllTransactions(dateFrom, dateTo, category)}
          className="mt-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
            >
              <option value="all">All Categories</option>
              <option value="Sales Revenue">Sales Revenue</option>
              <option value="Inventory Purchase">Inventory Purchase</option>
              <option value="Operating Expense">Operating Expense</option>
              <option value="Debt Collection">Debt Collection</option>
            </select>
          </div>

          <div className="flex gap-2 items-end">
            <button
              onClick={handleFilterChange}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition text-sm"
            >
              Filter
            </button>
            <button
              onClick={handleClearFilters}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-medium transition text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Header and Balance */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h3 className="text-lg sm:text-xl font-bold text-gray-800">
          Cash Ledger - All Transactions
        </h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
          <div className="text-left sm:text-right">
            <p className="text-xs sm:text-sm text-gray-600">Current Balance</p>
            <p
              className={`text-xl sm:text-2xl font-bold break-all ${
                cashBalance >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              KES{" "}
              {Number(cashBalance || 0).toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
          <button
            onClick={handleDownload}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-lg transition-all flex items-center gap-2 text-sm whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
        </div>
      </div>

      {/* Empty State */}
      {transactions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <p className="text-gray-500 text-lg">No transactions found</p>
          <p className="text-gray-400 text-sm mt-2">
            Transactions will appear here as you make sales, purchases, and
            expenses
          </p>
        </div>
      ) : (
        /* Table */
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-gray-700 whitespace-nowrap">
                    Date
                  </th>
                  <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-gray-700">
                    Description
                  </th>
                  <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-gray-700 hidden md:table-cell">
                    Category
                  </th>
                  <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold text-gray-700 hidden lg:table-cell">
                    Accounts Affected
                  </th>
                  <th className="text-right p-2 sm:p-3 text-xs sm:text-sm font-semibold text-gray-700">
                    Amount
                  </th>
                  <th className="text-right p-2 sm:p-3 text-xs sm:text-sm font-semibold text-gray-700 hidden sm:table-cell">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn: CashTransaction, idx: number) => (
                  <tr
                    key={txn.id}
                    className={`border-b hover:bg-gray-50 ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-25"
                    }`}
                  >
                    <td className="p-2 sm:p-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                      {new Date(txn.date).toLocaleDateString()}
                    </td>
                    <td className="p-2 sm:p-3 text-xs sm:text-sm text-gray-800 max-w-xs break-words">
                      {txn.description}
                    </td>
                    <td className="p-2 sm:p-3 text-xs sm:text-sm hidden md:table-cell">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          txn.type === "INFLOW"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
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
                          <span
                            className={`${
                              txn.type === "INFLOW"
                                ? "text-green-600"
                                : "text-red-600"
                            } break-all`}
                          >
                            {Number(txn.amount || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">No cash</span>
                      )}
                    </td>
                    <td
                      className={`p-2 sm:p-3 text-xs sm:text-sm text-right font-bold hidden sm:table-cell break-all ${
                        txn.runningBalance >= 0
                          ? "text-gray-900"
                          : "text-red-600"
                      }`}
                    >
                      {Number(txn.runningBalance || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}