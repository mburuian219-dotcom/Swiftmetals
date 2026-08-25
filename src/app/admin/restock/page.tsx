// src/app/admin/restock/page.tsx
"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { 
  Package, Plus, Search, X, Filter, Download, RefreshCw,
  CreditCard, Wallet, Users, TrendingUp, Clock, AlertCircle,
  CheckCircle, ChevronDown, ChevronUp, Trash2, Edit, Eye,
  Moon, Sun, LogOut, LayoutDashboard, ShoppingCart, Receipt,
  BarChart3, UserPlus, Phone, Mail, Calendar, DollarSign,
  FileText, Printer, Building2, User, Home, FileSpreadsheet,
  ClipboardList, Layers, ShoppingBag, History, ArrowRight,
  Save, Send, Share2, Copy, Landmark, FileEdit, Calculator,
  TrendingDown, TrendingUp as TrendingUpIcon, ListChecks
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ==================== INTERFACES ====================

interface Product {
  id: number;
  name: string;
  price: number;
  productionCost?: number;
  category?: string;
  stock?: any;
}

interface Creditor {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  totalOwed: number;
  createdAt: string;
  updatedAt?: string;
}

interface RestockItem {
  productId: number;
  productName: string;
  quantity: number;
  costPrice: number;
  totalCost: number;
  product?: Product;
}

interface RestockRecord {
  id: number;
  productId: number;
  quantity: number;
  costPrice: number;
  totalCost: number;
  paymentSource: string;
  creditorId: number | null;
  creditor?: Creditor | null;
  product?: Product;
  createdAt: string;
  updatedAt: string;
}

interface RestockGroup {
  id: string;
  date: string;
  items: RestockRecord[];
  totalCost: number;
  cashTotal: number;
  creditTotal: number;
  paymentSource: string;
  creditorName?: string;
  creditorId?: number | null;
}

// Payment record for creditors paid
interface CreditorPaymentRecord {
  id: number;
  creditorId: number;
  creditorName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reference?: string;
  notes?: string;
}

// ==================== THEME CONTEXT ====================
const ThemeContext = React.createContext({ theme: 'light', toggleTheme: () => {} });

function useTheme() {
  return React.useContext(ThemeContext);
}

// ==================== NAVIGATION COMPONENT ====================
function NavigationBar({ activePage }: { activePage: string }) {
  const router = useRouter();
  
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
    { id: 'products-sold', label: 'Products Sold', icon: Package, path: '/admin/productssoldreport' },
    { id: 'restock', label: 'Restock', icon: ShoppingCart, path: '/admin/restock' },
    { id: 'sales', label: 'Sales', icon: Receipt, path: '/admin/sales' },
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/admin/reports' },
  ];

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="px-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center space-x-1 overflow-x-auto">
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
      </div>
    </nav>
  );
}

