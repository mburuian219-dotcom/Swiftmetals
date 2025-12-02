"use client";

import React, { useEffect, useState } from "react";
import { Download, Plus, ChevronRight, X, Edit2, Trash2, Calendar, DollarSign } from "lucide-react";

interface Transaction {
  id: number;
  description: string;
  amount: number;
  type: "CASH_IN" | "CASH_OUT";
  category: string;
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

const PettyCashManager = () => {
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set([new Date().toISOString().split('T')[0]]));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{type: 'transaction' | 'day' | 'balance', id?: number, date?: string} | null>(null);

  // Simplified categories - only expenses for petty cash
  const EXPENSE_CATEGORIES = [
    "Administrative",
    "Office Supplies",
    "Transport",
    "Utilities",
    "Meals & Entertainment",
    "Miscellaneous"
  ];

  const INCOME_CATEGORIES = [
    "Reimbursement",
    "Cash Top-up",
    "Other Income"
  ];

  const [transaction, setTransaction] = useState({
    description: "",
    amount: "",
    type: "CASH_OUT" as "CASH_IN" | "CASH_OUT",
    category: "",
  });

  const [balanceForm, setBalanceForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: "",
  });

  // Fetch data
  useEffect(() => {
    fetchPettyCashData();
  }, []);

  const fetchPettyCashData = async () => {
    setLoading(true);
    try {
      // Fetch petty cash transactions only
      const [transactionsRes, balancesRes] = await Promise.all([
        fetch("/api/cash-ledger?type=petty_cash"),
        fetch("/api/daily-sales/daily-opening-balance")
      ]);

      if (!transactionsRes.ok) throw new Error("Failed to fetch transactions");
      
      const transactions = await transactionsRes.json();
      const balances = balancesRes.ok ? await balancesRes.json() : [];
      
      processPettyCashData(transactions, balances);
    } catch (err) {
      console.error("Error fetching data:", err);
      alert("Failed to load petty cash data");
    } finally {
      setLoading(false);
    }
  };

  const processPettyCashData = (transactions: any[], balances: any[]) => {
    const balanceMap = new Map<string, number>();
    balances.forEach((balance: any) => {
      if (balance.date) {
        const date = new Date(balance.date).toISOString().split('T')[0];
        balanceMap.set(date, parseFloat(balance.openingBalance) || 0);
      }
    });

    const summariesMap = new Map<string, DailySummary>();
    
    // Process transactions - filter out any inventory/production entries
    const pettyCashTransactions = transactions.filter(tx => 
      !tx.referenceSource?.includes('inventory') && 
      !tx.category?.includes('Production') &&
      !tx.category?.includes('Inventory')
    );

    pettyCashTransactions.forEach((entry: any) => {
      const dateValue = entry.date;
      if (!dateValue) return;
      
      const date = new Date(dateValue).toISOString().split('T')[0];
      
      if (!summariesMap.has(date)) {
        const openingBal = balanceMap.get(date) || 0;
        
        summariesMap.set(date, {
          date,
          openingBalance: openingBal,
          totalCashIn: 0,
          totalCashOut: 0,
          closingBalance: openingBal,
          transactions: [],
          hasOpeningBalance: balanceMap.has(date),
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
        timestamp: dateValue,
      };
      
      summary.transactions.push(tx);
      
      // Update totals
      if (tx.type === "CASH_IN") {
        summary.totalCashIn += amount;
      } else {
        summary.totalCashOut += amount;
      }
    });
    
    // Add days that only have opening balances
    balances.forEach((balance: any) => {
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
    
    // Calculate closing balances
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
  };

  // Get previous day's closing balance
  const getPreviousDayClosingBalance = (currentDate: string): number => {
    const current = new Date(currentDate);
    const previousDay = new Date(current);
    previousDay.setDate(previousDay.getDate() - 1);
    const previousDayStr = previousDay.toISOString().split('T')[0];
    
    const previousSummary = dailySummaries.find(s => s.date === previousDayStr);
    return previousSummary?.closingBalance || 0;
  };

  // Transaction handlers
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
            referenceType: "petty_cash",
          }),
        });

        if (res.ok) {
          setIsTransactionModalOpen(false);
          resetTransactionForm();
          await fetchPettyCashData();
        } else {
          const error = await res.json();
          alert(`Failed to update: ${error.error || 'Unknown error'}`);
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
            referenceType: "petty_cash",
          }),
        });

        if (res.ok) {
          setIsTransactionModalOpen(false);
          resetTransactionForm();
          await fetchPettyCashData();
        } else {
          const error = await res.json();
          alert(`Failed to add: ${error.error || 'Unknown error'}`);
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
      const res = await fetch("/api/cash-ledger", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setConfirmAction(null);
        await fetchPettyCashData();
      } else {
        const error = await res.json();
        alert(`Failed to delete: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert("Error deleting transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  // New: Delete all transactions for a day
  const handleDeleteDayTransactions = async (date: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/cash-ledger`, {
        method: "DELETE",
      });

      if (res.ok) {
        setConfirmAction(null);
        await fetchPettyCashData();
      } else {
        const error = await res.json();
        alert(`Failed to delete day's transactions: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert("Error deleting day's transactions");
    } finally {
      setIsSubmitting(false);
    }
  };

  // New: Delete opening balance for a day
  const handleDeleteOpeningBalance = async (date: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/daily-sales/daily-opening-balance", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });

      if (res.ok) {
        setConfirmAction(null);
        await fetchPettyCashData();
      } else {
        const error = await res.json();
        alert(`Failed to delete opening balance: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert("Error deleting opening balance");
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
      
      const res = await fetch("/api/daily-sales/daily-opening-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: formattedDate,
          openingBalance: parseFloat(balanceForm.amount),
          description: `Petty cash opening balance`,
        }),
      });

      if (res.ok) {
        setIsBalanceModalOpen(false);
        setBalanceForm({ date: new Date().toISOString().split('T')[0], amount: "" });
        await fetchPettyCashData();
      } else {
        const error = await res.json();
        alert(`Failed to set balance: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert("Error setting opening balance");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-set today's opening balance
  useEffect(() => {
    if (dailySummaries.length > 0 && !loading) {
      const today = new Date().toISOString().split('T')[0];
      const todaySummary = dailySummaries.find(s => s.date === today);
      
      if (!todaySummary?.hasOpeningBalance) {
        const previousDayBalance = getPreviousDayClosingBalance(today);
        if (previousDayBalance > 0) {
          const autoSetOpeningBalance = async () => {
            try {
              await fetch("/api/daily-sales/daily-opening-balance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  date: today,
                  openingBalance: previousDayBalance,
                  description: `Auto-set from previous day`,
                }),
              });
              await fetchPettyCashData();
            } catch (err) {
              console.error("Error auto-setting balance:", err);
            }
          };
          
          autoSetOpeningBalance();
        }
      }
    }
  }, [dailySummaries, loading]);

  const exportToCSV = () => {
    const headers = ["Date", "Time", "Description", "Category", "Type", "Amount", "Balance"];
    const rows: string[][] = [];
    
    dailySummaries.forEach(summary => {
      let balance = summary.openingBalance;
      summary.transactions.forEach(tx => {
        if (tx.type === "CASH_IN") {
          balance += tx.amount;
        } else {
          balance -= tx.amount;
        }
        
        rows.push([
          summary.date,
          new Date(tx.timestamp).toLocaleTimeString(),
          tx.description,
          tx.category,
          tx.type === "CASH_IN" ? "Cash In" : "Cash Out",
          tx.amount.toString(),
          balance.toString(),
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
    a.download = `petty-cash-${new Date().toISOString().split('T')[0]}.csv`;
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

  const resetTransactionForm = () => {
    setTransaction({
      description: "",
      amount: "",
      type: "CASH_OUT",
      category: "",
    });
    setIsEditMode(false);
    setEditingTransactionId(null);
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
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg font-medium text-gray-700">Loading petty cash...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Petty Cash Ledger</h1>
              <p className="text-gray-600 mt-1">Track and manage petty cash expenses</p>
            </div>
            <div className="flex flex-wrap gap-3 w-full md:w-auto">
              <button
                onClick={() => setIsBalanceModalOpen(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2"
              >
                <DollarSign className="w-4 h-4" />
                Set Balance
              </button>
              <button
                onClick={() => {
                  resetTransactionForm();
                  setIsTransactionModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Expense
              </button>
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Today's Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Today's Overview</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Opening Balance</span>
                <span className="text-xl font-bold text-gray-900">
                  Ksh {todaySummary.openingBalance.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Cash In</span>
                <span className="text-xl font-bold text-green-600">
                  +Ksh {todaySummary.totalCashIn.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Cash Out</span>
                <span className="text-xl font-bold text-red-600">
                  -Ksh {todaySummary.totalCashOut.toLocaleString()}
                </span>
              </div>
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-gray-800 font-semibold">Closing Balance</span>
                  <span className="text-2xl font-bold text-blue-600">
                    Ksh {todaySummary.closingBalance.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setTransaction({...transaction, type: "CASH_OUT", category: "Office Supplies"});
                  setIsTransactionModalOpen(true);
                }}
                className="w-full px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium text-left flex items-center gap-3"
              >
                <Plus className="w-5 h-5" />
                <div>
                  <div className="font-semibold">Add Office Expense</div>
                  <div className="text-sm text-blue-600">Stationery, supplies, etc.</div>
                </div>
              </button>
              <button
                onClick={() => setIsBalanceModalOpen(true)}
                className="w-full px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-medium text-left flex items-center gap-3"
              >
                <DollarSign className="w-5 h-5" />
                <div>
                  <div className="font-semibold">Update Balance</div>
                  <div className="text-sm text-green-600">Set or adjust opening balance</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Daily Summaries */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-800">Daily Ledger</h2>
          </div>
          
          <div className="divide-y divide-gray-200">
            {dailySummaries.map((summary) => {
              const isExpanded = expandedDays.has(summary.date);
              const isToday = summary.date === new Date().toISOString().split('T')[0];
              
              return (
                <div key={summary.date} className={`${isToday ? 'bg-blue-50' : ''}`}>
                  <button
                    onClick={() => toggleDay(summary.date)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">
                            {new Date(summary.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </h3>
                          {isToday && (
                            <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                              TODAY
                            </span>
                          )}
                          {!summary.hasOpeningBalance && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                              No Opening Balance
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {summary.transactions.length} transactions
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Balance</div>
                        <div className="font-bold text-gray-900">
                          Ksh {summary.closingBalance.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-6 py-4 bg-gray-50 border-t">
                      {/* Day Actions */}
                      <div className="flex gap-2 mb-4">
                        <button
                          onClick={() => setConfirmAction({type: 'day', date: summary.date})}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Delete All Today's Transactions
                        </button>
                        {summary.hasOpeningBalance && (
                          <button
                            onClick={() => setConfirmAction({type: 'balance', date: summary.date})}
                            className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                          >
                            Remove Opening Balance
                          </button>
                        )}
                      </div>

                      {/* Transactions */}
                      {summary.transactions.length > 0 ? (
                        <div className="space-y-3">
                          {summary.transactions.map((tx, index) => {
                            let runningBalance = summary.openingBalance;
                            for (let i = 0; i <= index; i++) {
                              const t = summary.transactions[i];
                              if (t.type === "CASH_IN") {
                                runningBalance += t.amount;
                              } else {
                                runningBalance -= t.amount;
                              }
                            }

                            return (
                              <div key={tx.id} className="bg-white rounded-lg p-4 border">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-medium text-gray-900">{tx.description}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className={`px-2 py-1 text-xs rounded ${
                                        tx.type === "CASH_IN" 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-red-100 text-red-800'
                                      }`}>
                                        {tx.type === "CASH_IN" ? "Cash In" : "Cash Out"}
                                      </span>
                                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                                        {tx.category}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {new Date(tx.timestamp).toLocaleTimeString()}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <div className="text-right">
                                      <div className={`font-bold ${
                                        tx.type === "CASH_IN" ? 'text-green-600' : 'text-red-600'
                                      }`}>
                                        {tx.type === "CASH_IN" ? '+' : '-'}Ksh {tx.amount.toLocaleString()}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        Balance: Ksh {runningBalance.toLocaleString()}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleEditTransaction(tx)}
                                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setConfirmAction({type: 'transaction', id: tx.id})}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          No transactions recorded for this day
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modals */}
        {isTransactionModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {isEditMode ? 'Edit Transaction' : 'Add Petty Cash Transaction'}
                </h2>
                <button onClick={() => {
                  setIsTransactionModalOpen(false);
                  resetTransactionForm();
                }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <input
                    type="text"
                    value={transaction.description}
                    onChange={(e) => setTransaction({...transaction, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="What was this expense/income for?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount (Ksh) *
                  </label>
                  <input
                    type="number"
                    value={transaction.amount}
                    onChange={(e) => setTransaction({...transaction, amount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setTransaction({...transaction, type: "CASH_IN", category: ""})}
                      className={`px-4 py-3 rounded-lg font-medium border ${
                        transaction.type === "CASH_IN"
                          ? 'bg-green-100 border-green-500 text-green-700'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Cash In
                    </button>
                    <button
                      onClick={() => setTransaction({...transaction, type: "CASH_OUT", category: ""})}
                      className={`px-4 py-3 rounded-lg font-medium border ${
                        transaction.type === "CASH_OUT"
                          ? 'bg-red-100 border-red-500 text-red-700'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Cash Out
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    value={transaction.category}
                    onChange={(e) => setTransaction({...transaction, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a category</option>
                    {(transaction.type === "CASH_IN" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setIsTransactionModalOpen(false);
                    resetTransactionForm();
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTransaction}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing...' : isEditMode ? 'Update' : 'Add Transaction'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isBalanceModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Set Opening Balance</h2>
                <button onClick={() => setIsBalanceModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={balanceForm.date}
                    onChange={(e) => setBalanceForm({...balanceForm, date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Opening Balance (Ksh) *
                  </label>
                  <input
                    type="number"
                    value={balanceForm.amount}
                    onChange={(e) => setBalanceForm({...balanceForm, amount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsBalanceModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddBalance}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                >
                  {isSubmitting ? 'Setting...' : 'Set Balance'}
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmAction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Confirm Action</h2>
              
              {confirmAction.type === 'transaction' && (
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete this transaction? This action cannot be undone.
                </p>
              )}
              
              {confirmAction.type === 'day' && (
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete ALL transactions for this day? This action cannot be undone.
                </p>
              )}
              
              {confirmAction.type === 'balance' && (
                <p className="text-gray-600 mb-6">
                  Are you sure you want to remove the opening balance for this day? This will affect all calculations for this day.
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (confirmAction.type === 'transaction' && confirmAction.id) {
                      handleDeleteTransaction(confirmAction.id);
                    } else if (confirmAction.type === 'day' && confirmAction.date) {
                      handleDeleteDayTransactions(confirmAction.date);
                    } else if (confirmAction.type === 'balance' && confirmAction.date) {
                      handleDeleteOpeningBalance(confirmAction.date);
                    }
                  }}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PettyCashManager;