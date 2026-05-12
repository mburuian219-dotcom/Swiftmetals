// app/sales/restore/page.tsx
"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  Plus, X, Save, AlertTriangle, CheckCircle, 
  Search, DollarSign, Package, Calendar, 
  User, CreditCard, Calculator, Trash2,
  RotateCcw, FileText, Info, Filter, ChevronDown,
  ChevronUp, RefreshCw, Warehouse, TrendingUp, Minus, Eye, Loader
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

// Types
interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  inStock: boolean;
  productionCost?: number;
  stock?: Array<{ quantity: number; costPrice: number }>;
  stockQuantity?: number;
}

interface SaleItem {
  id?: number;
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

interface Payment {
  id: number;
  amount: number;
  method: string;
  paidAt: string;
  referenceId?: string;
}

interface Sale {
  id: number;
  customer: Customer;
  date: string;
  dueDate?: string;
  amount: number;
  amountPaid?: number;
  balance?: number;
  status: string;
  saleitems: SaleItem[];
  payments: Payment[];
  hasProducts: boolean;
  updatedAt?: string;
}

interface RestoredItem {
  productId: number;
  productName: string;
  quantity: number;
  price: number;
}

interface RestockItem {
  productId: number;
  productName: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  totalCost: number;
}

interface Creditor {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  totalOwed: number;
}

export default function RestoreSalesPage() {
  const router = useRouter();
  
  // State
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [debugInfo, setDebugInfo] = useState<string>("");
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "PAID" | "PARTIAL" | "UNPAID">("all");
  const [productsFilter, setProductsFilter] = useState<"all" | "has" | "missing">("missing");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [showFilters, setShowFilters] = useState(false);
  
  // Restore modal state
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [restoredItems, setRestoredItems] = useState<RestoredItem[]>([]);
  const [restockItems, setRestockItems] = useState<RestockItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"restore" | "restock">("restore");
  
  // New item form for restoration
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [price, setPrice] = useState<number>(0);
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  
  // Stock operation for restock
  const [stockOperation, setStockOperation] = useState({
    mode: 'add' as 'add' | 'remove',
    quantity: "",
    paymentSource: "cash",
    creditorName: "",
    creditorPhone: "",
    creditorEmail: "",
    reason: "",
  });
  const [processingStock, setProcessingStock] = useState(false);
  const [restockProductSearch, setRestockProductSearch] = useState("");
  const [showRestockProductDropdown, setShowRestockProductDropdown] = useState(false);
  const [loadingCreditors, setLoadingCreditors] = useState(false);
  
  // User info
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);

  // Load all sales with better error handling
  const loadSales = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("Loading sales...");
      
