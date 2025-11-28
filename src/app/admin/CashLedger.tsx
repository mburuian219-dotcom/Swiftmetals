"use client";

import React, { useEffect, useState } from "react";
import { Download, Plus, ChevronRight, X, Edit2, Trash2 } from "lucide-react";

interface Transaction {
  id: number;
  description: string;
  amount: number;
  type: "CASH_IN" | "CASH_OUT";
  category: string;
  referenceSource: string;
  timestamp: string;
}

interface DailySummary {
  date: string;
  openingBalance: number;
  totalCashIn: number;
  totalCashOut: number;
  closingBalance: number;
  transactions: Transaction[];
  hasOpeningBalance: boolean;
}

const DailyTransactionsTracker = () => {
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set([new Date().toISOString().split('T')[0]]));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // Updated categories to distinguish production vs non-production expenses
  const EXPENSE_CATEGORIES = [
    "Administrative Cost",
    "Selling Cost",
    "Operating Expenses",
    "Rent & Lease",
    "Salaries & Wages",
    "Other"
  ];

  const PRODUCTION_CATEGORIES = [
    "Production Cost",
  ];

  // Add Inventory Purchase category
  const INVENTORY_PURCHASE_CATEGORY = "Inventory Purchase💰";

  const ALL_EXPENSE_CATEGORIES = [...EXPENSE_CATEGORIES, ...PRODUCTION_CATEGORIES, INVENTORY_PURCHASE_CATEGORY];

  const INCOME_CATEGORIES = [
    "Sales Revenue",
    "Service Income",
    "Investment Income",
    "Other Income"
  ];

  const [transaction, setTransaction] = useState({
    description: "",
    amount: "",
    type: "CASH_IN" as "CASH_IN" | "CASH_OUT",
    category: "",
  });

  const [balanceForm, setBalanceForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: "",
  });

  useEffect(() => {
    fetchCashLedger();
  }, []);

  const fetchOpeningBalances = async () => {
    try {
      const res = await fetch("/api/daily-sales/daily-opening-balance");
      if (res.ok) {
        const balances = await res.json();
        return balances;
      }
    } catch (err) {
      console.error("Error fetching opening balances:", err);
    }
    return [];
  };

  // Function to get previous day's closing balance
  const getPreviousDayClosingBalance = (currentDate: string): number => {
    const current = new Date(currentDate);
    const previousDay = new Date(current);
    previousDay.setDate(previousDay.getDate() - 1);
    const previousDayStr = previousDay.toISOString().split('T')[0];
    
    const previousSummary = dailySummaries.find(s => s.date === previousDayStr);
    return previousSummary?.closingBalance || 0;
  };

  // Function to check if transaction should be excluded from cash out totals
  const isExcludedFromCashOut = (transaction: Transaction): boolean => {
    return (
      PRODUCTION_CATEGORIES.includes(transaction.category) ||
      transaction.category === INVENTORY_PURCHASE_CATEGORY ||
      transaction.referenceSource === "inventory"
    );
  };

  // Function to check if transaction should be added to expense ledger
  const shouldAddToExpenseLedger = (transactionData: any): boolean => {
    return (
      transactionData.type === "CASH_OUT" && 
      !PRODUCTION_CATEGORIES.includes(transactionData.category) &&
      transactionData.category !== INVENTORY_PURCHASE_CATEGORY &&
      transactionData.referenceSource !== "inventory"
    );
  };

  // Function to add transaction to expense ledger
  const addToExpenseLedger = async (transactionData: any) => {
    // Only add to expense ledger if it meets the criteria
    if (shouldAddToExpenseLedger(transactionData)) {
      try {
        const expenseEntry = {
          title: transactionData.description,
          amount: parseFloat(transactionData.amount),
          category: transactionData.category,
          date: new Date().toISOString().split('T')[0],
          notes: `From cash ledger transaction: ${transactionData.description}`,
        };

        console.log("Adding to expense ledger:", expenseEntry);

        const res = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(expenseEntry),
        });

        const result = await res.json();

        if (!res.ok) {
          console.error("Failed to add to expense ledger:", result.error);
        } else {
          console.log("Successfully added to expense ledger:", result);
        }
      } catch (err) {
        console.error("Error adding to expense ledger:", err);
      }
    }
  };

  // Function to remove from expense ledger when transaction is deleted
  const removeFromExpenseLedger = async (transactionData: any) => {
    try {
      // Find the expense by matching properties since we don't have transactionId in schema
      const expensesRes = await fetch("/api/expenses");
      const expensesData = await expensesRes.json();
      
      if (expensesData.success) {
        const matchingExpense = expensesData.expenses.find((expense: any) => 
          expense.title === transactionData.description &&
          expense.amount === parseFloat(transactionData.amount) &&
          expense.category === transactionData.category &&
          new Date(expense.date).toISOString().split('T')[0] === new Date(transactionData.timestamp).toISOString().split('T')[0]
        );

        if (matchingExpense) {
          const deleteRes = await fetch(`/api/expenses?id=${matchingExpense.id}`, {
            method: "DELETE",
          });

          const deleteResult = await deleteRes.json();

          if (!deleteRes.ok) {
            console.error("Failed to delete expense from ledger:", deleteResult.error);
          } else {
            console.log("Successfully removed from expense ledger:", deleteResult);
          }
        } else {
          console.log("No matching expense found to delete");
        }
      }
    } catch (err) {
      console.error("Error removing from expense ledger:", err);
    }
  };

  const fetchCashLedger = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cash-ledger");
      if (!res.ok) throw new Error("Failed to fetch cash ledger");
      
      const entries = await res.json();
      const openingBalances = await fetchOpeningBalances();
      
      // Create a proper map of opening balances
      const balanceMap = new Map<string, number>();
      openingBalances.forEach((balance: any) => {
        if (balance.date) {
          const date = new Date(balance.date).toISOString().split('T')[0];
          balanceMap.set(date, parseFloat(balance.openingBalance) || 0);
        }
      });
      
      const summariesMap = new Map<string, DailySummary>();
      
      // Process all transactions first
      entries.forEach((entry: any) => {
        const dateValue = entry.date;
        if (!dateValue) return;
        
        const date = new Date(dateValue).toISOString().split('T')[0];
        
        if (!summariesMap.has(date)) {
          const openingBal = balanceMap.get(date) || 0;
          const hasBalance = balanceMap.has(date);
          
          summariesMap.set(date, {
            date,
            openingBalance: openingBal,
            totalCashIn: 0,
            totalCashOut: 0,
            closingBalance: openingBal,
            transactions: [],
            hasOpeningBalance: hasBalance,
          });
        }
        
        const summary = summariesMap.get(date)!;
        const amount = parseFloat(entry.amount) || 0;
        
        const tx: Transaction = {
          id: entry.id,
          description: entry.description,
          amount: amount,
          type: entry.type === "INFLOW" || entry.type === "CASH_IN" ? "CASH_IN" : "CASH_OUT",
          category: entry.category,
          referenceSource: entry.referenceSource || entry.referenceType || "manual",
          timestamp: dateValue,
        };
        
        summary.transactions.push(tx);
        
        // Count transactions in totals - exclude inventory purchases and production costs from cash out
        if (tx.type === "CASH_IN") {
          summary.totalCashIn += amount;
        } else if (!isExcludedFromCashOut(tx)) {
          summary.totalCashOut += amount;
        }
      });
      
      // Add days that only have opening balances (no transactions)
      openingBalances.forEach((balance: any) => {
        if (balance.date) {
          const date = new Date(balance.date).toISOString().split('T')[0];
          if (!summariesMap.has(date)) {
            const amount = parseFloat(balance.openingBalance) || 0;
            summariesMap.set(date, {
              date: date,
              openingBalance: amount,
              totalCashIn: 0,
              totalCashOut: 0,
              closingBalance: amount,
              transactions: [],
              hasOpeningBalance: true,
            });
          }
        }
      });
      
      // Calculate closing balances properly (excluding production and inventory transactions from cash flow)
      summariesMap.forEach((summary) => {
        summary.closingBalance = summary.openingBalance + summary.totalCashIn - summary.totalCashOut;
        summary.transactions.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      });
      
      const summariesArray = Array.from(summariesMap.values()).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      setDailySummaries(summariesArray);
    } catch (err) {
      console.error("Error fetching data:", err);
      alert("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async () => {
    if (!transaction.description || !transaction.amount || !transaction.category) {
      alert("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode && editingTransactionId) {
        const res = await fetch("/api/cash-ledger", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingTransactionId,
            description: transaction.description,
            type: transaction.type,
            category: transaction.category,
            amount: parseFloat(transaction.amount),
          }),
        });

        if (res.ok) {
          // Update expense ledger if needed - exclude inventory purchases
          if (shouldAddToExpenseLedger({
            ...transaction,
            id: editingTransactionId,
            amount: parseFloat(transaction.amount)
          })) {
            await addToExpenseLedger({
              ...transaction,
              id: editingTransactionId,
              amount: parseFloat(transaction.amount)
            });
          }
          
          setIsTransactionModalOpen(false);
          setTransaction({ description: "", amount: "", type: "CASH_IN", category: "" });
          setIsEditMode(false);
          setEditingTransactionId(null);
          await fetchCashLedger();
        } else {
          const error = await res.json();
          alert(`Failed to update transaction: ${error.error || 'Unknown error'}`);
        }
      } else {
        const res = await fetch("/api/cash-ledger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: transaction.description,
            type: transaction.type,
            category: transaction.category,
            amount: parseFloat(transaction.amount),
            referenceType: "manual",
          }),
        });

        if (res.ok) {
          const newTransaction = await res.json();
          
          // Add to expense ledger if it's cash out and not production cost or inventory purchase
          if (shouldAddToExpenseLedger({
            ...newTransaction,
            amount: parseFloat(transaction.amount)
          })) {
            await addToExpenseLedger({
              ...newTransaction,
              amount: parseFloat(transaction.amount)
            });
          }
          
          setIsTransactionModalOpen(false);
          setTransaction({ description: "", amount: "", type: "CASH_IN", category: "" });
          await fetchCashLedger();
        } else {
          const error = await res.json();
          alert(`Failed to add transaction: ${error.error || 'Unknown error'}`);
        }
      }
    } catch (err) {
      alert("Error processing transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditTransaction = (tx: Transaction) => {
    setIsEditMode(true);
    setEditingTransactionId(tx.id);
    setTransaction({
      description: tx.description,
      amount: tx.amount.toString(),
      type: tx.type,
      category: tx.category,
    });
    setIsTransactionModalOpen(true);
  };

  const handleDeleteTransaction = async (id: number) => {
    setIsSubmitting(true);
    try {
      // First, get the transaction data to find the matching expense
      const transactionToDelete = dailySummaries
        .flatMap(summary => summary.transactions)
        .find(tx => tx.id === id);

      // Remove from expense ledger if applicable - exclude inventory purchases
      if (transactionToDelete && shouldAddToExpenseLedger(transactionToDelete)) {
        await removeFromExpenseLedger(transactionToDelete);
      }
      
      const res = await fetch("/api/cash-ledger", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setConfirmDelete(null);
        await fetchCashLedger();
      } else {
        const error = await res.json();
        alert(`Failed to delete transaction: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert("Error deleting transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddBalance = async () => {
    if (!balanceForm.amount) {
      alert("Please enter an amount");
      return;
    }

    setIsSubmitting(true);
    try {
      const localDate = new Date(balanceForm.date);
      const formattedDate = localDate.toISOString().split('T')[0];
      
      console.log("Setting opening balance for date:", formattedDate, "Amount:", balanceForm.amount);
      
      const res = await fetch("/api/daily-sales/daily-opening-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: formattedDate,
          openingBalance: parseFloat(balanceForm.amount),
          description: `Opening balance for ${localDate.toLocaleDateString()}`,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        console.log("Successfully set balance:", result);
        
        setIsBalanceModalOpen(false);
        setBalanceForm({ date: new Date().toISOString().split('T')[0], amount: "" });
        await fetchCashLedger();
      } else {
        const error = await res.json();
        alert(`Failed to set opening balance: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Error setting opening balance:", err);
      alert("Error setting opening balance");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-set today's opening balance from previous day's closing balance
  useEffect(() => {
    if (dailySummaries.length > 0 && !loading) {
      const today = new Date().toISOString().split('T')[0];
      const todaySummary = dailySummaries.find(s => s.date === today);
      
      if (!todaySummary?.hasOpeningBalance) {
        const previousDayBalance = getPreviousDayClosingBalance(today);
        if (previousDayBalance > 0) {
          // Auto-set today's opening balance from previous day's closing
          const autoSetOpeningBalance = async () => {
            try {
              const res = await fetch("/api/daily-sales/daily-opening-balance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  date: today,
                  openingBalance: previousDayBalance,
                  description: `Auto-set from previous day's closing balance`,
                }),
              });

              if (res.ok) {
                console.log("Auto-set opening balance:", previousDayBalance);
                await fetchCashLedger(); // Refresh to show the updated balance
              }
            } catch (err) {
              console.error("Error auto-setting opening balance:", err);
            }
          };
          
          autoSetOpeningBalance();
        }
      }
    }
  }, [dailySummaries, loading]);

  const exportToCSV = () => {
    const headers = ["Date", "Time", "Description", "Category", "Type", "Amount", "Balance", "Notes"];
    const rows: string[][] = [];
    
    dailySummaries.forEach(summary => {
      let balance = summary.openingBalance;
      summary.transactions.forEach(tx => {
        const isExcluded = isExcludedFromCashOut(tx);
        const notes = isExcluded ? "Inventory/Purchase - Excluded from totals" : "";
        
        // Only update balance for non-excluded transactions
        if (!isExcluded) {
          if (tx.type === "CASH_IN") {
            balance += tx.amount;
          } else {
            balance -= tx.amount;
          }
        }
        
        rows.push([
          summary.date,
          new Date(tx.timestamp).toLocaleTimeString(),
          tx.description,
          tx.category,
          tx.type === "CASH_IN" ? "Cash In" : "Cash Out",
          tx.amount.toString(),
          balance.toString(),
          notes,
        ]);
      });
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const toggleDay = (date: string) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDays(newExpanded);
  };

  const todaySummary = dailySummaries.find(
    s => s.date === new Date().toISOString().split('T')[0]
  ) || {
    date: new Date().toISOString().split('T')[0],
    openingBalance: 0,
    totalCashIn: 0,
    totalCashOut: 0,
    closingBalance: 0,
    transactions: [],
    hasOpeningBalance: false,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-slate-700">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Cash Flow</h1>
              <p className="text-slate-600 mt-1 text-sm sm:text-base">Track your daily cash flow</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3 w-full md:w-auto">
              <button
                onClick={() => setIsBalanceModalOpen(true)}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm sm:text-base"
              >
                Set Balance
              </button>
              <button
                onClick={() => {
                  setIsEditMode(false);
                  setEditingTransactionId(null);
                  setTransaction({ description: "", amount: "", type: "CASH_IN", category: "" });
                  setIsTransactionModalOpen(true);
                }}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                Add
              </button>
              <button
                onClick={exportToCSV}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* Opening Balance Info */}
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-1">Today's Opening Balance</h3>
              <div className="text-2xl sm:text-3xl font-bold text-indigo-600">
                Ksh {todaySummary.openingBalance.toLocaleString()}
              </div>
              {todaySummary.hasOpeningBalance && todaySummary.openingBalance > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  {todaySummary.openingBalance === getPreviousDayClosingBalance(todaySummary.date) 
                    ? "✓ Auto-set from previous day's closing balance"
                    : "Manually set opening balance"
                  }
                </p>
              )}
            </div>
            <button
              onClick={() => setIsBalanceModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm flex items-center gap-2 shadow-md"
            >
              {todaySummary.hasOpeningBalance ? (
                <>
                  <Edit2 className="w-4 h-4" />
                  Update Balance
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Set Opening Balance
                </>
              )}
            </button>
          </div>
          {!todaySummary.hasOpeningBalance && (
            <p className="text-xs sm:text-sm text-slate-600 mt-2">
              💡 Opening balance will be auto-set from previous day's closing balance
            </p>
          )}
        </div>

        {/* Today's Summary */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-4">
            Today - {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            <div className="bg-blue-50 p-3 sm:p-4 rounded-lg border-2 border-blue-200">
              <div className="text-xs text-slate-600 font-medium">Opening</div>
              <div className="text-base sm:text-xl font-bold text-slate-800 mt-1">
                Ksh {todaySummary.openingBalance.toLocaleString()}
              </div>
            </div>
            
            <div className="bg-green-50 p-3 sm:p-4 rounded-lg border-2 border-green-200">
              <div className="text-xs text-slate-600 font-medium">Cash In</div>
              <div className="text-base sm:text-xl font-bold text-green-600 mt-1">
                +{todaySummary.totalCashIn.toLocaleString()}
              </div>
            </div>
            
            <div className="bg-red-50 p-3 sm:p-4 rounded-lg border-2 border-red-200">
              <div className="text-xs text-slate-600 font-medium">Cash Out</div>
              <div className="text-base sm:text-xl font-bold text-red-600 mt-1">
                -{todaySummary.totalCashOut.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                (Excludes production & inventory costs)
              </div>
            </div>
            
            <div className="bg-indigo-600 p-3 sm:p-4 rounded-lg text-white">
              <div className="text-xs font-medium opacity-90">Closing</div>
              <div className="text-base sm:text-xl font-bold mt-1">
                Ksh {todaySummary.closingBalance.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Daily List */}
        <div className="space-y-3">
          {dailySummaries.map((summary) => {
            const isExpanded = expandedDays.has(summary.date);
            const isToday = summary.date === new Date().toISOString().split('T')[0];
            
            return (
              <div key={summary.date} className={`bg-white rounded-xl shadow-md overflow-hidden ${isToday ? 'ring-2 ring-blue-400' : ''}`}>
                <button
                  onClick={() => toggleDay(summary.date)}
                  className={`w-full px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-slate-50 transition-colors ${isToday ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                    <ChevronRight className={`w-4 h-4 sm:w-5 sm:h-5 text-slate-600 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                    <div className="text-left min-w-0">
                      <h3 className="text-sm sm:text-lg font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                        <span className="truncate">{new Date(summary.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}</span>
                        {isToday && (
                          <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full flex-shrink-0">
                            TODAY
                          </span>
                        )}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500">
                        {summary.transactions.length} transaction(s)
                        {!summary.hasOpeningBalance && (
                          <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                            No Balance
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-6 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-slate-500">Cash In</div>
                      <div className="text-sm font-bold text-green-600">+{summary.totalCashIn.toLocaleString()}</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-slate-500">Cash Out</div>
                      <div className="text-sm font-bold text-red-600">-{summary.totalCashOut.toLocaleString()}</div>
                    </div>
                    <div className="text-right min-w-[80px] sm:min-w-[120px]">
                      <div className="text-xs text-slate-500">Closing</div>
                      <div className="text-sm sm:text-lg font-bold text-indigo-600">
                        {summary.closingBalance.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-200">
                    <div className="px-3 sm:px-6 py-3 sm:py-4 bg-slate-50 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                      <div>
                        <div className="text-xs text-slate-600">Opening</div>
                        <div className="text-sm sm:text-lg font-bold text-slate-800">Ksh {summary.openingBalance.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-600">Cash In</div>
                        <div className="text-sm sm:text-lg font-bold text-green-600">+{summary.totalCashIn.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-600">Cash Out</div>
                        <div className="text-sm sm:text-lg font-bold text-red-600">-{summary.totalCashOut.toLocaleString()}</div>
                        <div className="text-xs text-slate-500">(excl. production & inventory)</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-600">Closing</div>
                        <div className="text-sm sm:text-lg font-bold text-indigo-600">Ksh {summary.closingBalance.toLocaleString()}</div>
                      </div>
                    </div>

                    {summary.transactions.length > 0 ? (
                      <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-slate-100">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Time</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Description</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Category</th>
                                <th className="px-44 py-3 text-left text-xs font-semibold text-slate-700">Type</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Amount</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Balance</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {summary.transactions.map((tx, index) => {
                                const isExcluded = isExcludedFromCashOut(tx);
                                let runningBalance = summary.openingBalance;
                                
                                // Calculate running balance excluding excluded transactions
                                for (let i = 0; i <= index; i++) {
                                  const t = summary.transactions[i];
                                  if (!isExcludedFromCashOut(t)) {
                                    if (t.type === "CASH_IN") {
                                      runningBalance += t.amount;
                                    } else {
                                      runningBalance -= t.amount;
                                    }
                                  }
                                }
                                
                                return (
                                  <tr key={tx.id} className={`hover:bg-blue-50 ${isExcluded ? 'bg-orange-50' : ''}`}>
                                    <td className="px-4 py-3 text-sm text-slate-600">
                                      {new Date(tx.timestamp).toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                                      {tx.description}
                                      {isExcluded && (
                                        <span className="ml-2 text-xs text-orange-600">(Inventory/Purchase)</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600">
                                      <span className={`px-2 py-1 rounded text-xs ${
                                        isExcluded 
                                          ? 'bg-orange-100 text-orange-700 border border-orange-300' 
                                          : 'bg-slate-100 text-slate-700'
                                      }`}>
                                        {tx.category}
                                        {tx.type === "CASH_OUT" && !isExcluded && (
                                          <span className="ml-1 text-xs">💰</span>
                                        )}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                        tx.type === "CASH_IN" ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                      }`}>
                                        {tx.type === "CASH_IN" ? "Cash In" : "Cash Out"}
                                      </span>
                                    </td>
                                    <td className={`px-4 py-3 text-sm font-bold text-right ${
                                      tx.type === "CASH_IN" ? 'text-green-600' : 'text-red-600'
                                    } ${isExcluded ? 'opacity-70' : ''}`}>
                                      {tx.type === "CASH_IN" ? '+' : '-'}Ksh {tx.amount.toLocaleString()}
                                      {isExcluded && (
                                        <div className="text-xs text-orange-600 font-normal">(excluded from totals)</div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-bold text-indigo-600 text-right">
                                      {!isExcluded ? `Ksh ${runningBalance.toLocaleString()}` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                      <div className="flex items-center justify-center gap-2">
                                        <button
                                          onClick={() => handleEditTransaction(tx)}
                                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                          title="Edit"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => setConfirmDelete(tx.id)}
                                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                          title="Delete"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden divide-y divide-slate-200">
                          {summary.transactions.map((tx, index) => {
                            const isExcluded = isExcludedFromCashOut(tx);
                            let runningBalance = summary.openingBalance;
                            
                            // Calculate running balance excluding excluded transactions
                            for (let i = 0; i <= index; i++) {
                              const t = summary.transactions[i];
                              if (!isExcludedFromCashOut(t)) {
                                if (t.type === "CASH_IN") {
                                  runningBalance += t.amount;
                                } else {
                                  runningBalance -= t.amount;
                                }
                              }
                            }
                            
                            return (
                              <div key={tx.id} className={`p-3 sm:p-4 hover:bg-blue-50 ${isExcluded ? 'bg-orange-50' : ''}`}>
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-slate-800 text-sm mb-1 truncate">
                                      {tx.description}
                                      {isExcluded && (
                                        <span className="ml-2 text-xs text-orange-600">(Inventory/Purchase)</span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                      <span className={`px-2 py-1 rounded ${
                                        isExcluded 
                                          ? 'bg-orange-100 text-orange-700 border border-orange-300' 
                                          : 'bg-slate-100 text-slate-700'
                                      }`}>
                                        {tx.category}
                                        {tx.type === "CASH_OUT" && !isExcluded && (
                                          <span className="ml-1">💰</span>
                                        )}
                                      </span>
                                      <span className={`px-2 py-1 rounded ${
                                        tx.type === "CASH_IN" ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                      }`}>
                                        {tx.type === "CASH_IN" ? "Cash In" : "Cash Out"}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 ml-2 flex-shrink-0">
                                    <button
                                      onClick={() => handleEditTransaction(tx)}
                                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setConfirmDelete(tx.id)}
                                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-slate-500">
                                    {new Date(tx.timestamp).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                  <div className="text-right">
                                    <div className={`font-bold ${tx.type === "CASH_IN" ? 'text-green-600' : 'text-red-600'} ${isExcluded ? 'opacity-70' : ''}`}>
                                      {tx.type === "CASH_IN" ? '+' : '-'}Ksh {tx.amount.toLocaleString()}
                                      {isExcluded && (
                                        <div className="text-xs text-orange-600 font-normal">(excluded from totals)</div>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {!isExcluded ? `Balance: Ksh ${runningBalance.toLocaleString()}` : 'Excluded from balance'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="px-3 sm:px-6 py-6 sm:py-8 text-center text-slate-500">
                        <p className="text-sm">No transactions recorded for this day</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {dailySummaries.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg p-8 sm:p-12 text-center">
            <div className="text-5xl sm:text-6xl mb-4">📊</div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-700 mb-2">No Transactions Yet</h3>
            <p className="text-slate-500 text-sm sm:text-base">Add your first transaction to get started</p>
          </div>
        )}
      </div>

      {/* Transaction Modal */}
      {isTransactionModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
                {isEditMode ? 'Edit Transaction' : 'Add Transaction'}
              </h2>
              <button 
                onClick={() => {
                  setIsTransactionModalOpen(false);
                  setIsEditMode(false);
                  setEditingTransactionId(null);
                  setTransaction({ description: "", amount: "", type: "CASH_IN", category: "" });
                }} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description *</label>
                <input
                  type="text"
                  value={transaction.description}
                  onChange={(e) => setTransaction({...transaction, description: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                  placeholder="e.g., Customer payment"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Amount (Ksh) *</label>
                <input
                  type="number"
                  value={transaction.amount}
                  onChange={(e) => setTransaction({...transaction, amount: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Type *</label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    onClick={() => setTransaction({...transaction, type: "CASH_IN", category: ""})}
                    className={`px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium border-2 text-sm sm:text-base ${
                      transaction.type === "CASH_IN"
                        ? 'bg-green-100 border-green-500 text-green-700'
                        : 'border-slate-300 text-slate-600'
                    }`}
                  >
                    Cash In
                  </button>
                  <button
                    onClick={() => setTransaction({...transaction, type: "CASH_OUT", category: ""})}
                    className={`px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium border-2 text-sm sm:text-base ${
                      transaction.type === "CASH_OUT"
                        ? 'bg-red-100 border-red-500 text-red-700'
                        : 'border-slate-300 text-slate-600'
                    }`}
                  >
                    Cash Out
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Category *</label>
                <select
                  value={transaction.category}
                  onChange={(e) => setTransaction({...transaction, category: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm sm:text-base"
                >
                  <option value="">Select category</option>
                  {(transaction.type === "CASH_IN" ? INCOME_CATEGORIES : ALL_EXPENSE_CATEGORIES).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {transaction.type === "CASH_OUT" && (
                  <p className="text-xs text-slate-500 mt-1">
                    {PRODUCTION_CATEGORIES.includes(transaction.category)
                      ? "This will be tracked as production cost (excluded from cash totals)"
                      : transaction.category === INVENTORY_PURCHASE_CATEGORY
                        ? "This will be tracked as inventory purchase (excluded from cash totals)"
                        : "This will be added to expense ledger"}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
              <button
                onClick={() => {
                  setIsTransactionModalOpen(false);
                  setIsEditMode(false);
                  setEditingTransactionId(null);
                  setTransaction({ description: "", amount: "", type: "CASH_IN", category: "" });
                }}
                className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTransaction}
                disabled={isSubmitting}
                className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {isEditMode ? 'Updating...' : 'Adding...'}
                  </>
                ) : (
                  isEditMode ? 'Update' : 'Add'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Opening Balance Modal */}
      {isBalanceModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Set Opening Balance</h2>
              <button onClick={() => setIsBalanceModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date *</label>
                <input
                  type="date"
                  value={balanceForm.date}
                  onChange={(e) => setBalanceForm({...balanceForm, date: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm sm:text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Opening Balance (Ksh) *</label>
                <input
                  type="number"
                  value={balanceForm.amount}
                  onChange={(e) => setBalanceForm({...balanceForm, amount: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm sm:text-base"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
              <button
                onClick={() => setIsBalanceModalOpen(false)}
                className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBalance}
                disabled={isSubmitting}
                className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Setting...
                  </>
                ) : (
                  'Set Balance'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-3 sm:mb-4">Confirm Delete</h2>
            <p className="text-slate-600 mb-4 sm:mb-6 text-sm sm:text-base">
              Are you sure you want to delete this transaction? This action cannot be undone.
            </p>
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={isSubmitting}
                className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium disabled:opacity-50 text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteTransaction(confirmDelete)}
                disabled={isSubmitting}
                className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyTransactionsTracker;