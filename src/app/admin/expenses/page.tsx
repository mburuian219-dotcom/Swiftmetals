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
  const [newExpense, setNewExpense] = useState({ title: "", amount: "", category: "", notes: "", date: "" });

  // Fetch expenses
  useEffect(() => {
    fetch("/api/expenses").then(res => res.json()).then(setExpenses);
  }, []);

  const handleAddExpense = async () => {
    if (!newExpense.title || !newExpense.amount) return;
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newExpense),
    });
    if (res.ok) {
      const created = await res.json();
      setExpenses([created, ...expenses]);
      setNewExpense({ title: "", amount: "", category: "", notes: "", date: "" });
    }
  };

  const handleDeleteExpense = async (id: number) => {
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    setExpenses(expenses.filter(e => e.id !== id));
  };

  // Overview Calculations
  const total = expenses.reduce((acc, e) => acc + e.amount, 0);
  const now = new Date();
  const monthly = expenses.filter(e => new Date(e.date).getMonth() === now.getMonth()).reduce((a, e) => a + e.amount, 0);
  const weekly = expenses.filter(e => {
    const d = new Date(e.date);
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    return d >= startOfWeek;
  }).reduce((a, e) => a + e.amount, 0);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-slate-900 mb-6">Expenses</h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow">
          <span className="text-slate-500">Total Expenses</span>
          <span className="text-2xl font-bold text-red-600">Ksh{total.toFixed(2)}</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <span className="text-slate-500">This Month</span>
          <span className="text-2xl font-bold text-blue-600">Ksh{monthly.toFixed(2)}</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <span className="text-slate-500">This Week</span>
          <span className="text-2xl font-bold text-purple-600">Ksh{weekly.toFixed(2)}</span>
        </div>
      </div>

      {/* Add Expense Form */}
      <div className="bg-white p-6 rounded-xl shadow mb-8">
        <h2 className="text-xl font-semibold mb-4 text-slate-900">Add New Expense</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            type="text"
            placeholder="Title"
            value={newExpense.title}
            onChange={e => setNewExpense({ ...newExpense, title: e.target.value })}
            className="border p-3 rounded-xl"
          />
          <input
            type="number"
            placeholder="Amount"
            value={newExpense.amount}
            onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })}
            className="border p-3 rounded-xl"
          />
          <input
            type="text"
            placeholder="Category"
            value={newExpense.category}
            onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}
            className="border p-3 rounded-xl"
          />
          <input
            type="date"
            value={newExpense.date}
            onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
            className="border p-3 rounded-xl"
          />
          <button
            onClick={handleAddExpense}
            className="bg-emerald-500 text-white px-6 py-3 rounded-xl hover:shadow-lg"
          >
            Add
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold mb-4 text-slate-900">Recent Expenses</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-3 text-left">Title</th>
                <th className="p-3 text-left">Category</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{exp.title}</td>
                  <td className="p-3">{exp.category || "-"}</td>
                  <td className="p-3 font-semibold text-red-600">{exp.amount.toFixed(2)}</td>
                  <td className="p-3">{new Date(exp.date).toLocaleDateString()}</td>
                  <td className="p-3">
                    <button
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="text-sm text-white bg-red-500 px-3 py-1 rounded-lg hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ExpensePage;