      const response = await fetch("/api/sales");
      console.log("Sales response status:", response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to load sales: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Sales data received:", Array.isArray(data) ? data.length : "not an array");
      
      if (!Array.isArray(data)) {
        throw new Error("Invalid sales data received");
      }
      
      const processedSales = data.map((sale: any) => {
        const totalPaid = sale.payment?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
        const balance = (sale.amount || 0) - totalPaid;
        const hasProducts = sale.saleitem && sale.saleitem.length > 0;
        
        return {
          ...sale,
          amountPaid: totalPaid,
          balance: balance,
          hasProducts: hasProducts,
          saleitems: sale.saleitem || [],
          payments: sale.payment || []
        };
      });
      
      setSales(processedSales);
      setDebugInfo(`Loaded ${processedSales.length} sales, ${processedSales.filter((s: Sale) => !s.hasProducts).length} missing products`);
      console.log("Processed sales:", processedSales.length);
    } catch (err: any) {
      console.error("Error loading sales:", err);
      setError(err.message || "Failed to load sales");
      setDebugInfo(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load products with stock info
  const loadProducts = useCallback(async () => {
    try {
      console.log("Loading products...");
      const response = await fetch("/api/products");
      
      if (!response.ok) {
        throw new Error(`Failed to load products: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Products data received:", Array.isArray(data) ? data.length : "not an array");
      
      if (!Array.isArray(data)) {
        throw new Error("Invalid products data received");
      }
      
      const normalized = data.map((p: any) => ({
        ...p,
        stockQuantity: p.stock?.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0) || 0,
      }));
      setProducts(normalized);
      console.log("Processed products:", normalized.length);
    } catch (err: any) {
      console.error("Error loading products:", err);
      setError(err.message || "Failed to load products");
    }
  }, []);

  // Load creditors
  const fetchCreditors = useCallback(async () => {
    try {
      setLoadingCreditors(true);
      const res = await fetch("/api/creditors");
      if (res.ok) {
        const data = await res.json();
        setCreditors(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch creditors:", err);
    } finally {
      setLoadingCreditors(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      await Promise.all([
        loadSales(),
        loadProducts(),
        fetchCreditors()
      ]);
    };
    init();
  }, [loadSales, loadProducts, fetchCreditors]);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser({
          name: user.displayName || user.email?.split('@')[0] || "User",
          email: user.email || ""
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Filter sales
  const filteredSales = useMemo(() => {
    let filtered = [...sales];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(sale => 
        sale.customer?.name?.toLowerCase().includes(term) ||
        sale.customer?.phone?.toLowerCase().includes(term) ||
        sale.id.toString().includes(term)
      );
    }
    
    if (statusFilter !== "all") {
      filtered = filtered.filter(sale => sale.status === statusFilter);
    }
    
    if (productsFilter === "has") {
      filtered = filtered.filter(sale => sale.hasProducts);
    } else if (productsFilter === "missing") {
      filtered = filtered.filter(sale => !sale.hasProducts);
    }
    
    if (dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.date);
        switch (dateFilter) {
          case "today": return saleDate >= today;
          case "week": {
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return saleDate >= weekAgo;
          }
          case "month": {
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return saleDate >= monthAgo;
          }
          default: return true;
        }
      });
    }
    
    return filtered;
  }, [sales, searchTerm, statusFilter, productsFilter, dateFilter]);

  // Open restore modal
  const openRestoreModal = (sale: Sale) => {
    setSelectedSale(sale);
    setRestoredItems(sale.saleitems.map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      price: item.price,
    })));
    setRestockItems([]);
    setActiveTab("restore");
    setShowRestoreModal(true);
    setWarning(null);
    setError(null);
    
    // Reset forms
    setSelectedProductId(null);
    setQuantity(1);
    setPrice(0);
    setProductSearch("");
    setStockOperation({
      mode: 'add',
      quantity: "",
      paymentSource: "cash",
      creditorName: "",
      creditorPhone: "",
      creditorEmail: "",
      reason: "",
    });
    setRestockProductSearch("");
  };

  // Add item to restoration list
  const addRestoreItem = () => {
    if (!selectedProductId) {
      setError("Please select a product");
      return;
    }
    if (quantity <= 0) {
      setError("Quantity must be greater than 0");
      return;
    }
    if (price <= 0) {
      setError("Price must be greater than 0");
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) {
      setError("Product not found");
      return;
    }

    const existingIndex = restoredItems.findIndex(item => item.productId === selectedProductId);
    if (existingIndex >= 0) {
      const updated = [...restoredItems];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: quantity,
        price: price,
      };
      setRestoredItems(updated);
    } else {
      setRestoredItems([...restoredItems, {
        productId: selectedProductId,
        productName: product.name,
        quantity: quantity,
        price: price,
      }]);
    }

    setSelectedProductId(null);
    setQuantity(1);
    setPrice(0);
    setProductSearch("");
    setError(null);
  };

  // Add item to restock list
  const addRestockItem = async () => {
    if (!restockProductSearch) {
      setError("Please select a product");
      return;
    }
    if (!stockOperation.quantity) {
      setError("Please enter a quantity");
      return;
    }

    const quantityNum = parseInt(stockOperation.quantity);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      setError("Please enter a valid quantity");
      return;
    }

    // Find selected product from search
    const product = products.find(p => 
      p.name.toLowerCase().includes(restockProductSearch.toLowerCase())
    );
    
    if (!product) {
      setError("Please select a product from the dropdown");
      return;
    }

    if (stockOperation.mode === 'add') {
      if (!product.productionCost || product.productionCost <= 0) {
        setError("Please set a production cost for this product first");
        return;
      }

      if (!stockOperation.paymentSource) {
        setError("Please select a payment source");
        return;
      }

      if (stockOperation.paymentSource === "credit") {
        if (!stockOperation.creditorName.trim()) {
          setError("Please enter the creditor name");
          return;
        }
        if (!stockOperation.creditorPhone.trim()) {
          setError("Please enter the creditor phone number");
          return;
        }
      }

      const totalCost = quantityNum * product.productionCost;

      const existingIndex = restockItems.findIndex(item => item.productId === product.id);
      if (existingIndex >= 0) {
        const updated = [...restockItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantityNum,
          totalCost: updated[existingIndex].totalCost + totalCost,
        };
        setRestockItems(updated);
      } else {
        setRestockItems([...restockItems, {
          productId: product.id,
          productName: product.name,
          quantity: quantityNum,
          costPrice: product.productionCost,
          sellingPrice: product.price,
          totalCost: totalCost,
        }]);
      }
    } else {
      // Remove stock
      const currentStock = product.stockQuantity || 0;
      if (quantityNum > currentStock) {
        setError(`Cannot remove more than current stock (${currentStock} units available)`);
        return;
      }
      
      setRestockItems([...restockItems, {
        productId: product.id,
        productName: product.name,
        quantity: quantityNum,
        costPrice: 0,
        sellingPrice: 0,
        totalCost: 0,
      }]);
    }

    setStockOperation({ ...stockOperation, quantity: "" });
    setRestockProductSearch("");
    setError(null);
  };

  // Remove item from restoration list
  const removeRestoreItem = (index: number) => {
    setRestoredItems(restoredItems.filter((_, i) => i !== index));
  };

  // Remove item from restock list
  const removeRestockItem = (index: number) => {
    setRestockItems(restockItems.filter((_, i) => i !== index));
  };

  // Update restore item quantity
  const updateRestoreQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) return;
    const updated = [...restoredItems];
    updated[index].quantity = newQuantity;
    setRestoredItems(updated);
  };

  // Update restore item price
  const updateRestorePrice = (index: number, newPrice: number) => {
    if (newPrice <= 0) return;
    const updated = [...restoredItems];
    updated[index].price = newPrice;
    setRestoredItems(updated);
  };

  // Import contact
  const importContact = async () => {
    try {
      if (!("contacts" in navigator && "ContactsManager" in window)) {
        alert("Contact picker is not supported on this device/browser.");
        return;
      }

      const props = ["name", "tel", "email"];
      const opts = { multiple: false };

      // @ts-ignore
      const contacts = await navigator.contacts.select(props, opts);

      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        setStockOperation({
          ...stockOperation,
          creditorName: contact.name?.[0] || "",
          creditorPhone: contact.tel?.[0] || "",
          creditorEmail: contact.email?.[0] || "",
        });
      }
    } catch (error) {
      console.error("Error importing contact:", error);
      alert("Failed to import contact. Please enter details manually.");
    }
  };

  // Save all changes
  const saveAllChanges = async () => {
    if (!selectedSale) return;
    
    setSaving(true);
    setError(null);
    setWarning(null);
    
    try {
      const ipAddress = await fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => data.ip)
        .catch(() => 'unknown');
      
      // Restore products to sale
      if (restoredItems.length > 0) {
        const restoreResponse = await fetch(`/api/sales/${selectedSale.id}/restore-products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            saleItems: restoredItems,
            updatedBy: currentUser?.name || "SYSTEM",
            updatedByEmail: currentUser?.email,
            ipAddress,
            userAgent: navigator.userAgent,
            forceUpdate: true
          }),
        });

        const restoreData = await restoreResponse.json();
        if (!restoreResponse.ok) {
          throw new Error(restoreData.error || "Failed to restore products");
        }
      }
      
      // Process restock items
      if (restockItems.length > 0) {
        for (const item of restockItems) {
          // Check if this is a restock (add) or removal
          const isAdding = stockOperation.mode === 'add' || 
            (restockItems.length > 0 && item.costPrice > 0);
          
          if (isAdding) {
            // Add stock
            const totalCost = item.quantity * item.costPrice;
            
            const res = await fetch("/api/restock", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                productId: item.productId,
                quantity: item.quantity,
                totalCost,
                paymentSource: stockOperation.paymentSource || "cash",
                creditorName: stockOperation.paymentSource === "credit" ? stockOperation.creditorName : undefined,
                creditorPhone: stockOperation.paymentSource === "credit" ? stockOperation.creditorPhone : undefined,
                creditorEmail: stockOperation.paymentSource === "credit" ? stockOperation.creditorEmail : undefined,
              }),
            });

            if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || `Failed to restock ${item.productName}`);
            }
          } else {
            // Remove stock
            const res = await fetch("/api/restock", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                productId: item.productId,
                quantity: item.quantity,
                reason: stockOperation.reason || "Stock adjustment during sale restoration",
              }),
            });

            if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || `Failed to remove stock from ${item.productName}`);
            }
          }
        }
      }
      
      let successMessage = "";
      if (restoredItems.length > 0 && restockItems.length > 0) {
        successMessage = "Products restored and inventory updated successfully!";
      } else if (restoredItems.length > 0) {
        successMessage = "Products restored successfully!";
      } else if (restockItems.length > 0) {
        successMessage = "Inventory updated successfully!";
      } else {
        successMessage = "No changes were made.";
      }
      
      setSuccess(successMessage);
      
      setTimeout(() => {
        setShowRestoreModal(false);
        loadSales();
        loadProducts();
        setSuccess(null);
      }, 2000);
      
    } catch (err: any) {
      console.error("Error saving:", err);
      setError(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  // Filter products for dropdowns
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredRestockProducts = products.filter(product =>
    product.name.toLowerCase().includes(restockProductSearch.toLowerCase())
  );

  // Format helpers
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Calculate totals
  const reconstructedTotal = restoredItems.reduce((sum, item) => 
    sum + (item.quantity * item.price), 0
  );
  
  const restockTotal = restockItems.reduce((sum, item) => 
    sum + item.totalCost, 0
  );
  
  const matchesOriginal = selectedSale ? Math.abs(reconstructedTotal - selectedSale.amount) < 0.01 : false;
  const difference = selectedSale ? reconstructedTotal - selectedSale.amount : 0;

  // Stats
  const stats = {
    total: sales.length,
    missingProducts: sales.filter(s => !s.hasProducts).length,
    hasProducts: sales.filter(s => s.hasProducts).length,
    totalOutstanding: sales.reduce((sum, s) => sum + (s.balance || 0), 0)
  };

  // Show loading state
  if (loading && sales.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading sales data...</p>
          {debugInfo && <p className="text-xs text-gray-400 mt-2">{debugInfo}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-black flex items-center gap-2">
              <RotateCcw className="w-8 h-8" />
              Restore & Restock Sales
            </h1>
            <p className="text-gray-600 mt-1">Rebuild missing products and update inventory</p>
            {debugInfo && <p className="text-xs text-gray-400 mt-1">{debugInfo}</p>}
          </div>
          <button
            onClick={() => { loadSales(); loadProducts(); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-start gap-2">
            <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Error loading data:</p>
              <p>{error}</p>
              <button 
                onClick={() => { loadSales(); loadProducts(); }}
                className="mt-2 text-sm bg-red-200 px-3 py-1 rounded hover:bg-red-300"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {sales.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-sm text-gray-600">Total Sales</div>
              <div className="text-2xl font-bold text-gray-800">{formatNumber(stats.total)}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-red-500">
              <div className="text-sm text-gray-600">Missing Products</div>
              <div className="text-2xl font-bold text-red-600">{formatNumber(stats.missingProducts)}</div>
              <div className="text-xs text-gray-500">Need restoration</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
              <div className="text-sm text-gray-600">Has Products</div>
              <div className="text-2xl font-bold text-green-600">{formatNumber(stats.hasProducts)}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-purple-500">
              <div className="text-sm text-gray-600">Total Outstanding</div>
              <div className="text-xl font-bold text-purple-600">Ksh {formatCurrency(stats.totalOutstanding)}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-gray-700 font-medium mb-3"
          >
            <Filter size={18} />
            Filters
            {showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Customer name, phone, or sale ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="PAID">Paid</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="UNPAID">Unpaid</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Products</label>
                <select
                  value={productsFilter}
                  onChange={(e) => setProductsFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">All Sales</option>
                  <option value="missing">Missing Products</option>
                  <option value="has">Has Products</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Results count */}
        {sales.length > 0 && (
          <div className="mb-4 text-sm text-gray-600">
            Showing {filteredSales.length} of {sales.length} sales
          </div>
        )}

        {/* Sales List */}
        <div className="grid gap-4">
          {filteredSales.length > 0 ? (
            filteredSales.map((sale) => (
              <div key={sale.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition p-5">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-black">Sale #{sale.id}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        sale.status === "PAID" ? "bg-green-100 text-green-800" :
                        sale.status === "PARTIAL" ? "bg-orange-100 text-orange-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {sale.status}
                      </span>
                      {!sale.hasProducts && (
                        <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                          Missing Products
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Customer</p>
                        <p className="font-medium text-gray-800">{sale.customer?.name || "Unknown"}</p>
                        {sale.customer?.phone && (
                          <p className="text-sm text-gray-500">{sale.customer.phone}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Date</p>
                        <p className="text-gray-800">{formatDate(sale.date)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Financials</p>
                        <p className="text-gray-800">
                          Total: <span className="font-bold text-emerald-600">Ksh {formatCurrency(sale.amount)}</span>
                        </p>
                        <p className="text-sm text-gray-500">
                          Paid: Ksh {formatCurrency(sale.amountPaid || 0)} | Balance: Ksh {formatCurrency(sale.balance || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => openRestoreModal(sale)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition ml-4"
                  >
                    <RotateCcw size={16} />
                    Restore & Restock
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {loading ? "Loading sales..." : "No sales found"}
              </p>
              {!loading && sales.length === 0 && (
                <button
                  onClick={() => loadSales()}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg"
                >
                  Retry Loading
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Restore Modal - Keep existing modal code */}
      {showRestoreModal && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 z-10">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-black">
                  Restore & Restock - Sale #{selectedSale.id}
                </h2>
                <button
                  onClick={() => setShowRestoreModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Sale Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-800 mb-2">Sale Information (Preserved)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Customer</p>
                    <p className="font-medium">{selectedSale.customer?.name || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p>{formatDate(selectedSale.date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Original Amount</p>
                    <p className="font-bold text-emerald-600">Ksh {formatCurrency(selectedSale.amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Balance</p>
                    <p className="font-bold text-red-600">Ksh {formatCurrency(selectedSale.balance || 0)}</p>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-green-50 rounded text-xs text-green-800">
                  <CheckCircle size={12} className="inline mr-1" />
                  Financial data (amount, paid amount, balance) will NOT be modified
                </div>
              </div>
              
              {/* Tabs */}
              <div className="flex gap-2 mb-6 border-b">
                <button
                  onClick={() => setActiveTab("restore")}
                  className={`px-4 py-2 font-medium transition-colors ${
                    activeTab === "restore"
                      ? "text-purple-600 border-b-2 border-purple-600"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <Package size={16} className="inline mr-2" />
                  Restore Products ({restoredItems.length})
                </button>
                <button
                  onClick={() => setActiveTab("restock")}
                  className={`px-4 py-2 font-medium transition-colors ${
                    activeTab === "restock"
                      ? "text-purple-600 border-b-2 border-purple-600"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <Warehouse size={16} className="inline mr-2" />
                  Restock Inventory ({restockItems.length})
                </button>
              </div>
              
              {/* Restore Products Tab */}
              {activeTab === "restore" && (
                <>
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold text-gray-800 mb-3">Add Products to Sale</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="text"
                            placeholder="Search products..."
                            value={productSearch}
                            onChange={(e) => {
                              setProductSearch(e.target.value);
                              setShowProductDropdown(true);
                            }}
                            onFocus={() => setShowProductDropdown(true)}
                            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        {showProductDropdown && filteredProducts.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {filteredProducts.map(product => (
                              <div
                                key={product.id}
                                onClick={() => {
                                  setSelectedProductId(product.id);
                                  setPrice(product.price);
                                  setProductSearch(product.name);
                                  setShowProductDropdown(false);
                                }}
                                className="p-3 hover:bg-blue-50 cursor-pointer border-b"
                              >
                                <div className="font-medium">{product.name}</div>
                                <div className="text-sm text-gray-500">
                                  Price: Ksh {formatCurrency(product.price)} | Stock: {product.stockQuantity || 0}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price (Ksh)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={price}
                          onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={addRestoreItem}
                          disabled={!selectedProductId || quantity <= 0 || price <= 0}
                          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <Plus size={18} />
                          Add to Sale
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {restoredItems.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-3">Products to Restore ({restoredItems.length})</h3>
                      <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Product</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Quantity</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Price</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Subtotal</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {restoredItems.map((item, index) => (
                              <tr key={index}>
                                <td className="px-4 py-3 text-sm">{item.productName}</td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => updateRestoreQuantity(index, parseInt(e.target.value) || 1)}
                                    className="w-20 px-2 py-1 border rounded text-sm"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.price}
                                    onChange={(e) => updateRestorePrice(index, parseFloat(e.target.value) || 0)}
                                    className="w-28 px-2 py-1 border rounded text-sm"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-emerald-600">
                                  Ksh {formatCurrency(item.quantity * item.price)}
                                </td>
                                <td className="px-4 py-3">
                                  <button onClick={() => removeRestoreItem(index)} className="text-red-600 hover:text-red-800">
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50">
                            <tr>
                              <td colSpan={3} className="px-4 py-3 text-right font-semibold">Reconstructed Total:</td>
                              <td className="px-4 py-3 font-bold text-emerald-600">Ksh {formatCurrency(reconstructedTotal)}</td>
                              <td></td>
                            </tr>
                            <tr>
                              <td colSpan={3} className="px-4 py-3 text-right text-sm text-gray-600">Original Sale Amount:</td>
                              <td className="px-4 py-3 font-bold text-blue-600">Ksh {formatCurrency(selectedSale.amount)}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      
                      {!matchesOriginal && (
                        <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                          <div className="flex items-start gap-2">
                            <AlertTriangle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-yellow-800">
                              <span className="font-semibold">Warning:</span> Reconstructed total does not match original sale amount.
                              Difference: Ksh {formatCurrency(Math.abs(difference))} ({difference > 0 ? 'over' : 'under'})
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              
              {/* Restock Tab - Simplified */}
              {activeTab === "restock" && (
                <div>
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setStockOperation({...stockOperation, mode: 'add'})}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                        stockOperation.mode === 'add' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      <Plus className="w-4 h-4 inline mr-2" />
                      Add Stock
                    </button>
                    <button
                      onClick={() => setStockOperation({...stockOperation, mode: 'remove'})}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                        stockOperation.mode === 'remove' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      <Minus className="w-4 h-4 inline mr-2" />
                      Remove Stock
                    </button>
                  </div>

                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="text"
                            placeholder="Search products..."
                            value={restockProductSearch}
                            onChange={(e) => {
                              setRestockProductSearch(e.target.value);
                              setShowRestockProductDropdown(true);
                            }}
                            onFocus={() => setShowRestockProductDropdown(true)}
                            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        {showRestockProductDropdown && filteredRestockProducts.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {filteredRestockProducts.map(product => (
                              <div
                                key={product.id}
                                onClick={() => {
                                  setRestockProductSearch(product.name);
                                  setShowRestockProductDropdown(false);
                                }}
                                className="p-3 hover:bg-blue-50 cursor-pointer border-b"
                              >
                                <div className="font-medium">{product.name}</div>
                                <div className="text-sm text-gray-500">
                                  Stock: {product.stockQuantity || 0} units
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={stockOperation.quantity}
                          onChange={(e) => setStockOperation({ ...stockOperation, quantity: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      
                      <div className="flex items-end">
                        <button
                          onClick={addRestockItem}
                          disabled={!restockProductSearch || !stockOperation.quantity}
                          className={`w-full px-4 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                            stockOperation.mode === 'add' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
                          } disabled:opacity-50`}
                        >
                          <Plus size={18} />
                          Add to List
                        </button>
                      </div>
                    </div>
                  </div>

                  {restockItems.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-3">Items to Process ({restockItems.length})</h3>
                      <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Product</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Quantity</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {restockItems.map((item, index) => (
                              <tr key={index}>
                                <td className="px-4 py-3 text-sm">{item.productName}</td>
                                <td className="px-4 py-3 text-sm">{item.quantity}</td>
                                <td className="px-4 py-3">
                                  <button onClick={() => removeRestockItem(index)} className="text-red-600 hover:text-red-800">
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Save Button */}
              <div className="sticky bottom-0 bg-white border-t pt-4 mt-6">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowRestoreModal(false)}
                    className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveAllChanges}
                    disabled={(restoredItems.length === 0 && restockItems.length === 0) || saving}
                    className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader className="animate-spin" size={18} />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        Save All Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {error && (
                <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                  {error}
                </div>
              )}
              {success && (
                <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                  {success}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}