// ==================== MAIN COMPONENT ====================
export default function RestockPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const router = useRouter();
  
  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [restockRecords, setRestockRecords] = useState<RestockRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // UI states
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showCreditorModal, setShowCreditorModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [selectedRestockGroup, setSelectedRestockGroup] = useState<RestockGroup | null>(null);
  
  // Filter states
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("week");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "cash" | "credit">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCreditorId, setSelectedCreditorId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Restock form states
  const [restockItems, setRestockItems] = useState<RestockItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [costPrice, setCostPrice] = useState<string>("");
  const [paymentSource, setPaymentSource] = useState<"cash" | "credit">("cash");
  const [selectedCreditor, setSelectedCreditor] = useState<Creditor | null>(null);
  const [creditorSearch, setCreditorSearch] = useState("");
  const [showCreditorDropdown, setShowCreditorDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Reconciliation data
  const [reconciliationData, setReconciliationData] = useState({
    date: "",
    items: [] as RestockRecord[],
    totalProductionCost: 0,
    paidInCash: 0,
    restockedOnCredit: 0,
    creditorsPaid: [] as CreditorPaymentRecord[],
    creditorsPaidTotal: 0,
    paymentsMadeInCash: 0,
    paymentsMadeInCashTotal: 0,
    openingWIP: 0,
    cashProductionCosts: 0,
    closingWIP: 0,
    balance: 0,
    notes: "",
    // Manual entry fields
    manualCreditorsPaid: 0,
    manualPaymentsMadeInCash: 0,
    manualOpeningWIP: 0,
    manualClosingWIP: 0,
    // Calculated fields
    totalCashDisbursed: 0,
    wipBalance: 0
  });
  
  // New creditor form states
  const [newCreditor, setNewCreditor] = useState({
    name: "",
    phone: "",
    email: ""
  });
  const [isAddingCreditor, setIsAddingCreditor] = useState(false);
  
  // Refs
  const productDropdownRef = React.useRef<HTMLDivElement>(null);
  const creditorDropdownRef = React.useRef<HTMLDivElement>(null);

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

  // ==================== HELPER FUNCTIONS ====================
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDateTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getProductStock = (product: Product) => {
    if (Array.isArray(product.stock)) {
      return product.stock.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0);
    }
    return product.stock?.quantity || 0;
  };

  // ==================== DATA FETCHING ====================
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Please log in to view restocks");
        setLoading(false);
        return;
      }

      const token = await user.getIdToken();

      // Fetch products
      const productsRes = await fetch("/api/products", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(Array.isArray(data) ? data : (data.products || []));
      }

      // Fetch creditors
      const creditorsRes = await fetch("/api/creditors", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (creditorsRes.ok) {
        const data = await creditorsRes.json();
        setCreditors(Array.isArray(data) ? data : (data.creditors || []));
      }

      // Fetch restock records
      const restockRes = await fetch("/api/restock?limit=1000", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (restockRes.ok) {
        const data = await restockRes.json();
        setRestockRecords(Array.isArray(data) ? data : (data.restocks || data.data || []));
      }

    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchData();
      } else {
        setError("Please log in to view restocks");
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, []);

  // ==================== FILTERED DATA ====================
  const getFilteredRestocks = useCallback(() => {
    let filtered = [...restockRecords];
    
    if (paymentFilter !== "all") {
      filtered = filtered.filter(r => r.paymentSource === paymentFilter);
    }
    
    if (selectedCreditorId) {
      filtered = filtered.filter(r => r.creditorId === Number(selectedCreditorId));
    }
    
    const now = new Date();
    let startDate = new Date(0);
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    
    switch (dateRange) {
      case "today":
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "month":
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "all":
      default:
        break;
    }
    
    filtered = filtered.filter(r => {
      const recordDate = new Date(r.createdAt);
      return recordDate >= startDate && recordDate <= endDate;
    });
    
    const groupedMap = new Map<string, RestockGroup>();
    for (const record of filtered) {
      const dateKey = new Date(record.createdAt).toDateString();
      if (!groupedMap.has(dateKey)) {
        groupedMap.set(dateKey, {
          id: dateKey,
          date: record.createdAt,
          items: [],
          totalCost: 0,
          cashTotal: 0,
          creditTotal: 0,
          paymentSource: record.paymentSource,
          creditorName: record.creditor?.name || "N/A",
          creditorId: record.creditorId
        });
      }
      const group = groupedMap.get(dateKey)!;
      group.items.push(record);
      group.totalCost += record.totalCost;
      if (record.paymentSource === 'cash') {
        group.cashTotal += record.totalCost;
      } else {
        group.creditTotal += record.totalCost;
      }
    }
    
    const groupedArray = Array.from(groupedMap.values());
    groupedArray.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return groupedArray;
  }, [restockRecords, paymentFilter, selectedCreditorId, dateRange]);

  const filteredCreditors = useMemo(() => {
    if (!creditorSearch.trim()) return creditors.slice(0, 10);
    return creditors.filter(c => 
      c.name.toLowerCase().includes(creditorSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(creditorSearch))
    ).slice(0, 10);
  }, [creditors, creditorSearch]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 10);
    return products.filter(p => 
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(productSearch.toLowerCase()))
    ).slice(0, 10);
  }, [products, productSearch]);

  // ==================== CRUD OPERATIONS ====================
  
  const addRestockItem = () => {
    if (!selectedProduct) {
      setError("Please select a product");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (quantity <= 0) {
      setError("Quantity must be greater than 0");
      setTimeout(() => setError(null), 3000);
      return;
    }

    const cost = parseFloat(costPrice);
    if (isNaN(cost) || cost <= 0) {
      setError("Please enter a valid cost price");
      setTimeout(() => setError(null), 3000);
      return;
    }

    const existingItem = restockItems.find(item => item.productId === selectedProduct.id);
    if (existingItem) {
      setRestockItems(restockItems.map(item => 
        item.productId === selectedProduct.id 
          ? { ...item, quantity: item.quantity + quantity, costPrice: cost, totalCost: (item.quantity + quantity) * cost }
          : item
      ));
    } else {
      setRestockItems([...restockItems, {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity: quantity,
        costPrice: cost,
        totalCost: quantity * cost
      }]);
    }

    setSelectedProduct(null);
    setProductSearch("");
    setQuantity(1);
    setCostPrice("");
    setShowProductDropdown(false);
    setError(null);
  };

  const removeRestockItem = (productId: number) => {
    setRestockItems(restockItems.filter(item => item.productId !== productId));
  };

  const clearRestockItems = () => {
    setRestockItems([]);
  };

  const submitRestock = async () => {
    if (restockItems.length === 0) {
      setError("Please add at least one item to restock");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (paymentSource === "credit" && !selectedCreditor) {
      setError("Please select a creditor for credit purchase");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Please log in to restock");
        setIsSubmitting(false);
        return;
      }

      const token = await user.getIdToken();

      const promises = restockItems.map(item => {
        const restockData = {
          productId: item.productId,
          quantity: item.quantity,
          costPrice: item.costPrice,
          totalCost: item.totalCost,
          paymentSource: paymentSource,
          creditorId: paymentSource === "credit" ? selectedCreditor?.id : undefined
        };

        return fetch("/api/restock", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(restockData)
        });
      });

      const results = await Promise.all(promises);
      const failed = results.filter(r => !r.ok);

      if (failed.length > 0) {
        throw new Error(`Failed to restock ${failed.length} item(s)`);
      }

      setSuccess(`✅ Successfully restocked ${restockItems.length} item(s)!`);
      setTimeout(() => setSuccess(null), 4000);

      setRestockItems([]);
      setSelectedProduct(null);
      setProductSearch("");
      setQuantity(1);
      setCostPrice("");
      setPaymentSource("cash");
      setSelectedCreditor(null);
      setCreditorSearch("");
      setShowRestockModal(false);

      await fetchData();

    } catch (err: any) {
      console.error("Error submitting restock:", err);
      setError(err.message || "Failed to submit restock");
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCreditor = async () => {
    if (!newCreditor.name.trim()) {
      setError("Creditor name is required");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsAddingCreditor(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Please log in");
        setIsAddingCreditor(false);
        return;
      }

      const token = await user.getIdToken();

      const response = await fetch("/api/creditors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newCreditor.name.trim(),
          phone: newCreditor.phone.trim() || undefined,
          email: newCreditor.email.trim() || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create creditor");
      }

      const createdCreditor = await response.json();
      setCreditors(prev => [...prev, createdCreditor]);
      setSelectedCreditor(createdCreditor);
      setShowCreditorModal(false);
      setNewCreditor({ name: "", phone: "", email: "" });
      setSuccess("Creditor created successfully!");
      setTimeout(() => setSuccess(null), 3000);

    } catch (err: any) {
      console.error("Error creating creditor:", err);
      setError(err.message || "Failed to create creditor");
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsAddingCreditor(false);
    }
  };

  const viewRestockDetails = (group: RestockGroup) => {
    setSelectedRestockGroup(group);
    setShowDetailModal(true);
  };

  // ==================== RECONCILIATION FUNCTIONS ====================
  
  const generateReconciliation = () => {
    const selectedDateObj = new Date(selectedDate);
    const startOfDay = new Date(selectedDateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDateObj);
    endOfDay.setHours(23, 59, 59, 999);

    // Filter restocks for the selected day
    const dayRestocks = restockRecords.filter(r => {
      const recordDate = new Date(r.createdAt);
      return recordDate >= startOfDay && recordDate <= endOfDay;
    });

    // Calculate totals
    const totalProductionCost = dayRestocks.reduce((sum, r) => sum + r.totalCost, 0);
    const cashTotal = dayRestocks.filter(r => r.paymentSource === 'cash').reduce((sum, r) => sum + r.totalCost, 0);
    const creditTotal = dayRestocks.filter(r => r.paymentSource === 'credit').reduce((sum, r) => sum + r.totalCost, 0);

    // Get creditors paid that day (from payments)
    // This would come from your payments API - for now we'll use a placeholder
    const creditorsPaid: CreditorPaymentRecord[] = [];

    setReconciliationData({
      date: selectedDate,
      items: dayRestocks,
      totalProductionCost,
      paidInCash: cashTotal,
      restockedOnCredit: creditTotal,
      creditorsPaid: creditorsPaid,
      creditorsPaidTotal: 0,
      paymentsMadeInCash: 0,
      paymentsMadeInCashTotal: 0,
      openingWIP: 0,
      cashProductionCosts: cashTotal,
      closingWIP: 0,
      balance: 0,
      notes: "",
      manualCreditorsPaid: 0,
      manualPaymentsMadeInCash: 0,
      manualOpeningWIP: 0,
      manualClosingWIP: 0,
      totalCashDisbursed: 0,
      wipBalance: 0
    });

    setShowReconciliationModal(true);
  };

  const calculateReconciliation = useCallback(() => {
    const totalCashDisbursed = reconciliationData.manualOpeningWIP + reconciliationData.cashProductionCosts;
    const wipBalance = totalCashDisbursed - reconciliationData.manualPaymentsMadeInCash - reconciliationData.manualCreditorsPaid - reconciliationData.manualClosingWIP;
    
    setReconciliationData(prev => ({
      ...prev,
      totalCashDisbursed,
      wipBalance
    }));
  }, [reconciliationData.manualOpeningWIP, reconciliationData.cashProductionCosts, reconciliationData.manualPaymentsMadeInCash, reconciliationData.manualCreditorsPaid, reconciliationData.manualClosingWIP]);

  useEffect(() => {
    if (showReconciliationModal) {
      calculateReconciliation();
    }
  }, [showReconciliationModal, calculateReconciliation]);

  const generateReconciliationReport = () => {
    const report = `
=== RESTOCK RECONCILIATION REPORT ===
Date: ${formatDate(reconciliationData.date)}

ITEMS RESTOCKED:
${reconciliationData.items.map(item => 
  `- ${item.product?.name || `Product ID: ${item.productId}`}: ${item.quantity} units × KSh ${formatCurrency(item.costPrice)} = KSh ${formatCurrency(item.totalCost)} (${item.paymentSource.toUpperCase()})`
).join('\n')}

SUMMARY:
Total Production Cost: KSh ${formatCurrency(reconciliationData.totalProductionCost)}
Paid in Cash: KSh ${formatCurrency(reconciliationData.paidInCash)}
Restocked on Credit: KSh ${formatCurrency(reconciliationData.restockedOnCredit)}

PAYMENTS:
Creditors Paid: KSh ${formatCurrency(reconciliationData.manualCreditorsPaid)}
Payments made in Cash: KSh ${formatCurrency(reconciliationData.manualPaymentsMadeInCash)}

CREDITORS PAID TODAY:
${reconciliationData.creditorsPaid.length > 0 ? 
  reconciliationData.creditorsPaid.map(c => 
    `- ${c.creditorName}: KSh ${formatCurrency(c.amount)} (${c.paymentMethod})`
  ).join('\n') : 
  'No creditors paid today'}

WORK IN PROGRESS:
Opening WIP: KSh ${formatCurrency(reconciliationData.manualOpeningWIP)}
Cash Production Costs: KSh ${formatCurrency(reconciliationData.cashProductionCosts)}
Payments made in Cash: KSh ${formatCurrency(reconciliationData.manualPaymentsMadeInCash)}
Creditors Paid: KSh ${formatCurrency(reconciliationData.manualCreditorsPaid)}
Closing WIP: KSh ${formatCurrency(reconciliationData.manualClosingWIP)}

CALCULATIONS:
Total Cash Disbursed: KSh ${formatCurrency(reconciliationData.totalCashDisbursed)}
WIP Balance: KSh ${formatCurrency(reconciliationData.wipBalance)}

Notes: ${reconciliationData.notes || 'N/A'}
=====================================
Generated: ${new Date().toLocaleString()}
    `;
    return report;
  };

  const exportReconciliationCSV = () => {
    const report = generateReconciliationReport();
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reconciliation_${reconciliationData.date}.txt`);
    link.click();
    URL.revokeObjectURL(url);
  };

  // ==================== EXPORT ====================
  const exportToCSV = () => {
    const groups = getFilteredRestocks();
    if (groups.length === 0) return;

    const csvData: any[] = [];
    for (const group of groups) {
      for (const item of group.items) {
        csvData.push({
          'Date': formatDate(item.createdAt),
          'Product': item.product?.name || `Product ID: ${item.productId}`,
          'Quantity': item.quantity,
          'Cost Price (KSh)': item.costPrice.toFixed(2),
          'Total Cost (KSh)': item.totalCost.toFixed(2),
          'Payment Source': item.paymentSource.toUpperCase(),
          'Creditor': item.creditor?.name || 'N/A'
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
    link.setAttribute('download', `restock_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  // ==================== SUMMARY STATS ====================
  const getSummaryStats = useCallback(() => {
    const groups = getFilteredRestocks();
    let totalItems = 0;
    let totalCost = 0;
    let cashTotal = 0;
    let creditTotal = 0;
    let uniqueProducts = new Set<number>();

    for (const group of groups) {
      for (const item of group.items) {
        totalItems += item.quantity;
        totalCost += item.totalCost;
        uniqueProducts.add(item.productId);
        if (item.paymentSource === 'cash') {
          cashTotal += item.totalCost;
        } else {
          creditTotal += item.totalCost;
        }
      }
    }

    return {
      totalItems,
      totalCost,
      cashTotal,
      creditTotal,
      uniqueProducts: uniqueProducts.size,
      totalGroups: groups.length
    };
  }, [getFilteredRestocks]);

  // ==================== RENDER ====================
  const filteredGroups = getFilteredRestocks();
  const stats = getSummaryStats();

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={`min-h-screen transition-colors duration-200 ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        
        <NavigationBar activePage="restock" />
        
        <button
          onClick={toggleTheme}
          className="fixed bottom-4 right-4 z-50 p-2.5 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all"
        >
          {theme === 'light' ? <Moon size={18} className="text-gray-700" /> : <Sun size={18} className="text-yellow-500" />}
        </button>
        
        <div className="p-3 sm:p-6 max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent flex items-center gap-2">
                  <Package size={24} />
                  Restock Management
                </h1>
                <p className="text-xs text-gray-500 mt-1">Track and manage inventory restocks with reconciliation</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowRestockModal(true)}
                  className="bg-orange-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-orange-700 transition-colors"
                >
                  <Plus size={16} />
                  New Restock
                </button>
                <button
                  onClick={generateReconciliation}
                  className="bg-purple-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-purple-700 transition-colors"
                >
                  <FileSpreadsheet size={16} />
                  Reconcile
                </button>
                <button
                  onClick={exportToCSV}
                  disabled={filteredGroups.length === 0}
                  className="bg-green-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <Download size={16} />
                  Export
                </button>
                <button
                  onClick={fetchData}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Error & Success Messages */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl mb-4 flex justify-between items-center">
              <div className="flex items-center gap-2"><AlertCircle size={18} />{error}</div>
              <button onClick={() => setError(null)} className="text-red-700">×</button>
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-xl mb-4 flex justify-between items-center">
              <div className="flex items-center gap-2"><CheckCircle size={18} />{success}</div>
              <button onClick={() => setSuccess(null)} className="text-green-700">×</button>
            </div>
          )}

          {/* Summary Cards */}
          {!loading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-blue-500">
                <div className="text-xs text-gray-500">Total Restocks</div>
                <div className="text-xl font-bold text-blue-600">{stats.totalGroups}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-green-500">
                <div className="text-xs text-gray-500">Items Restocked</div>
                <div className="text-xl font-bold text-green-600">{stats.totalItems}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-purple-500">
                <div className="text-xs text-gray-500">Unique Products</div>
                <div className="text-xl font-bold text-purple-600">{stats.uniqueProducts}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-emerald-500">
                <div className="text-xs text-gray-500">Cash Payments</div>
                <div className="text-xl font-bold text-emerald-600">KSh {formatCurrency(stats.cashTotal)}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-red-500">
                <div className="text-xs text-gray-500">Credit Payments</div>
                <div className="text-xl font-bold text-red-600">KSh {formatCurrency(stats.creditTotal)}</div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
            <div className="p-3 border-b dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-500" />
                <span className="font-medium text-sm">Filters & Reconciliation</span>
              </div>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date Range</label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value as any)}
                    className="w-full p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="today">Today</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                    <option value="all">All Time</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Type</label>
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value as any)}
                    className="w-full p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="all">All</option>
                    <option value="cash">Cash</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Creditor</label>
                  <select
                    value={selectedCreditorId}
                    onChange={(e) => setSelectedCreditorId(e.target.value)}
                    className="w-full p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="">All Creditors</option>
                    {creditors.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Product or creditor..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Reconcile Date</label>
                  <div className="flex gap-1">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="flex-1 p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                    />
                    <button
                      onClick={generateReconciliation}
                      className="px-2 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      title="Generate Reconciliation"
                    >
                      <FileSpreadsheet size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Restock Records */}
          {!loading && (
            <>
              {filteredGroups.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center">
                  <Package size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No restock records found</p>
                  <p className="text-xs text-gray-400 mt-1">Start by creating a new restock</p>
                  <button
                    onClick={() => setShowRestockModal(true)}
                    className="mt-3 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    <Plus size={16} className="inline mr-1" />
                    New Restock
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredGroups.map((group) => (
                    <div key={group.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="p-4 flex flex-wrap justify-between items-center border-b dark:border-gray-700 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-gray-500" />
                            <span className="font-medium">{formatDate(group.date)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              group.paymentSource === 'cash' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {group.paymentSource.toUpperCase()}
                            </span>
                          </div>
                          {group.creditorName && group.creditorName !== "N/A" && (
                            <div className="flex items-center gap-1">
                              <Building2 size={14} className="text-gray-500" />
                              <span className="text-sm font-medium">{group.creditorName}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-500">Cash:</span>
                            <span className="font-medium text-green-600">KSh {formatCurrency(group.cashTotal)}</span>
                            <span className="text-gray-400">|</span>
                            <span className="text-gray-500">Credit:</span>
                            <span className="font-medium text-red-600">KSh {formatCurrency(group.creditTotal)}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="text-right">
                            <div className="text-sm text-gray-500">Total Cost</div>
                            <div className="text-lg font-bold text-orange-600">KSh {formatCurrency(group.totalCost)}</div>
                          </div>
                          <button
                            onClick={() => viewRestockDetails(group)}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center gap-1"
                          >
                            <Eye size={14} />
                            View Details
                          </button>
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {group.items.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 flex justify-between items-center">
                              <div>
                                <div className="text-sm font-medium">{item.product?.name || `Product ID: ${item.productId}`}</div>
                                <div className="text-xs text-gray-500">Qty: {item.quantity} × KSh {formatCurrency(item.costPrice)}</div>
                              </div>
                              <div className="text-sm font-semibold text-orange-600">KSh {formatCurrency(item.totalCost)}</div>
                            </div>
                          ))}
                          {group.items.length > 3 && (
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 flex items-center justify-center text-sm text-gray-500">
                              +{group.items.length - 3} more items
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Footer Stats */}
          {!loading && filteredGroups.length > 0 && (
            <div className="mt-4 text-center text-xs text-gray-400">
              Showing {filteredGroups.length} restock groups | Total items: {stats.totalItems} | Total cost: KSh {formatCurrency(stats.totalCost)}
            </div>
          )}
        </div>
      </div>

      {/* ==================== RESTOCK MODAL ==================== */}
      {showRestockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl mt-4 sm:mt-0">
            <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-amber-600 text-white p-4 sm:p-6 rounded-t-xl sm:rounded-t-2xl z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Package className="w-6 h-6 sm:w-8 sm:h-8" />
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold">New Restock</h2>
                    <p className="text-orange-100 text-xs sm:text-sm">Add items to inventory</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowRestockModal(false);
                    setRestockItems([]);
                    setSelectedProduct(null);
                    setProductSearch("");
                    setQuantity(1);
                    setCostPrice("");
                    setPaymentSource("cash");
                    setSelectedCreditor(null);
                    setCreditorSearch("");
                    setError(null);
                  }}
                  type="button"
                  className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {/* Add Product Section */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                  <Plus size={16} />
                  Add Product to Restock
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative" ref={productDropdownRef}>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Product *</label>
                    <div className="relative">
                      <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search product..."
                        value={selectedProduct ? selectedProduct.name : productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          setSelectedProduct(null);
                          setShowProductDropdown(true);
                        }}
                        onFocus={() => setShowProductDropdown(true)}
                        className="w-full pl-8 p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-600 dark:border-gray-600"
                      />
                    </div>
                    {showProductDropdown && !selectedProduct && filteredProducts.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                        {filteredProducts.map(product => {
                          const stock = getProductStock(product);
                          return (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => {
                                setSelectedProduct(product);
                                setProductSearch(product.name);
                                setShowProductDropdown(false);
                                if (!costPrice && product.productionCost) {
                                  setCostPrice(product.productionCost.toString());
                                }
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 border-b last:border-b-0 transition-colors text-sm"
                            >
                              <div className="font-medium">{product.name}</div>
                              <div className="text-xs text-gray-500">Stock: {stock} | Cost: KSh {formatCurrency(product.productionCost || 0)}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-600 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Cost Price (KSh) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      placeholder="Enter cost price"
                      className="w-full p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-600 dark:border-gray-600"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={addRestockItem}
                      disabled={!selectedProduct || quantity <= 0 || !costPrice}
                      className="w-full px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus size={16} />
                      Add Item
                    </button>
                  </div>
                </div>
                {selectedProduct && quantity > 0 && costPrice && (
                  <div className="mt-2 text-xs text-gray-500">
                    Subtotal: KSh {formatCurrency(quantity * parseFloat(costPrice))}
                  </div>
                )}
              </div>

              {/* Restock Items List */}
              {restockItems.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2 flex justify-between items-center border-b">
                    <span className="font-semibold text-sm">Items to Restock ({restockItems.length})</span>
                    <button
                      onClick={clearRestockItems}
                      className="text-red-600 text-xs hover:text-red-800 transition-colors flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      Clear All
                    </button>
                  </div>
                  <div className="divide-y">
                    {restockItems.map((item, idx) => (
                      <div key={idx} className="px-4 py-2 flex justify-between items-center">
                        <div>
                          <div className="font-medium text-sm">{item.productName}</div>
                          <div className="text-xs text-gray-500">
                            {item.quantity} × KSh {formatCurrency(item.costPrice)} = KSh {formatCurrency(item.totalCost)}
                          </div>
                        </div>
                        <button
                          onClick={() => removeRestockItem(item.productId)}
                          className="text-red-600 hover:text-red-800 transition-colors p-1"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2 border-t flex justify-between">
                    <span className="font-semibold">Total:</span>
                    <span className="font-bold text-orange-600">KSh {formatCurrency(restockItems.reduce((sum, item) => sum + item.totalCost, 0))}</span>
                  </div>
                </div>
              )}

              {/* Payment Details */}
              {restockItems.length > 0 && (
                <div className="border rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-gray-800 dark:text-white">Payment Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Source *</label>
                      <select
                        value={paymentSource}
                        onChange={(e) => {
                          setPaymentSource(e.target.value as "cash" | "credit");
                          if (e.target.value === "cash") {
                            setSelectedCreditor(null);
                            setCreditorSearch("");
                          }
                        }}
                        className="w-full p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-600 dark:border-gray-600"
                      >
                        <option value="cash">Cash</option>
                        <option value="credit">Credit</option>
                      </select>
                    </div>
                    {paymentSource === "credit" && (
                      <div className="relative" ref={creditorDropdownRef}>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Creditor *</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search creditor..."
                              value={selectedCreditor ? selectedCreditor.name : creditorSearch}
                              onChange={(e) => {
                                setCreditorSearch(e.target.value);
                                setSelectedCreditor(null);
                                setShowCreditorDropdown(true);
                              }}
                              onFocus={() => setShowCreditorDropdown(true)}
                              className="w-full pl-8 p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-600 dark:border-gray-600"
                            />
                          </div>
                          <button
                            onClick={() => {
                              setShowCreditorModal(true);
                              setShowCreditorDropdown(false);
                            }}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 text-sm"
                          >
                            <UserPlus size={14} />
                            New
                          </button>
                        </div>
                        {showCreditorDropdown && !selectedCreditor && filteredCreditors.length > 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                            {filteredCreditors.map(creditor => (
                              <button
                                key={creditor.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCreditor(creditor);
                                  setCreditorSearch(creditor.name);
                                  setShowCreditorDropdown(false);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 border-b last:border-b-0 transition-colors text-sm"
                              >
                                <div className="font-medium">{creditor.name}</div>
                                <div className="text-xs text-gray-500">
                                  Owed: KSh {formatCurrency(creditor.totalOwed)}
                                  {creditor.phone && ` | ${creditor.phone}`}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t">
                <button
                  onClick={() => {
                    setShowRestockModal(false);
                    setRestockItems([]);
                    setSelectedProduct(null);
                    setProductSearch("");
                    setQuantity(1);
                    setCostPrice("");
                    setPaymentSource("cash");
                    setSelectedCreditor(null);
                    setCreditorSearch("");
                    setError(null);
                  }}
                  type="button"
                  disabled={isSubmitting}
                  className="flex-1 px-3 py-2 border-2 border-slate-300 text-black rounded-lg hover:bg-slate-50 font-medium transition-colors disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={submitRestock}
                  disabled={restockItems.length === 0 || isSubmitting || (paymentSource === "credit" && !selectedCreditor)}
                  className="flex-1 px-3 py-2 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-lg hover:from-orange-700 hover:to-amber-700 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow text-sm"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Restock Items
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CREDITOR MODAL ==================== */}
      {showCreditorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full shadow-2xl">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-t-xl flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">Add New Creditor</h2>
                <p className="text-blue-100 text-sm">Create a new creditor</p>
              </div>
              <button
                onClick={() => {
                  setShowCreditorModal(false);
                  setNewCreditor({ name: "", phone: "", email: "" });
                  setError(null);
                }}
                className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={newCreditor.name}
                  onChange={(e) => setNewCreditor({ ...newCreditor, name: e.target.value })}
                  placeholder="Enter creditor name"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                <input
                  type="tel"
                  value={newCreditor.phone}
                  onChange={(e) => setNewCreditor({ ...newCreditor, phone: e.target.value })}
                  placeholder="Enter phone number"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={newCreditor.email}
                  onChange={(e) => setNewCreditor({ ...newCreditor, email: e.target.value })}
                  placeholder="Enter email address"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowCreditorModal(false);
                    setNewCreditor({ name: "", phone: "", email: "" });
                    setError(null);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCreditor}
                  disabled={isAddingCreditor || !newCreditor.name.trim()}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {isAddingCreditor ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      Add Creditor
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DETAIL MODAL ==================== */}
      {showDetailModal && selectedRestockGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-t-xl flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Restock Details</h2>
                <p className="text-blue-100 text-sm">{formatDate(selectedRestockGroup.date)}</p>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedRestockGroup(null);
                }}
                className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Total Items</div>
                  <div className="text-xl font-bold text-blue-600">
                    {selectedRestockGroup.items.reduce((sum, item) => sum + item.quantity, 0)}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Total Cost</div>
                  <div className="text-xl font-bold text-green-600">
                    KSh {formatCurrency(selectedRestockGroup.totalCost)}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Payment</div>
                  <div className={`text-sm font-bold ${selectedRestockGroup.paymentSource === 'cash' ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedRestockGroup.paymentSource.toUpperCase()}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Creditor</div>
                  <div className="text-sm font-medium text-gray-800 dark:text-white">
                    {selectedRestockGroup.creditorName || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 border-b">
                    <tr>
                      <th className="text-left p-2 font-semibold">Product</th>
                      <th className="text-center p-2 font-semibold">Quantity</th>
                      <th className="text-right p-2 font-semibold">Cost Price</th>
                      <th className="text-right p-2 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedRestockGroup.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="p-2 font-medium">{item.product?.name || `Product ID: ${item.productId}`}</td>
                        <td className="p-2 text-center">{item.quantity}</td>
                        <td className="p-2 text-right">KSh {formatCurrency(item.costPrice)}</td>
                        <td className="p-2 text-right font-semibold text-green-600">KSh {formatCurrency(item.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t">
                    <tr>
                      <td colSpan={3} className="p-2 text-right font-bold">Total:</td>
                      <td className="p-2 text-right font-bold text-orange-600">KSh {formatCurrency(selectedRestockGroup.totalCost)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="text-xs text-gray-400 text-right">
                Created: {formatDateTime(selectedRestockGroup.items[0]?.createdAt || selectedRestockGroup.date)}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedRestockGroup(null);
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== RECONCILIATION MODAL ==================== */}
      {showReconciliationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-t-xl flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Restock Reconciliation</h2>
                <p className="text-purple-100 text-sm">{formatDate(reconciliationData.date)}</p>
              </div>
              <button
                onClick={() => {
                  setShowReconciliationModal(false);
                }}
                className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Items Restocked - Full Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 border-b font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <Package size={16} />
                  Items Restocked Today
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="text-left p-2 font-semibold">Item</th>
                        <th className="text-center p-2 font-semibold">QTY</th>
                        <th className="text-right p-2 font-semibold">Unit Prod Cost</th>
                        <th className="text-right p-2 font-semibold">Total Prod Cost</th>
                        <th className="text-center p-2 font-semibold">Payment Method</th>
                        <th className="text-right p-2 font-semibold">Cash</th>
                        <th className="text-right p-2 font-semibold">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {reconciliationData.items.length > 0 ? (
                        reconciliationData.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="p-2 font-medium">{item.product?.name || `Product ID: ${item.productId}`}</td>
                            <td className="p-2 text-center">{item.quantity}</td>
                            <td className="p-2 text-right">KSh {formatCurrency(item.costPrice)}</td>
                            <td className="p-2 text-right font-semibold">KSh {formatCurrency(item.totalCost)}</td>
                            <td className="p-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                item.paymentSource === 'cash' 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {item.paymentSource.toUpperCase()}
                              </span>
                            </td>
                            <td className="p-2 text-right text-green-600 font-medium">
                              {item.paymentSource === 'cash' ? `KSh ${formatCurrency(item.totalCost)}` : '-'}
                            </td>
                            <td className="p-2 text-right text-red-600 font-medium">
                              {item.paymentSource === 'credit' ? `KSh ${formatCurrency(item.totalCost)}` : '-'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-gray-500">No items restocked on this day</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t font-semibold">
                      <tr>
                        <td colSpan={3} className="p-2 text-right">Total Production Cost:</td>
                        <td className="p-2 text-right text-blue-600">KSh {formatCurrency(reconciliationData.totalProductionCost)}</td>
                        <td className="p-2"></td>
                        <td className="p-2 text-right text-green-600">KSh {formatCurrency(reconciliationData.paidInCash)}</td>
                        <td className="p-2 text-right text-red-600">KSh {formatCurrency(reconciliationData.restockedOnCredit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Payments Today */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Payments Made */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-green-50 dark:bg-green-900/20 px-4 py-2 border-b font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
                    <Wallet size={16} />
                    Payments Today (Manual Entry)
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Creditors Paid</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">KSh</span>
                        <input
                          type="number"
                          value={reconciliationData.manualCreditorsPaid}
                          onChange={(e) => setReconciliationData({ ...reconciliationData, manualCreditorsPaid: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-12 p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Payments made in Cash</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">KSh</span>
                        <input
                          type="number"
                          value={reconciliationData.manualPaymentsMadeInCash}
                          onChange={(e) => setReconciliationData({ ...reconciliationData, manualPaymentsMadeInCash: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-12 p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Creditors Paid List */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-2 border-b font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <Users size={16} />
                    Creditors Paid Today
                  </div>
                  <div className="p-4">
                    {reconciliationData.creditorsPaid.length > 0 ? (
                      <div className="space-y-2">
                        {reconciliationData.creditorsPaid.map((creditor, idx) => (
                          <div key={idx} className="flex justify-between items-center border-b pb-2">
                            <div>
                              <div className="font-medium">{creditor.creditorName}</div>
                              <div className="text-xs text-gray-500">{creditor.paymentMethod}</div>
                            </div>
                            <div className="font-semibold text-green-600">KSh {formatCurrency(creditor.amount)}</div>
                          </div>
                        ))}
                        <div className="flex justify-between font-bold pt-2 border-t">
                          <span>Total:</span>
                          <span className="text-green-600">KSh {formatCurrency(reconciliationData.creditorsPaid.reduce((sum, c) => sum + c.amount, 0))}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 py-4">No creditors paid today</div>
                    )}
                  </div>
                </div>
              </div>

              {/* WIP Section */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-purple-50 dark:bg-purple-900/20 px-4 py-2 border-b font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                  <Calculator size={16} />
                  Work In Progress (WIP)
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Opening WIP</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">KSh</span>
                        <input
                          type="number"
                          value={reconciliationData.manualOpeningWIP}
                          onChange={(e) => setReconciliationData({ ...reconciliationData, manualOpeningWIP: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-12 p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Cash Production Costs</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">KSh</span>
                        <input
                          type="number"
                          value={reconciliationData.cashProductionCosts}
                          onChange={(e) => setReconciliationData({ ...reconciliationData, cashProductionCosts: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-12 p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Closing WIP</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">KSh</span>
                        <input
                          type="number"
                          value={reconciliationData.manualClosingWIP}
                          onChange={(e) => setReconciliationData({ ...reconciliationData, manualClosingWIP: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-12 p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-600 font-medium">Total Cash Disbursed:</div>
                      <div className="text-right font-bold text-blue-600">KSh {formatCurrency(reconciliationData.totalCashDisbursed)}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-600 font-medium">WIP Balance:</div>
                      <div className={`text-right font-bold ${reconciliationData.wipBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        KSh {formatCurrency(reconciliationData.wipBalance)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={reconciliationData.notes}
                  onChange={(e) => setReconciliationData({ ...reconciliationData, notes: e.target.value })}
                  rows={2}
                  placeholder="Add notes about this reconciliation..."
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-3 border-t">
                <button
                  onClick={() => {
                    setShowReconciliationModal(false);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={exportReconciliationCSV}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Download size={16} />
                  Export Report
                </button>
                <button
                  onClick={() => {
                    const report = generateReconciliationReport();
                    navigator.clipboard.writeText(report);
                    setSuccess("Report copied to clipboard!");
                    setTimeout(() => setSuccess(null), 3000);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Copy size={16} />
                  Copy Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ThemeContext.Provider>
  );
}