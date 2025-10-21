"use client";

import { useEffect, useState } from "react";
import { Download, ArrowUpRight, ArrowDownRight, X, Edit2, Trash2, Save, XCircle } from "lucide-react";

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
  details?: any;
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
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedTransaction, setSelectedTransaction] = useState<CashTransaction | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CashTransaction>>({});

  useEffect(() => {
    fetchAllTransactions();
  }, []);

  const fetchAllTransactions = async (from?: string, to?: string, cat?: string) => {
    setLoading(true);
    setError(null);

    try {
      let allTransactions: CashTransaction[] = [];

      // Fetch Sales
      const salesRes = await fetch("/api/sales", { cache: "no-store" });
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
              details: sale,
            };
          })
          .filter((txn: CashTransaction) => txn.amount > 0);

        allTransactions.push(...transformedSales);
      }

      // Fetch Cash Ledger
      const ledgerRes = await fetch("/api/cash-ledger", { cache: "no-store" });
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
              details: entry,
            };
          })
          .filter((txn: CashTransaction) => txn.amount > 0);
        allTransactions.push(...transformedLedger);
      }

      // Fetch Expenses
      let expenseUrl = "/api/expenses";
      const params = new URLSearchParams();
      if (from) params.append("from", from);
      if (to) params.append("to", to);
      const queryStr = params.toString();
      if (queryStr) expenseUrl += "?" + queryStr;

      const expenseRes = await fetch(expenseUrl, { cache: "no-store" });
      if (expenseRes.ok) {
        const expenseData = await expenseRes.json();
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
            details: expense,
          }))
          .filter((txn: CashTransaction) => txn.amount > 0);
        
        allTransactions.push(...transformedExpenses);
      }

      // Fetch Restocks from Cash Ledger
      const restockLedgerRes = await fetch("/api/cash-ledger?category=Inventory Purchase", { cache: "no-store" });
      if (restockLedgerRes.ok) {
        const restockLedgerData = await restockLedgerRes.json();
        const restockEntries = restockLedgerData.entries || [];

        const transformedRestocks = restockEntries.map((entry: any) => ({
          id: `ledger-${entry.id}`,
          date: entry.date || new Date().toISOString(),
          description: entry.description || "Inventory Purchase",
          type: "OUTFLOW" as const,
          category: "Inventory Purchase",
          amount: Number(entry.amount || 0),
          runningBalance: 0,
          relatedTo: entry.relatedTo || "",
          affectedAccounts: entry.affectedAccounts || "",
          details: entry,
        }));

        allTransactions.push(...transformedRestocks);
      }

      // Apply filters
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

      allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate running balance
      let runningBalance = 0;
      const txnsWithBalance = allTransactions.map((txn) => {
        if (txn.type === "INFLOW") runningBalance += txn.amount;
        else runningBalance -= txn.amount;
        return { ...txn, runningBalance };
      });

      setTransactions(txnsWithBalance);
      setCashBalance(runningBalance);
    } catch (err) {
      console.error("Error in fetchAllTransactions:", err);
      setError("Failed to load cash ledger");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (txn: CashTransaction) => {
    setEditingId(txn.id);
    setEditForm({
      date: txn.date,
      description: txn.description,
      amount: txn.amount,
      category: txn.category,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    
    try {
      const [type, id] = editingId.split("-");
      let endpoint = "";
      let method = "PUT";
      
      if (type === "expense") {
        endpoint = `/api/expenses/${id}`;
        method = "PATCH";
      } else if (type === "sale") {
        endpoint = `/api/sales/${id}`;
        method = "PATCH";
      } else if (type === "ledger") {
        endpoint = `/api/cash-ledger`;
        method = "PUT";
      } else if (type === "restock") {
        endpoint = `/api/restock/${id}`;
        method = "PATCH";
      }

      const payload = type === "ledger" 
        ? { id: parseInt(id), ...editForm }
        : editForm;

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchAllTransactions(dateFrom, dateTo, category);
        setEditingId(null);
        setEditForm({});
      } else {
        const errorData = await res.json();
        alert(`Failed to save: ${errorData.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Error saving:", err);
      alert("Failed to save changes");
    }
  };

  const handleDelete = async (txn: CashTransaction) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    try {
      const [type, id] = txn.id.split("-");
      let endpoint = "";
      let method = "DELETE";
      let body: any = {};
      
      if (type === "expense") {
        endpoint = `/api/expenses/`;
      } else if (type === "sale") {
        endpoint = `/api/sales/${id}`;
      } else if (type === "ledger") {
        endpoint = `/api/cash-ledger`;
        body = { id: parseInt(id) };
      } else if (type === "restock") {
        endpoint = `/api/restock/`;
      }

      const fetchOptions: RequestInit = {
        method,
        headers: { "Content-Type": "application/json" },
      };

      if (type === "ledger") {
        fetchOptions.body = JSON.stringify(body);
      }

      const res = await fetch(endpoint, fetchOptions);

      if (res.ok) {
        await fetchAllTransactions(dateFrom, dateTo, category);
      } else {
        const errorData = await res.json();
        alert(`Failed to delete: ${errorData.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Error deleting:", err);
      alert("Failed to delete transaction");
    }
  };

  const handleDownload = () => {
    if (propOnDownload) {
      propOnDownload();
      return;
    }

    const headers = ["Date", "Description", "Category", "Type", "Amount", "Running Balance", "Related To", "Accounts Affected"];
    const rows = transactions.map((txn) => [
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
      ...rows.map((row) => row.map((cell) => (typeof cell === "string" && cell.includes(",") ? `"${cell}"` : cell)).join(",")),
    ].join("\n");

    const element = document.createElement("a");
    element.setAttribute("href", "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent));
    element.setAttribute("download", `cash-ledger-${new Date().toISOString().split("T")[0]}.csv`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Loading transactions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button onClick={() => fetchAllTransactions()} className="mt-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
            >
              <option value="all">All Categories</option>
              <option value="Sales Revenue">Sales Revenue</option>
              <option value="Inventory Purchase">Inventory Purchase</option>
              <option value="Operating Expense">Operating Expense</option>
            </select>
          </div>
          <div className="flex gap-2 items-end">
            <button
              onClick={() => fetchAllTransactions(dateFrom, dateTo, category)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm"
            >
              Filter
            </button>
            <button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setCategory("all");
                fetchAllTransactions();
              }}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-medium text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold text-gray-800">Cash Ledger</h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="text-left sm:text-right">
            <p className="text-sm text-gray-600">Current Balance</p>
            <p className={`text-2xl font-bold ${cashBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
              KES {Number(cashBalance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <button onClick={handleDownload} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" />
            Download CSV
          </button>
        </div>
      </div>

      {/* Table */}
      {transactions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <p className="text-gray-500 text-lg">No transactions found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg overflow-hidden">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="text-left p-3 text-sm font-semibold text-gray-700">Date</th>
                <th className="text-left p-3 text-sm font-semibold text-gray-700">Description</th>
                <th className="text-left p-3 text-sm font-semibold text-gray-700 hidden md:table-cell">Category</th>
                <th className="text-right p-3 text-sm font-semibold text-gray-700">Amount</th>
                <th className="text-right p-3 text-sm font-semibold text-gray-700 hidden sm:table-cell">Balance</th>
                <th className="text-right p-3 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn, idx) => (
                <tr key={txn.id} className={`border-b hover:bg-gray-50 cursor-pointer ${idx % 2 === 0 ? "bg-white" : "bg-gray-25"}`}>
                  {editingId === txn.id ? (
                    <>
                      <td className="p-3">
                        <input
                          type="date"
                          value={editForm.date?.split("T")[0] || ""}
                          onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                          className="w-full px-2 py-1 border rounded text-sm text-black"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={editForm.description || ""}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="w-full px-2 py-1 border rounded text-sm text-black"
                        />
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <input
                          type="text"
                          value={editForm.category || ""}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="w-full px-2 py-1 border rounded text-sm text-black"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={editForm.amount || ""}
                          onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })}
                          className="w-full px-2 py-1 border rounded text-sm text-right text-black"
                        />
                      </td>
                      <td className="p-3 hidden sm:table-cell"></td>
                      <td className="p-3 text-right">
                        <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-800 mr-2">
                          <Save className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setEditingId(null); setEditForm({}); }} className="text-gray-600 hover:text-gray-800">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td onClick={() => setSelectedTransaction(txn)} className="p-3 text-sm text-gray-600">{new Date(txn.date).toLocaleDateString()}</td>
                      <td onClick={() => setSelectedTransaction(txn)} className="p-3 text-sm text-gray-800">{txn.description}</td>
                      <td onClick={() => setSelectedTransaction(txn)} className="p-3 text-sm hidden md:table-cell">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${txn.type === "INFLOW" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                          {txn.category}
                        </span>
                      </td>
                      <td onClick={() => setSelectedTransaction(txn)} className="p-3 text-sm text-right font-semibold">
                        <span className="flex items-center justify-end gap-1">
                          {txn.type === "INFLOW" ? <ArrowUpRight className="w-4 h-4 text-green-600" /> : <ArrowDownRight className="w-4 h-4 text-red-600" />}
                          <span className={txn.type === "INFLOW" ? "text-green-600" : "text-red-600"}>
                            {Number(txn.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </span>
                      </td>
                      <td onClick={() => setSelectedTransaction(txn)} className={`p-3 text-sm text-right font-bold hidden sm:table-cell ${txn.runningBalance >= 0 ? "text-gray-900" : "text-red-600"}`}>
                        {Number(txn.runningBalance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => handleEdit(txn)} className="text-blue-600 hover:text-blue-800 mr-2">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(txn)} className="text-red-600 hover:text-red-800">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedTransaction(null)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-bold text-gray-900">Transaction Details</h3>
                <button onClick={() => setSelectedTransaction(null)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Date</p>
                    <p className="text-lg font-semibold text-gray-900">{new Date(selectedTransaction.date).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Type</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${selectedTransaction.type === "INFLOW" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {selectedTransaction.type}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Description</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedTransaction.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Category</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedTransaction.category}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Amount</p>
                    <p className={`text-2xl font-bold ${selectedTransaction.type === "INFLOW" ? "text-green-600" : "text-red-600"}`}>
                      KES {Number(selectedTransaction.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {selectedTransaction.relatedTo && (
                  <div>
                    <p className="text-sm text-gray-600">Related To</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedTransaction.relatedTo}</p>
                  </div>
                )}

                {selectedTransaction.affectedAccounts && (
                  <div>
                    <p className="text-sm text-gray-600">Accounts Affected</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedTransaction.affectedAccounts}</p>
                  </div>
                )}

                {selectedTransaction.details && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Additional Details</p>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <pre className="text-xs text-gray-800 overflow-x-auto">{JSON.stringify(selectedTransaction.details, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}