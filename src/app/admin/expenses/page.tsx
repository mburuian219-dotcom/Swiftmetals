"use client";

import React, { useEffect, useState, useRef } from "react";

interface Expense {
  id: number;
  title: string;
  amount: number;
  category?: string;
  notes?: string;
  date: string;
}

const ExpensePage = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExpense, setNewExpense] = useState({
    title: "",
    amount: "",
    category: "",
    notes: "",
    date: "",
  });

  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch expenses
  useEffect(() => {
    fetch("/api/expenses")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setExpenses(data);
        } else if (data && Array.isArray(data.expenses)) {
          setExpenses(data.expenses);
        } else {
          console.error("Expected array but got:", data);
          setExpenses([]);
        }
      })
      .catch((err) => {
        console.error("Error fetching expenses:", err);
        setExpenses([]);
      });
  }, []);

  // Add new expense
  const handleAddExpense = async () => {
    if (!newExpense.title || !newExpense.amount) return;

    setIsAdding(true);

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newExpense),
      });

      if (res.ok) {
        const data = await res.json();
        const created = data.expense || data;
        setExpenses([created, ...expenses]);
        setNewExpense({
          title: "",
          amount: "",
          category: "",
          notes: "",
          date: "",
        });
      } else {
        console.error("Failed to add expense:", await res.text());
      }
    } catch (err) {
      console.error("Error adding expense:", err);
    } finally {
      setIsAdding(false);
    }
  };

  // Delete expense
  const handleDeleteExpense = async (id: number) => {
    setIsDeleting(id);

    try {
      const res = await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });

      if (res.ok) {
        setExpenses(expenses.filter((e) => e.id !== id));
      } else {
        console.error("Failed to delete expense:", await res.text());
      }
    } catch (err) {
      console.error("Error deleting expense:", err);
    } finally {
      setIsDeleting(null);
    }
  };

  // Download expenses as CSV
  const handleDownloadCSV = () => {
    if (expenses.length === 0) {
      alert("No expenses to download!");
      return;
    }

    // Create CSV content
    const headers = ["ID", "Title", "Amount", "Category", "Notes", "Date"];
    const csvRows = [headers.join(",")];

    expenses.forEach((exp) => {
      const row = [
        exp.id,
        `"${(exp.title || "").replace(/"/g, '""')}"`,
        exp.amount,
        `"${(exp.category || "").replace(/"/g, '""')}"`,
        `"${(exp.notes || "").replace(/"/g, '""')}"`,
        exp.date,
      ];
      csvRows.push(row.join(","));
    });

    const csvContent = csvRows.join("\n");

    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `expenses_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Upload and parse CSV
  const handleUploadCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n");
      
      // Skip header row
      const dataLines = lines.slice(1).filter(line => line.trim());
      
      const parsedExpenses: Expense[] = [];
      
      for (const line of dataLines) {
        // Simple CSV parsing (handles quoted fields)
        const matches = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
        if (!matches || matches.length < 6) continue;
        
        const [id, title, amount, category, notes, date] = matches.map(m => 
          m.replace(/^"|"$/g, '').replace(/""/g, '"').trim()
        );
        
        const expense: Expense = {
          id: parseInt(id) || Date.now() + Math.random(),
          title: title || "Untitled",
          amount: parseFloat(amount) || 0,
          category: category || "",
          notes: notes || "",
          date: date || new Date().toISOString().split('T')[0],
        };
        
        parsedExpenses.push(expense);
      }

      if (parsedExpenses.length > 0) {
        // Post each expense to the API
        for (const expense of parsedExpenses) {
          try {
            await fetch("/api/expenses", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: expense.title,
                amount: expense.amount.toString(),
                category: expense.category,
                notes: expense.notes,
                date: expense.date,
              }),
            });
          } catch (err) {
            console.error("Error uploading expense:", err);
          }
        }
        
        // Refresh the expenses list
        window.location.reload();
      }
    };
    
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Calculations
  const total = Array.isArray(expenses)
    ? expenses.reduce((acc, e) => acc + e.amount, 0)
    : 0;

  const now = new Date();
  const monthly = expenses
    .filter((e) => new Date(e.date).getMonth() === now.getMonth())
    .reduce((a, e) => a + e.amount, 0);

  const startOfWeek = new Date();
  startOfWeek.setDate(now.getDate() - now.getDay());
  const weekly = expenses
    .filter((e) => new Date(e.date) >= startOfWeek)
    .reduce((a, e) => a + e.amount, 0);

  return (
    <div className="p-8 bg-gray-50 min-h-screen text-black">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-black">Expenses</h1>
        
        {/* CSV Import/Export buttons */}
        <div className="flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleUploadCSV}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
          >
            <span>📤</span> Import CSV
          </button>
          <button
            onClick={handleDownloadCSV}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
          >
            <span>📥</span> Export CSV
          </button>
        </div>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow">
          <span>Total Expenses</span>
          <span className="text-2xl font-bold text-red-600">
            Ksh{total.toFixed(2)}
          </span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <span>This Month</span>
          <span className="text-2xl font-bold text-blue-600">
            Ksh{monthly.toFixed(2)}
          </span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <span>This Week</span>
          <span className="text-2xl font-bold text-purple-600">
            Ksh{weekly.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Add Expense */}
      <div className="bg-white p-6 rounded-xl shadow mb-8">
        <h2 className="text-xl font-semibold mb-4">Add New Expense</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            type="text"
            placeholder="Title"
            value={newExpense.title}
            onChange={(e) =>
              setNewExpense({ ...newExpense, title: e.target.value })
            }
            className="border p-3 rounded-xl"
          />
          <input
            type="number"
            placeholder="Amount"
            value={newExpense.amount}
            onChange={(e) =>
              setNewExpense({ ...newExpense, amount: e.target.value })
            }
            className="border p-3 rounded-xl"
          />
          <select
            value={newExpense.category}
            onChange={(e) =>
              setNewExpense({ ...newExpense, category: e.target.value })
            }
            className="border p-3 rounded-xl bg-white"
          >
            <option value="">Select Category</option>
            <option value="Selling and Distribution Costs">
              Selling and Distribution Costs
            </option>
            <option value="Admin Costs">Admin Costs</option>
            <option value="Others">Others</option>
          </select>
          <input
            type="date"
            value={newExpense.date}
            onChange={(e) =>
              setNewExpense({ ...newExpense, date: e.target.value })
            }
            className="border p-3 rounded-xl"
          />
          <button
            onClick={handleAddExpense}
            disabled={isAdding}
            className={`px-6 py-3 rounded-xl text-white ${
              isAdding
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-emerald-500 hover:shadow-lg"
            }`}
          >
            {isAdding ? "Adding..." : "Add"}
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold mb-4">Recent Expenses</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-black">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 text-left">Title</th>
                <th className="p-3 text-left">Category</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length > 0 ? (
                expenses.map((exp) => (
                  <tr key={exp.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">{exp.title}</td>
                    <td className="p-3">{exp.category || "-"}</td>
                    <td className="p-3 font-semibold text-red-600">
                      {exp.amount.toFixed(2)}
                    </td>
                    <td className="p-3">
                      {new Date(exp.date).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        disabled={isDeleting === exp.id}
                        className={`text-sm text-white px-3 py-1 rounded-lg ${
                          isDeleting === exp.id
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-red-500 hover:bg-red-600"
                        }`}
                      >
                        {isDeleting === exp.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="p-3 text-center text-gray-500"
                  >
                    No expenses yet. Add your first expense above!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ExpensePage;