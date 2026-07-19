// src/app/admin/creditors/page.tsx
"use client";
import { 
  CreditCard, Plus, Trash2, Edit2, ChevronDown, ChevronUp, X, Loader, Package,
  Calendar, DollarSign, Phone, Mail, Building2, Clock, CheckCircle, 
  AlertCircle, TrendingUp, TrendingDown, Wallet, Receipt, FileText,
  Search, Filter, Download, Printer, Eye, User, ArrowRight
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

// ==================== TYPES ====================

type Restock = {
  id: number;
  createdAt: string;
  costPrice: number;
  quantity: number;
  totalCost: number;
  product: {
    id: number;
    name: string;
    price: number;
    category?: string;
  };
  paymentSource: string;
  creditorId?: number;
};

type Payment = {
  id: number;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reference?: string;
  notes?: string;
};

type Creditor = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  totalOwed: number;
  restocks: Restock[];
  payments?: Payment[];
};

type FormData = {
  name: string;
  phone: string;
  email: string;
  totalOwed: number;
};

type PaymentFormData = {
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  reference: string;
  notes: string;
};

// ==================== NAVIGATION COMPONENT ====================
function NavigationBar({ activePage }: { activePage: string }) {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const navItems = [
    { id: "dashboard", label: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
  ];

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-50">
      <div className="px-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between h-14">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Menu size={20} className="text-gray-600 dark:text-gray-300" />
          </button>

          <div className="hidden lg:flex items-center space-x-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => router.push(item.path)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive 
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                auth.signOut();
                router.push('/login');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="lg:hidden py-2 border-t border-gray-200 dark:border-gray-700">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    router.push(item.path);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}

// Import necessary icons
import { 
  LayoutDashboard, ShoppingCart, LogOut, Menu, 
  Home, BarChart3, Moon, Sun 
} from "lucide-react";
import { auth } from "@/lib/firebase";

// ==================== MAIN COMPONENT ====================
export default function CreditorsSection() {
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedCreditor, setSelectedCreditor] = useState<Creditor | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("all");
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    email: "",
    totalOwed: 0,
  });

  const [paymentForm, setPaymentForm] = useState<PaymentFormData>({
    amount: "",
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: "cash",
    reference: "",
    notes: "",
  });

  // ==================== THEME HANDLING ====================
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
  }, []);
  
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // ==================== DATA FETCHING ====================
  const fetchCreditors = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch("/api/creditors", { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error("Failed to fetch creditors");
      const data = await response.json();
      
      // Ensure each creditor has a payments array
      const creditorsWithPayments = data.map((creditor: any) => ({
        ...creditor,
        payments: creditor.payments || []
      }));
      
      setCreditors(creditorsWithPayments);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError("Request timed out. Please try again.");
      } else {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
      console.error("Error fetching creditors:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditors();
  }, []);

  // ==================== FILTERS & SEARCH ====================
  const filteredCreditors = useMemo(() => {
    let filtered = creditors;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(term) ||
        (c.email && c.email.toLowerCase().includes(term)) ||
        (c.phone && c.phone.includes(term))
      );
    }
    
    return filtered;
  }, [creditors, searchTerm]);

  // ==================== CRUD OPERATIONS ====================
  const openModal = (creditor?: Creditor) => {
    if (creditor) {
      setEditingId(creditor.id);
      setFormData({
        name: creditor.name,
        phone: creditor.phone || "",
        email: creditor.email || "",
        totalOwed: creditor.totalOwed,
      });
    } else {
      setEditingId(null);
      setFormData({ name: "", phone: "", email: "", totalOwed: 0 });
    }
    setShowModal(true);
  };

  const openPaymentModal = (creditor: Creditor) => {
    setSelectedCreditor(creditor);
    setPaymentForm({
      amount: "",
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: "cash",
      reference: "",
      notes: "",
    });
    setShowPaymentModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert("Creditor name is required");
      return;
    }

    try {
      setSubmitting(true);
      let response;

      if (editingId !== null) {
        response = await fetch("/api/creditors", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...formData }),
        });
      } else {
        response = await fetch("/api/creditors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save creditor");
      }

      await fetchCreditors();
      setShowModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this creditor? This will also remove all associated restocks.")) return;

    try {
      const response = await fetch("/api/creditors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete creditor");
      }

      await fetchCreditors();
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedCreditor) return;
    
    const amount = parseFloat(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid payment amount");
      return;
    }

    if (!paymentForm.paymentDate) {
      alert("Please select a payment date");
      return;
    }

    try {
      setSubmitting(true);
      
      const response = await fetch("/api/creditors/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditorId: selectedCreditor.id,
          amount: amount,
          paymentDate: paymentForm.paymentDate,
          paymentMethod: paymentForm.paymentMethod,
          reference: paymentForm.reference,
          notes: paymentForm.notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to record payment");
      }

      await fetchCreditors();
      setShowPaymentModal(false);
      alert("Payment recorded successfully!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== CALCULATIONS ====================
  const calculatePaid = (creditor: Creditor) => {
    const restockTotal = creditor.restocks.reduce((sum, restock) => sum + restock.totalCost, 0);
    const paymentTotal = (creditor.payments || []).reduce((sum, payment) => sum + payment.amount, 0);
    return Math.min(restockTotal, paymentTotal);
  };

  const calculateBalance = (creditor: Creditor) => {
    const totalOwed = creditor.restocks.reduce((sum, restock) => sum + restock.totalCost, 0);
    const totalPaid = (creditor.payments || []).reduce((sum, payment) => sum + payment.amount, 0);
    return totalOwed - totalPaid;
  };

  const calculatePaymentPercentage = (creditor: Creditor) => {
    const totalOwed = creditor.restocks.reduce((sum, restock) => sum + restock.totalCost, 0);
    const totalPaid = (creditor.payments || []).reduce((sum, payment) => sum + payment.amount, 0);
    return totalOwed > 0 ? Math.round((totalPaid / totalOwed) * 100) : 0;
  };

  const formatCurrency = (amount: number) =>
    Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ==================== EXPORT ====================
  const exportToCSV = () => {
    if (creditors.length === 0) return;

    const csvData: any[] = [];
    for (const creditor of creditors) {
      for (const restock of creditor.restocks) {
        csvData.push({
          'Creditor': creditor.name,
          'Phone': creditor.phone || '',
          'Email': creditor.email || '',
          'Product': restock.product.name,
          'Quantity': restock.quantity,
          'Unit Price (KSh)': restock.costPrice.toFixed(2),
          'Total (KSh)': restock.totalCost.toFixed(2),
          'Date': formatDate(restock.createdAt),
          'Payment Source': restock.paymentSource
        });
      }
    }

    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `creditors_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  // ==================== SUMMARY STATS ====================
  const getSummaryStats = () => {
    let totalOwed = 0;
    let totalPaid = 0;
    let totalRestocks = 0;
    let totalCreditors = creditors.length;
    let totalProducts = new Set();

    for (const creditor of creditors) {
      const owed = creditor.restocks.reduce((sum, r) => sum + r.totalCost, 0);
      const paid = (creditor.payments || []).reduce((sum, p) => sum + p.amount, 0);
      totalOwed += owed;
      totalPaid += paid;
      totalRestocks += creditor.restocks.length;
      
      for (const restock of creditor.restocks) {
        totalProducts.add(restock.product.id);
      }
    }

    return {
      totalCreditors,
      totalOwed,
      totalPaid,
      totalRestocks,
      totalProducts: totalProducts.size,
      balance: totalOwed - totalPaid
    };
  };

  const stats = getSummaryStats();

  // ==================== RENDER ====================
  return (
    <div className={`min-h-screen transition-colors duration-200 ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      
      {/* Navigation Bar */}
      <NavigationBar activePage="creditors" />
      
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all"
      >
        {theme === 'light' ? <Moon size={20} className="text-gray-700" /> : <Sun size={20} className="text-yellow-500" />}
      </button>

      <div className="p-3 sm:p-6 max-w-7xl mx-auto pt-4">
        
        {/* Header */}
        <div className="flex flex-col items-start justify-between mb-6 gap-4 md:flex-row md:items-center md:mb-8">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-2 md:gap-3">
              <div className="bg-blue-600 p-2 md:p-3 rounded-lg">
                <CreditCard className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              Accounts Payable
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm lg:text-base mt-1 md:mt-2">Manage suppliers, creditors, and track payments</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportToCSV}
              disabled={creditors.length === 0}
              className="bg-green-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <Download size={16} />
              Export
            </button>
            <button
              onClick={() => openModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-6 py-2 md:py-3 rounded-lg font-medium transition flex items-center gap-2 shadow-lg hover:shadow-xl text-sm md:text-base w-full md:w-auto justify-center"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5" /> Add Creditor
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            {creditors.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4 mb-6 md:mb-8">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 md:p-6 shadow-md border-l-4 border-blue-600">
                  <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm font-medium mb-1 md:mb-2">Total Creditors</p>
                  <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{stats.totalCreditors}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 md:p-6 shadow-md border-l-4 border-purple-600">
                  <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm font-medium mb-1 md:mb-2">Total Owed</p>
                  <p className="text-sm md:text-base font-bold text-purple-600 break-all">KES {formatCurrency(stats.totalOwed)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 md:p-6 shadow-md border-l-4 border-green-500">
                  <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm font-medium mb-1 md:mb-2">Total Paid</p>
                  <p className="text-sm md:text-base font-bold text-green-600 break-all">KES {formatCurrency(stats.totalPaid)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 md:p-6 shadow-md border-l-4 border-red-500">
                  <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm font-medium mb-1 md:mb-2">Balance</p>
                  <p className="text-sm md:text-base font-bold text-red-600 break-all">KES {formatCurrency(stats.balance)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 md:p-6 shadow-md border-l-4 border-orange-500">
                  <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm font-medium mb-1 md:mb-2">Total Restocks</p>
                  <p className="text-2xl md:text-3xl font-bold text-orange-600">{stats.totalRestocks}</p>
                </div>
              </div>
            )}

            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative max-w-md">
                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search creditors by name, email or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>
            </div>

            {/* Creditors List */}
            <div className="space-y-2">
              {filteredCreditors.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-8 md:p-12 text-center shadow-sm">
                  <CreditCard className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 text-gray-300 dark:text-gray-600" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm md:text-lg">No creditors found. Add one to get started.</p>
                </div>
              ) : (
                filteredCreditors.map((creditor) => {
                  const balance = calculateBalance(creditor);
                  const paymentPercentage = calculatePaymentPercentage(creditor);
                  const totalRestocks = creditor.restocks.length;
                  const totalCost = creditor.restocks.reduce((sum, r) => sum + r.totalCost, 0);

                  return (
                    <div key={creditor.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md overflow-hidden transition-all border border-gray-200 dark:border-gray-700">
                      {/* Main Row */}
                      <div
                        onClick={() => setExpandedId(expandedId === creditor.id ? null : creditor.id)}
                        className="p-3 md:p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                      >
                        <div className="flex items-center justify-between gap-3">
                          {/* Left: Name & Contact */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm md:text-base font-bold text-gray-900 dark:text-white truncate">{creditor.name}</h3>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${balance > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                                {balance > 0 ? `KES ${formatCurrency(balance)} due` : 'Fully Paid'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {creditor.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone size={12} /> {creditor.phone}
                                </span>
                              )}
                              {creditor.email && (
                                <span className="flex items-center gap-1 truncate">
                                  <Mail size={12} /> <span className="truncate">{creditor.email}</span>
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Package size={12} /> {totalRestocks} restocks
                              </span>
                            </div>
                          </div>

                          {/* Center: Stats Grid */}
                          <div className="hidden lg:grid grid-cols-3 gap-4 flex-shrink-0">
                            <div className="text-center">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Owed</p>
                              <p className="text-sm font-bold text-purple-600">KES {formatCurrency(totalCost)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Paid</p>
                              <p className="text-sm font-bold text-green-600">KES {formatCurrency(totalCost - balance)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Payment Rate</p>
                              <div className="flex items-center gap-1 justify-center">
                                <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${paymentPercentage > 70 ? 'bg-green-500' : paymentPercentage > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                    style={{ width: `${paymentPercentage}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{paymentPercentage}%</span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openPaymentModal(creditor);
                              }}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 transition-colors flex items-center gap-1"
                            >
                              <Wallet size={14} />
                              Pay
                            </button>
                            
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openModal(creditor);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(creditor.id);
                                }}
                                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <button 
                                className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {expandedId === creditor.id ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Mobile Stats */}
                        <div className="grid grid-cols-3 gap-2 mt-3 lg:hidden">
                          <div className="bg-purple-50 dark:bg-purple-900/20 rounded p-2">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Owed</p>
                            <p className="text-xs font-bold text-purple-600">KES {formatCurrency(totalCost)}</p>
                          </div>
                          <div className="bg-green-50 dark:bg-green-900/20 rounded p-2">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Paid</p>
                            <p className="text-xs font-bold text-green-600">KES {formatCurrency(totalCost - balance)}</p>
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Rate</p>
                            <p className="text-xs font-bold text-blue-600">{paymentPercentage}%</p>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedId === creditor.id && (
                        <div className="px-3 md:px-4 pb-3 md:pb-4 space-y-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                          
                          {/* Payment Summary */}
                          <div className="pt-3">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                              <Wallet className="w-4 h-4 text-green-600" />
                              Payment Summary
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              <div className="bg-white dark:bg-gray-800 rounded p-2 text-center border">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Total Owed</p>
                                <p className="text-sm font-bold text-purple-600">KES {formatCurrency(totalCost)}</p>
                              </div>
                              <div className="bg-white dark:bg-gray-800 rounded p-2 text-center border">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Total Paid</p>
                                <p className="text-sm font-bold text-green-600">KES {formatCurrency(totalCost - balance)}</p>
                              </div>
                              <div className="bg-white dark:bg-gray-800 rounded p-2 text-center border">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Balance</p>
                                <p className={`text-sm font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  {balance > 0 ? `KES ${formatCurrency(balance)}` : '✓ Paid'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Restock History */}
                          <div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                              <Package className="w-4 h-4 text-blue-600" />
                              Restock History ({creditor.restocks.length})
                            </h4>
                            {creditor.restocks.length > 0 ? (
                              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                                {creditor.restocks.map((restock) => (
                                  <div key={restock.id} className="bg-white dark:bg-gray-800 rounded p-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="font-semibold text-gray-900 dark:text-white text-xs truncate">{restock.product.name}</p>
                                          <span className="text-xs text-gray-400">•</span>
                                          <p className="text-xs text-gray-500 dark:text-gray-400">Qty: {restock.quantity}</p>
                                          <span className="text-xs text-gray-400">•</span>
                                          <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(restock.createdAt)}</p>
                                        </div>
                                      </div>
                                      <div className="text-right flex items-center gap-2">
                                        <p className="font-bold text-gray-900 dark:text-white text-xs whitespace-nowrap">KES {formatCurrency(restock.totalCost)}</p>
                                        <span className={`text-xs px-1.5 py-0.5 rounded ${restock.paymentSource === 'cash' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                                          {restock.paymentSource}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">
                                      Unit Price: KES {formatCurrency(restock.costPrice)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-500 dark:text-gray-400 text-xs py-2">No restocks recorded</p>
                            )}
                          </div>

                          {/* Payment History */}
                          <div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                              <Receipt className="w-4 h-4 text-green-600" />
                              Payment History
                            </h4>
                            {(creditor.payments && creditor.payments.length > 0) ? (
                              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {creditor.payments.map((payment) => (
                                  <div key={payment.id} className="bg-white dark:bg-gray-800 rounded p-2.5 flex items-center justify-between border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle size={14} className="text-green-500" />
                                      <div>
                                        <p className="text-xs font-medium text-gray-900 dark:text-white">
                                          {formatDate(payment.paymentDate)}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                          {payment.paymentMethod.toUpperCase()}
                                          {payment.reference && ` • Ref: ${payment.reference}`}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-bold text-green-600">-KES {formatCurrency(payment.amount)}</p>
                                      {payment.notes && (
                                        <p className="text-xs text-gray-400">{payment.notes}</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-500 dark:text-gray-400 text-xs py-2">No payments recorded</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Stats */}
            {creditors.length > 0 && (
              <div className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
                Showing {filteredCreditors.length} of {creditors.length} creditors | Total outstanding: KES {formatCurrency(stats.balance)}
              </div>
            )}
          </>
        )}
      </div>

      {/* ==================== CREDITOR MODAL ==================== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {editingId ? "Edit Creditor" : "Add New Creditor"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                disabled={submitting}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Creditor Name *</label>
                <input
                  type="text"
                  placeholder="Enter creditor name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  placeholder="creditor@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone</label>
                <input
                  type="tel"
                  placeholder="Enter phone number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Total Owed (KES)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={formData.totalOwed}
                  onChange={(e) => setFormData({ ...formData, totalOwed: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition font-medium disabled:opacity-50"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium disabled:opacity-50 flex items-center gap-2"
                disabled={submitting}
              >
                {submitting && <Loader className="w-4 h-4 animate-spin" />}
                {editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PAYMENT MODAL ==================== */}
      {showPaymentModal && selectedCreditor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Record Payment</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pay to: {selectedCreditor.name}</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                disabled={submitting}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Amount (KES) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">KES</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="w-full pl-12 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Payment Date *</label>
                <input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Payment Method *</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                  disabled={submitting}
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="mobile">Mobile Money</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="Payment reference number"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes (Optional)</label>
                <textarea
                  placeholder="Additional notes about this payment"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white resize-none"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition font-medium disabled:opacity-50"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium disabled:opacity-50 flex items-center gap-2"
                disabled={submitting}
              >
                {submitting && <Loader className="w-4 h-4 animate-spin" />}
                <CheckCircle size={16} />
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}