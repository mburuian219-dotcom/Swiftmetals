"use client";

import React, { useEffect, useState } from "react";

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

  // 👇 Loading states
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  // ✅ Fetch expenses (works with both {expenses: []} and [])
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

  // ✅ Add new expense with loading state
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
        const created = data.expense || data; // support both shapes
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

  // ✅ Delete expense with loading state
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

  // ✅ Safe calculations
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
      <h1 className="text-3xl font-bold mb-6 text-black">Expenses</h1>

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
            {isAdding ? "Adding expense... please wait" : "Add"}
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
                        {isDeleting === exp.id
                          ? "Deleting expense... please wait"
                          : "Delete"}
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
