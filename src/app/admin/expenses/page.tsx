"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Download,
  Upload,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  Tag,
  AlertCircle,
  CheckCircle,
  Search,
  Filter,
  RefreshCw,
  Clock,
  FileText,
  User,
  TrendingUp,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  Printer,
  FileSpreadsheet,
  Shield,
  History,
  Edit,
  Save,
  XCircle,
  Users  // Add this lin
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

interface Expense {
  id: number;
  title: string;
  amount: number;
  category?: string;
  notes?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  createdByName?: string;
  createdByEmail?: string;
  createdAtFormatted?: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedByEmail?: string;
  updatedAtFormatted?: string;
}

interface ReportFilters {
  startDate: string;
  endDate: string;
  category: string;
  creator: string;
}

interface EditingExpense {
  id: number;
  title: string;
  amount: string;
  category: string;
  notes: string;
  date: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

interface SummaryStats {
  totalAmount: number;
  averageAmount: number;
  totalExpenses: number;
  categoryBreakdown: Record<string, number>;
  creatorBreakdown: Record<string, number>;
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
  const [editingExpense, setEditingExpense] = useState<EditingExpense | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCreator, setSelectedCreator] = useState("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [sortField, setSortField] = useState<keyof Expense>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState<"csv" | "print">("csv");
  const [reportFilters, setReportFilters] = useState<ReportFilters>({
    startDate: "",
    endDate: "",
    category: "all",
    creator: "all"
  });
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 100
  });
  const [summary, setSummary] = useState<SummaryStats>({
    totalAmount: 0,
    averageAmount: 0,
    totalExpenses: 0,
    categoryBreakdown: {},
    creatorBreakdown: {}
  });
  const [uniqueCreators, setUniqueCreators] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get Firebase auth token
  const getAuthToken = async (user: FirebaseUser | null) => {
    if (!user) return null;
    try {
      const token = await user.getIdToken();
      setAuthToken(token);
      return token;
    } catch (error) {
      console.error("Error getting auth token:", error);
      return null;
    }
  };

  // Listen to auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await getAuthToken(user);
      } else {
        setAuthToken(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch expenses when auth token is available
  useEffect(() => {
    if (authToken) {
      fetchExpenses();
    } else if (currentUser === null && !loading) {
      setLoading(false);
    }
  }, [authToken, currentUser, selectedCategory, selectedCreator, dateRange, searchQuery, pagination.currentPage]);

  // Fetch expenses with filters
  const fetchExpenses = async () => {
    if (!authToken) {
      setError("Please login to view expenses");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append("page", pagination.currentPage.toString());
      params.append("limit", "100");
      
      if (selectedCategory !== "all") {
        params.append("category", selectedCategory);
      }
      if (selectedCreator !== "all") {
        params.append("createdBy", selectedCreator);
      }
      if (dateRange.start) {
        params.append("startDate", dateRange.start);
      }
      if (dateRange.end) {
        params.append("endDate", dateRange.end);
      }
      if (searchQuery) {
        params.append("search", searchQuery);
      }
      
      const res = await fetch(`/api/expenses?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please login again.");
        }
        throw new Error(`Failed to fetch expenses: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.success) {
        setExpenses(data.expenses || []);
        setPagination(data.pagination || {
          currentPage: 1,
          totalPages: 1,
          totalItems: 0,
          itemsPerPage: 100
        });
        setUniqueCreators(data.metadata?.uniqueCreators || []);
        
        if (data.summary) {
          setSummary(data.summary);
        }
      } else {
        throw new Error(data.error || "Failed to load expenses");
      }
      
    } catch (err: any) {
      console.error("Error fetching expenses:", err);
      setError(err.message || "Failed to load expenses");
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  // Add new expense
  const handleAddExpense = async () => {
    if (!authToken) {
      setError("Please login to add expenses");
      return;
    }

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
      const expenseData = {
        title: newExpense.title.trim(),
        amount: parseFloat(newExpense.amount),
        category: newExpense.category || null,
        notes: newExpense.notes || "",
        date: newExpense.date || new Date().toISOString().split('T')[0],
      };

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(expenseData),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        await fetchExpenses(); // Refresh the list
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

  // Update expense
  const handleUpdateExpense = async () => {
    if (!editingExpense) return;
    if (!authToken) {
      setError("Please login to update expenses");
      return;
    }

    setIsEditing(editingExpense.id);
    setError(null);

    try {
      const expenseData = {
        id: editingExpense.id,
        title: editingExpense.title.trim(),
        amount: parseFloat(editingExpense.amount),
        category: editingExpense.category || null,
        notes: editingExpense.notes || "",
        date: editingExpense.date,
      };

      const res = await fetch("/api/expenses", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(expenseData),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        await fetchExpenses(); // Refresh the list
        setEditingExpense(null);
        setSuccess("Expense updated successfully!");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        throw new Error(data.error || data.message || "Failed to update expense");
      }
    } catch (err: any) {
      console.error("Error updating expense:", err);
      setError(err.message || "Failed to update expense");
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsEditing(null);
    }
  };

  // Delete expense
  const handleDeleteExpense = async (id: number, title: string) => {
    if (!authToken) {
      setError("Please login to delete expenses");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(id);
    setError(null);

    try {
      const res = await fetch(`/api/expenses?id=${id}`, { 
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        await fetchExpenses(); // Refresh the list
        setSuccess("Expense deleted successfully!");
        setTimeout(() => setSuccess(null), 3000);
      } else {
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

  // Get report data
  const getReportData = () => {
    let filtered = [...expenses];
    
    if (reportFilters.startDate) {
      filtered = filtered.filter(exp => new Date(exp.date) >= new Date(reportFilters.startDate));
    }
    if (reportFilters.endDate) {
      filtered = filtered.filter(exp => new Date(exp.date) <= new Date(reportFilters.endDate));
    }
    if (reportFilters.category !== "all") {
      filtered = filtered.filter(exp => exp.category === reportFilters.category);
    }
    if (reportFilters.creator !== "all") {
      filtered = filtered.filter(exp => exp.createdBy === reportFilters.creator);
    }
    
    return filtered;
  };

  // Download CSV report
  const handleDownloadCSV = () => {
    const reportData = getReportData();
    
    if (reportData.length === 0) {
      setError("No expenses to download for the selected filters!");
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      const headers = [
        "Expense ID",
        "Title/Description",
        "Amount (KES)",
        "Category",
        "Expense Date",
        "Created By",
        "Created Date",
        "Created Time",
        "Last Updated By",
        "Last Updated Date",
        "Notes"
      ];
      
      const csvRows = [headers.join(",")];

      reportData.forEach((exp) => {
        const createdDate = exp.createdAtFormatted ? new Date(exp.createdAtFormatted) : null;
        const updatedDate = exp.updatedAtFormatted ? new Date(exp.updatedAtFormatted) : null;
        
        const row = [
          exp.id,
          `"${(exp.title || "").replace(/"/g, '""')}"`,
          exp.amount.toFixed(2),
          `"${(exp.category || "Uncategorized").replace(/"/g, '""')}"`,
          exp.date,
          `"${(exp.createdByName || exp.createdBy || "System").replace(/"/g, '""')}"`,
          createdDate ? createdDate.toLocaleDateString('en-KE') : "",
          createdDate ? createdDate.toLocaleTimeString('en-KE') : "",
          `"${(exp.updatedByName || exp.updatedBy || "N/A").replace(/"/g, '""')}"`,
          updatedDate ? updatedDate.toLocaleDateString('en-KE') : "",
          `"${(exp.notes || "").replace(/"/g, '""').substring(0, 500)}"`,
        ];
        csvRows.push(row.join(","));
      });

      // Add summary section
      const totalAmount = reportData.reduce((acc, e) => acc + e.amount, 0);
      csvRows.push("");
      csvRows.push(`"EXPENSE REPORT SUMMARY","","","","","","","","","",""`);
      csvRows.push(`"Total Expenses","${totalAmount.toFixed(2)}","","","","","","","","",""`);
      csvRows.push(`"Number of Expenses","${reportData.length}","","","","","","","","",""`);
      csvRows.push(`"Average Expense","${(totalAmount / reportData.length).toFixed(2)}","","","","","","","","",""`);
      csvRows.push(`"Generated By","${currentUser?.email || "System"}","","","","","","","","",""`);
      csvRows.push(`"Generated On","${new Date().toLocaleString('en-KE')}","","","","","","","","",""`);

      const csvContent = csvRows.join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      const fileName = `expense_report_${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      link.style.visibility = "hidden";
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccess(`Expense report exported successfully as ${fileName}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error downloading CSV:", err);
      setError("Failed to download expense report");
      setTimeout(() => setError(null), 5000);
    }
  };

  // Print report
  const handlePrint = () => {
    const reportData = getReportData();
    if (reportData.length === 0) {
      setError("No expenses to print for the selected filters!");
      setTimeout(() => setError(null), 3000);
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError("Please allow pop-ups to print the report");
      return;
    }

    const totalAmount = reportData.reduce((acc, e) => acc + e.amount, 0);
    const averageAmount = totalAmount / reportData.length;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Expense Report - ${new Date().toLocaleDateString('en-KE')}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #000;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            color: #1a1a1a;
          }
          .header p {
            margin: 5px 0;
            color: #666;
          }
          .filters {
            background: #f5f5f5;
            padding: 10px;
            margin-bottom: 20px;
            border-radius: 5px;
            font-size: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f2f2f2;
            font-weight: bold;
          }
          .summary {
            margin-top: 20px;
            padding: 15px;
            background: #f9f9f9;
            border: 1px solid #ddd;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #999;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
          @media print {
            body {
              margin: 0;
            }
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Expense Report</h1>
          <p>Generated on: ${new Date().toLocaleString('en-KE')}</p>
          <p>Generated by: ${currentUser?.email || currentUser?.displayName || "System"}</p>
        </div>
        
        <div class="filters">
          <strong>Applied Filters:</strong><br>
          ${reportFilters.startDate ? `Start Date: ${reportFilters.startDate}<br>` : ''}
          ${reportFilters.endDate ? `End Date: ${reportFilters.endDate}<br>` : ''}
          ${reportFilters.category !== "all" ? `Category: ${reportFilters.category}<br>` : ''}
          ${reportFilters.creator !== "all" ? `Created By: ${reportFilters.creator}<br>` : ''}
        </div>
        
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Amount (KES)</th>
              <th>Category</th>
              <th>Expense Date</th>
              <th>Created By</th>
              <th>Created Date</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.map(exp => `
              <tr>
                <td>${exp.id}</td>
                <td>${exp.title}</td>
                <td style="text-align: right;">${exp.amount.toFixed(2)}</td>
                <td>${exp.category || 'Uncategorized'}</td>
                <td>${new Date(exp.date).toLocaleDateString('en-KE')}</td>
                <td>${exp.createdByName || exp.createdBy || 'System'}</td>
                <td>${exp.createdAtFormatted ? new Date(exp.createdAtFormatted).toLocaleDateString('en-KE') : 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="summary">
          <strong>Summary</strong><br>
          Total Expenses: KES ${totalAmount.toFixed(2)}<br>
          Number of Expenses: ${reportData.length}<br>
          Average Expense: KES ${averageAmount.toFixed(2)}<br>
        </div>
        
        <div class="footer">
          This is a system-generated expense report. For audit purposes, please retain this document.<br>
          Expense Management System
        </div>
        
        <div class="no-print" style="text-align: center; margin-top: 20px;">
          <button onclick="window.print();" style="padding: 10px 20px; font-size: 14px;">Print Report</button>
          <button onclick="window.close();" style="padding: 10px 20px; font-size: 14px; margin-left: 10px;">Close</button>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    setShowReportModal(false);
  };

  // Handle sort
  const handleSort = (field: keyof Expense) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Sort and filter expenses
  const getSortedExpenses = () => {
    const sorted = [...expenses].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      
      if (sortField === 'amount') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else if (sortField === 'date' || sortField === 'createdAt') {
        aVal = new Date(aVal as string).getTime() || 0;
        bVal = new Date(bVal as string).getTime() || 0;
      } else if (sortField === 'title' || sortField === 'category') {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      } else if (sortField === 'createdBy') {
        aVal = String(a.createdByName || a.createdBy || '').toLowerCase();
        bVal = String(b.createdByName || b.createdBy || '').toLowerCase();
      }
      
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    
    return sorted;
  };

  const SortIcon = ({ field }: { field: keyof Expense }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  // Upload CSV
  const handleUploadCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError("Please upload a CSV file");
      setTimeout(() => setError(null), 3000);
      return;
    }

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
        const dataLines = lines.slice(1).filter(line => line.trim() && !line.includes("SUMMARY"));
        
        let successCount = 0;
        let errorCount = 0;
        
        setLoading(true);
        setError(null);
        
        for (const line of dataLines) {
          try {
            const matches = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
            if (!matches || matches.length < 6) continue;
            
            const title = matches[1]?.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
            const amount = parseFloat(matches[2]?.replace(/^"|"$/g, '')) || 0;
            const category = matches[3]?.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
            const date = matches[4]?.replace(/^"|"$/g, '').trim();
            
            if (!title || amount <= 0) continue;
            
            const expenseData = {
              title: title,
              amount: amount,
              category: category || "",
              notes: `Imported from CSV on ${new Date().toLocaleString()}`,
              date: date || new Date().toISOString().split('T')[0],
            };
            
            const res = await fetch("/api/expenses", {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify(expenseData),
            });
            
            if (res.ok) {
              successCount++;
            } else {
              errorCount++;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (err) {
            errorCount++;
            console.error("Error processing CSV line:", err);
          }
        }
        
        if (successCount > 0) {
          setSuccess(`Successfully imported ${successCount} expense(s)`);
          await fetchExpenses();
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
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedCreator("all");
    setDateRange({ start: "", end: "" });
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

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
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Format datetime
  const formatDateTime = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isFilterActive = searchQuery || selectedCategory !== "all" || selectedCreator !== "all" || dateRange.start || dateRange.end;
  const sortedExpenses = getSortedExpenses();
  const filteredTotal = sortedExpenses.reduce((acc, e) => acc + e.amount, 0);

  // Show login prompt if not authenticated
  if (!currentUser && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <Shield className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please login to access the expense management system.</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (loading && expenses.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <div className="mt-4 text-gray-600">Loading expenses...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Alerts */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2 shadow-sm">
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
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-start gap-2 shadow-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        {/* Report Generation Modal */}
        {showReportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Generate Expense Report</h3>
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setReportType("csv")}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                        reportType === "csv"
                          ? "bg-green-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      CSV
                    </button>
                    <button
                      onClick={() => setReportType("print")}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                        reportType === "print"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Range (Optional)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={reportFilters.startDate}
                      onChange={(e) => setReportFilters({ ...reportFilters, startDate: e.target.value })}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900"
                    />
                    <input
                      type="date"
                      value={reportFilters.endDate}
                      onChange={(e) => setReportFilters({ ...reportFilters, endDate: e.target.value })}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Category</label>
                  <select
                    value={reportFilters.category}
                    onChange={(e) => setReportFilters({ ...reportFilters, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900"
                  >
                    <option value="all">All Categories</option>
                    <option value="Selling and Distribution Costs">Selling and Distribution Costs</option>
                    <option value="Admin Costs">Admin Costs</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Creator</label>
                  <select
                    value={reportFilters.creator}
                    onChange={(e) => setReportFilters({ ...reportFilters, creator: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900"
                  >
                    <option value="all">All Creators</option>
                    {uniqueCreators.map((creator) => (
                      <option key={creator} value={creator}>
                        {creator}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (reportType === "csv") {
                      handleDownloadCSV();
                    } else if (reportType === "print") {
                      handlePrint();
                    }
                    setShowReportModal(false);
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Generate Report
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Expense Details Modal */}
        {showDetailsModal && selectedExpense && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Expense Details</h3>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">Expense ID</label>
                  <p className="text-gray-900 font-mono text-sm">#{selectedExpense.id}</p>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-500">Title</label>
                  <p className="text-gray-900 font-medium">{selectedExpense.title}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Amount</label>
                    <p className="text-red-600 font-bold text-lg">{formatCurrency(selectedExpense.amount)}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Category</label>
                    <p className="text-gray-900">{selectedExpense.category || "Uncategorized"}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Expense Date</label>
                    <p className="text-gray-900">{formatDate(selectedExpense.date)}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Created By</label>
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3 text-gray-400" />
                      <p className="text-gray-900">{selectedExpense.createdByName || selectedExpense.createdBy || "System"}</p>
                    </div>
                    {selectedExpense.createdByEmail && (
                      <p className="text-xs text-gray-400 mt-0.5">{selectedExpense.createdByEmail}</p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Created Date & Time</label>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <p className="text-gray-900">
                        {selectedExpense.createdAtFormatted ? formatDateTime(selectedExpense.createdAtFormatted) : "N/A"}
                      </p>
                    </div>
                  </div>
                  {(selectedExpense.updatedByName || selectedExpense.updatedBy) && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">Last Updated By</label>
                      <p className="text-gray-900">{selectedExpense.updatedByName || selectedExpense.updatedBy || "N/A"}</p>
                      {selectedExpense.updatedByEmail && (
                        <p className="text-xs text-gray-400 mt-0.5">{selectedExpense.updatedByEmail}</p>
                      )}
                    </div>
                  )}
                </div>
                
                {selectedExpense.updatedAtFormatted && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">Last Updated Date & Time</label>
                    <p className="text-gray-900 text-sm">{formatDateTime(selectedExpense.updatedAtFormatted)}</p>
                  </div>
                )}
                
                {selectedExpense.notes && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">Notes & Audit Trail</label>
                    <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {selectedExpense.notes.split('\n').map((line, i) => (
                        <p key={i} className={line.includes('[Created') || line.includes('[Updated') ? 'text-gray-500 text-xs' : ''}>
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Expense Management</h1>
            <div className="text-sm text-gray-600 mt-1">Track and manage all business expenses with full audit trail</div>
            {currentUser && (
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <User className="w-3 h-3" />
                Logged in as: {currentUser.email}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="sm:hidden inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
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
              onClick={() => setShowReportModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm shadow-sm"
            >
              <Download className="w-4 h-4" />
              Report
            </button>
            <button
              onClick={fetchExpenses}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm shadow-sm"
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
                <div className="text-xs font-medium text-gray-600">Total Expenses</div>
                <div className="text-lg sm:text-xl font-bold text-gray-900 mt-1">
                  {formatCurrency(summary.totalAmount)}
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
                <div className="text-xs font-medium text-gray-600">Number of Expenses</div>
                <div className="text-lg sm:text-xl font-bold text-gray-900 mt-1">
                  {summary.totalExpenses}
                </div>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-gray-600">Average Expense</div>
                <div className="text-lg sm:text-xl font-bold text-gray-900 mt-1">
                  {formatCurrency(summary.averageAmount)}
                </div>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-gray-600">Unique Creators</div>
                <div className="text-lg sm:text-xl font-bold text-gray-900 mt-1">
                  {uniqueCreators.length}
                </div>
              </div>
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Add New Expense */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Expense</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Enter expense title"
                value={newExpense.title}
                onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">KSh</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  className="w-full pl-12 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={newExpense.category}
                onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              >
                <option value="">Select Category</option>
                <option value="Selling and Distribution Costs">Selling and Distribution Costs</option>
                <option value="Admin Costs">Admin Costs</option>
                <option value="Others">Others</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={newExpense.date}
                onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
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
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              placeholder="Add any notes or description"
              value={newExpense.notes}
              onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
          </div>
        </div>

        {/* Filters - Desktop */}
        <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search expenses by title, category, or notes..."
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <Tag className="w-4 h-4 text-gray-500" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                  <option value="all">All Categories</option>
                  <option value="Selling and Distribution Costs">Selling and Distribution Costs</option>
                  <option value="Admin Costs">Admin Costs</option>
                  <option value="Others">Others</option>
                </select>
              </div>
              
              <div className="flex items-center gap-1">
                <User className="w-4 h-4 text-gray-500" />
                <select
                  value={selectedCreator}
                  onChange={(e) => setSelectedCreator(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                  <option value="all">All Creators</option>
                  {uniqueCreators.map((creator) => (
                    <option key={creator} value={creator}>
                      {creator}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 w-32"
                  placeholder="Start Date"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 w-32"
                  placeholder="End Date"
                />
              </div>
              
              {isFilterActive && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
                >
                  <XCircle className="w-4 h-4" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filters - Mobile Drawer */}
        {showFilters && (
          <div className="sm:hidden bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-gray-900">Filters</h3>
              <button onClick={() => setShowFilters(false)} className="text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search expenses..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900"
                >
                  <option value="all">All Categories</option>
                  <option value="Selling and Distribution Costs">Selling and Distribution Costs</option>
                  <option value="Admin Costs">Admin Costs</option>
                  <option value="Others">Others</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Created By</label>
                <select
                  value={selectedCreator}
                  onChange={(e) => setSelectedCreator(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900"
                >
                  <option value="all">All Creators</option>
                  {uniqueCreators.map((creator) => (
                    <option key={creator} value={creator}>
                      {creator}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
              
              {isFilterActive && (
                <button
                  onClick={clearFilters}
                  className="w-full px-3 py-2 bg-red-500 text-white rounded-lg text-sm font-medium"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Expenses Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">All Expenses</h2>
                <div className="text-sm text-gray-600">
                  {sortedExpenses.length} of {pagination.totalItems} expenses shown
                </div>
              </div>
              
              <div className="text-sm text-gray-600">
                Filtered Total: <span className="font-semibold text-red-600">
                  {formatCurrency(filteredTotal)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            {sortedExpenses.length === 0 ? (
              <div className="px-4 sm:px-6 py-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <div className="text-lg font-medium text-gray-900 mb-2">
                  {expenses.length === 0 ? 'No Expenses Yet' : 'No Matching Expenses'}
                </div>
                <div className="text-sm text-gray-600 max-w-md mx-auto mb-6">
                  {expenses.length === 0 
                    ? 'Start by adding your first expense using the form above.'
                    : 'Try adjusting your search filters to find what you\'re looking for.'
                  }
                </div>
                {expenses.length > 0 && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("title")}
                    >
                      <div className="flex items-center gap-1">
                        Title
                        <SortIcon field="title" />
                      </div>
                    </th>
                    <th 
                      className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("category")}
                    >
                      <div className="flex items-center gap-1">
                        Category
                        <SortIcon field="category" />
                      </div>
                    </th>
                    <th 
                      className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("amount")}
                    >
                      <div className="flex items-center gap-1">
                        Amount
                        <SortIcon field="amount" />
                      </div>
                    </th>
                    <th 
                      className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("date")}
                    >
                      <div className="flex items-center gap-1">
                        Expense Date
                        <SortIcon field="date" />
                      </div>
                    </th>
                    <th 
                      className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("createdBy")}
                    >
                      <div className="flex items-center gap-1">
                        Created By
                        <SortIcon field="createdBy" />
                      </div>
                    </th>
                    <th 
                      className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("createdAt")}
                    >
                      <div className="flex items-center gap-1">
                        Created Date
                        <SortIcon field="createdAt" />
                      </div>
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          <span className="text-xs text-gray-400 font-mono">#{exp.id}</span>
                          <div>{exp.title}</div>
                        </div>
                       </td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          exp.category === 'Selling and Distribution Costs' 
                            ? 'bg-blue-100 text-blue-800'
                            : exp.category === 'Admin Costs'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {exp.category || 'Uncategorized'}
                        </span>
                       </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="text-sm font-bold text-red-600">
                          {formatCurrency(exp.amount)}
                        </div>
                       </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {formatDate(exp.date)}
                        </div>
                       </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {exp.createdByName || exp.createdBy || "System"}
                          </span>
                        </div>
                        {exp.createdByEmail && (
                          <div className="text-xs text-gray-400 ml-5">
                            {exp.createdByEmail}
                          </div>
                        )}
                       </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {exp.createdAtFormatted ? formatDate(exp.createdAtFormatted) : formatDate(exp.createdAt)}
                        </div>
                        {exp.createdAtFormatted && (
                          <div className="text-xs text-gray-400">
                            {new Date(exp.createdAtFormatted).toLocaleTimeString()}
                          </div>
                        )}
                       </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingExpense({
                                id: exp.id,
                                title: exp.title,
                                amount: exp.amount.toString(),
                                category: exp.category || "",
                                notes: exp.notes || "",
                                date: exp.date,
                              });
                            }}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedExpense(exp);
                              setShowDetailsModal(true);
                            }}
                            className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(exp.id, exp.title)}
                            disabled={isDeleting === exp.id}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isDeleting === exp.id
                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title="Delete"
                          >
                            {isDeleting === exp.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                       </td>
                    </tr>
                  ))}
                </tbody>
                {sortedExpenses.length > 0 && (
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={2} className="px-4 sm:px-6 py-3 text-right text-sm font-medium text-gray-900">
                        Total ({sortedExpenses.length} expenses):
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <div className="text-lg font-bold text-red-600">
                          {formatCurrency(filteredTotal)}
                        </div>
                      </td>
                      <td colSpan={4}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </div>

        {/* Edit Expense Modal */}
        {editingExpense && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Edit Expense</h3>
                  <button
                    onClick={() => setEditingExpense(null)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={editingExpense.title}
                    onChange={(e) => setEditingExpense({ ...editingExpense, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">KSh</span>
                    <input
                      type="number"
                      value={editingExpense.amount}
                      onChange={(e) => setEditingExpense({ ...editingExpense, amount: e.target.value })}
                      className="w-full pl-12 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={editingExpense.category}
                    onChange={(e) => setEditingExpense({ ...editingExpense, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  >
                    <option value="">Select Category</option>
                    <option value="Selling and Distribution Costs">Selling and Distribution Costs</option>
                    <option value="Admin Costs">Admin Costs</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={editingExpense.date}
                    onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={editingExpense.notes}
                    onChange={(e) => setEditingExpense({ ...editingExpense, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setEditingExpense(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateExpense}
                  disabled={isEditing === editingExpense.id}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isEditing === editingExpense.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer with Audit Info */}
        <div className="mt-8 text-center">
          <div className="text-xs text-gray-500 mb-2 flex items-center justify-center gap-2">
            <Shield className="w-3 h-3" />
            <span>Expense Management System • Full Audit Trail Enabled</span>
            <History className="w-3 h-3" />
          </div>
          <div className="text-xs text-gray-400">
            Total: {pagination.totalItems} expenses • Last updated: {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpensePage;