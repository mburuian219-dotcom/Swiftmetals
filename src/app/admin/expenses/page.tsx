"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Download,
  Upload,
  Plus,
  Trash2,
  FileSpreadsheet,
  Calendar,
  DollarSign,
  Tag,
  AlertCircle,
  CheckCircle,
  Search,
  Filter,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  FileText,
  BarChart3
} from "lucide-react";

interface Expense {
  id: number;
  title: string;
  amount: number;
  category?: string;
  notes?: string;
  date: string;
  createdAt: string;
}

const ExpensePage = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExpense, setNewExpense] = useState({
    title: "",
    amount: "",
    category: "",
    notes: "",
    date: new Date().toISOString().split('T')[0],
  });

  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch expenses
  const fetchExpenses = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch("/api/expenses");
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch expenses: ${res.status} ${errorText}`);
      }
      
      const data = await res.json();
      
      if (Array.isArray(data)) {
        setExpenses(data.sort((a: Expense, b: Expense) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        ));
      } else if (data && Array.isArray(data.expenses)) {
        setExpenses(data.expenses.sort((a: Expense, b: Expense) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        ));
      } else if (data && data.data && Array.isArray(data.data)) {
        setExpenses(data.data.sort((a: Expense, b: Expense) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        ));
      } else {
        console.error("Unexpected response format:", data);
        setExpenses([]);
      }
    } catch (err: any) {
      console.error("Error fetching expenses:", err);
      setError(err.message || "Failed to load expenses");
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  // Add new expense
  const handleAddExpense = async () => {
    if (!newExpense.title.trim()) {
      setError("Please enter an expense title");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!newExpense.amount || parseFloat(newExpense.amount) <= 0) {
      setError("Please enter a valid amount");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newExpense,
          amount: parseFloat(newExpense.amount),
          date: newExpense.date || new Date().toISOString().split('T')[0]
        }),
      });

      const data = await res.json();
      
      if (res.ok) {
        const created = data.expense || data.data || data;
        setExpenses([created, ...expenses]);
        setNewExpense({
          title: "",
          amount: "",
          category: "",
          notes: "",
          date: new Date().toISOString().split('T')[0],
        });
        setSuccess("Expense added successfully!");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        throw new Error(data.error || data.message || "Failed to add expense");
      }
    } catch (err: any) {
      console.error("Error adding expense:", err);
      setError(err.message || "Failed to add expense");
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsAdding(false);
    }
  };

  // Delete expense
  const handleDeleteExpense = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(id);
    setError(null);

    try {
      const res = await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });

      if (res.ok) {
        setExpenses(expenses.filter((e) => e.id !== id));
        setSuccess("Expense deleted successfully!");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await res.json();
        throw new Error(data.error || data.message || "Failed to delete expense");
      }
    } catch (err: any) {
      console.error("Error deleting expense:", err);
      setError(err.message || "Failed to delete expense");
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsDeleting(null);
    }
  };

  // Download expenses as CSV
  const handleDownloadCSV = () => {
    if (expenses.length === 0) {
      setError("No expenses to download!");
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
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
      
      setSuccess("CSV downloaded successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error downloading CSV:", err);
      setError("Failed to download CSV");
      setTimeout(() => setError(null), 5000);
    }
  };

  // Upload and parse CSV
  const handleUploadCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setError("Please upload a CSV file");
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("File size too large. Maximum 5MB allowed.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split("\n");
        
        // Skip header row
        const dataLines = lines.slice(1).filter(line => line.trim());
        
        let successCount = 0;
        let errorCount = 0;
        
        setLoading(true);
        setError(null);
        
        for (const line of dataLines) {
          try {
            // Simple CSV parsing (handles quoted fields)
            const matches = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
            if (!matches || matches.length < 6) continue;
            
            const [id, title, amount, category, notes, date] = matches.map(m => 
              m.replace(/^"|"$/g, '').replace(/""/g, '"').trim()
            );
            
            // Validate required fields
            if (!title || !amount) continue;
            
            const expenseData = {
              title: title || "Untitled",
              amount: parseFloat(amount) || 0,
              category: category || "",
              notes: notes || "",
              date: date || new Date().toISOString().split('T')[0],
            };
            
            const res = await fetch("/api/expenses", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(expenseData),
            });
            
            if (res.ok) {
              successCount++;
            } else {
              errorCount++;
            }
            
            // Small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (err) {
            errorCount++;
            console.error("Error processing CSV line:", err);
          }
        }
        
        if (successCount > 0) {
          setSuccess(`Successfully imported ${successCount} expense(s)`);
          await fetchExpenses(); // Refresh the list
        }
        
        if (errorCount > 0) {
          setError(`Failed to import ${errorCount} expense(s)`);
        }
        
      } catch (err: any) {
        console.error("Error processing CSV file:", err);
        setError("Failed to process CSV file");
        setTimeout(() => setError(null), 5000);
      } finally {
        setLoading(false);
      }
    };
    
    reader.onerror = () => {
      setError("Failed to read CSV file");
      setTimeout(() => setError(null), 5000);
    };
    
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Calculations
  const total = expenses.reduce((acc, e) => acc + e.amount, 0);
  
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const monthly = expenses
    .filter((e) => {
      const expenseDate = new Date(e.date);
      return expenseDate.getMonth() === currentMonth && 
             expenseDate.getFullYear() === currentYear;
    })
    .reduce((a, e) => a + e.amount, 0);

  const startOfWeek = new Date();
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const weekly = expenses
    .filter((e) => new Date(e.date) >= startOfWeek)
    .reduce((a, e) => a + e.amount, 0);

  // Get today's expenses
  const today = new Date().toISOString().split('T')[0];
  const daily = expenses
    .filter((e) => e.date === today)
    .reduce((a, e) => a + e.amount, 0);

  // Get categories
  const categories = ["Selling and Distribution Costs", "Admin Costs", "Others"];
  
  // Filter expenses
  const filteredExpenses = expenses.filter((exp) => {
    // Search filter
    if (searchQuery && !exp.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !exp.category?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !exp.notes?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Category filter
    if (selectedCategory !== "all" && exp.category !== selectedCategory) {
      return false;
    }
    
    // Date range filter
    if (dateRange.start && new Date(exp.date) < new Date(dateRange.start)) {
      return false;
    }
    
    if (dateRange.end && new Date(exp.date) > new Date(dateRange.end)) {
      return false;
    }
    
    return true;
  });

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('KES', 'KSh');
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setDateRange({ start: "", end: "" });
  };

  if (loading && expenses.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <div className="mt-4 text-black">Loading expenses...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Alerts */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2 shadow-sm animate-fadeIn">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-start gap-2 shadow-sm animate-fadeIn">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-black">Expense Management</h1>
            <div className="text-sm text-black mt-1">Track and manage all business expenses</div>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleUploadCSV}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm shadow-sm"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
            <button
              onClick={handleDownloadCSV}
              disabled={expenses.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={fetchExpenses}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-black rounded-lg hover:bg-gray-200 transition-colors text-sm shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-black">Total Expenses</div>
                <div className="text-lg sm:text-xl font-bold text-black mt-1">
                  {formatCurrency(total)}
                </div>
              </div>
              <div className="p-2 bg-red-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-black">This Month</div>
                <div className="text-lg sm:text-xl font-bold text-black mt-1">
                  {formatCurrency(monthly)}
                </div>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-black">This Week</div>
                <div className="text-lg sm:text-xl font-bold text-black mt-1">
                  {formatCurrency(weekly)}
                </div>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUpIcon className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-black">Today</div>
                <div className="text-lg sm:text-xl font-bold text-black mt-1">
                  {formatCurrency(daily)}
                </div>
              </div>
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Clock className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Add New Expense */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold text-black mb-4">Add New Expense</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-black mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Enter expense title"
                value={newExpense.title}
                onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-black mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">KSh</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  className="w-full pl-12 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-black mb-1">
                Category
              </label>
              <select
                value={newExpense.category}
                onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white"
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-black mb-1">
                Date
              </label>
              <input
                type="date"
                value={newExpense.date}
                onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={handleAddExpense}
                disabled={isAdding || !newExpense.title.trim() || !newExpense.amount}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2"
              >
                {isAdding ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3" />
                    Add Expense
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="mt-3">
            <label className="block text-xs font-medium text-black mb-1">
              Notes (Optional)
            </label>
            <textarea
              placeholder="Add any notes or description"
              value={newExpense.notes}
              onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search expenses by title, category, or notes..."
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                >
                  <option value="all">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black w-32"
                  placeholder="Start Date"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black w-32"
                  placeholder="End Date"
                />
              </div>
              
              {(searchQuery || selectedCategory !== "all" || dateRange.start || dateRange.end) && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-black">All Expenses</h2>
                <div className="text-sm text-black">
                  {filteredExpenses.length} of {expenses.length} expenses shown
                </div>
              </div>
              
              <div className="text-sm text-black">
                Filtered Total: <span className="font-semibold text-red-600">
                  {formatCurrency(filteredExpenses.reduce((acc, e) => acc + e.amount, 0))}
                </span>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            {filteredExpenses.length === 0 ? (
              <div className="px-4 sm:px-6 py-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <div className="text-lg font-medium text-black mb-2">
                  {expenses.length === 0 ? 'No Expenses Yet' : 'No Matching Expenses'}
                </div>
                <div className="text-sm text-black max-w-md mx-auto mb-6">
                  {expenses.length === 0 
                    ? 'Start by adding your first expense using the form above.'
                    : 'Try adjusting your search filters to find what you\'re looking for.'
                  }
                </div>
                {expenses.length > 0 && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-black rounded-lg hover:bg-gray-200 transition-colors text-sm"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                      Title & Description
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4">
                        <div className="text-sm font-medium text-black">{exp.title}</div>
                        {exp.notes && (
                          <div className="text-xs text-black mt-1 line-clamp-2">
                            {exp.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          exp.category === 'Selling and Distribution Costs' 
                            ? 'bg-blue-100 text-blue-800'
                            : exp.category === 'Admin Costs'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {exp.category || 'Uncategorized'}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="text-sm font-bold text-red-600">
                          {formatCurrency(exp.amount)}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="text-sm text-black">
                          {formatDate(exp.date)}
                        </div>
                        {exp.createdAt && (
                          <div className="text-xs text-gray-500">
                            Added {formatDate(exp.createdAt)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <button
                          onClick={() => handleDeleteExpense(exp.id, exp.title)}
                          disabled={isDeleting === exp.id}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            isDeleting === exp.id
                              ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                              : 'bg-red-50 text-red-600 hover:bg-red-100'
                          }`}
                        >
                          {isDeleting === exp.id ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {filteredExpenses.length > 0 && (
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={2} className="px-4 sm:px-6 py-3 text-right text-sm font-medium text-black">
                        Total ({filteredExpenses.length} expenses):
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <div className="text-lg font-bold text-red-600">
                          {formatCurrency(filteredExpenses.reduce((acc, e) => acc + e.amount, 0))}
                        </div>
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="text-xs text-black mb-2">
            Expense Management System • Total: {expenses.length} expenses • Last updated: {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpensePage;