"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Download, MessageSquare, Send, Clock, CreditCard, AlertTriangle, CheckCircle, Plus, X, Edit, Trash2, Calculator, Save, Menu, ChevronDown, ChevronUp, Filter, Calendar, Search, XCircle, User } from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

interface Customer {
  id: number;
  name: string;
  phone?: string;
}

interface Product {
  id: number;
  name: string;
  price?: number;
  stock?: number;
}

interface SaleItem {
  id: number;
  product: Product;
  quantity: number;
  price: number;
}

interface Payment {
  id?: number;
  amount: number;
  method: "CASH" | "MPESA" | "BANK" | "CHECK" | "CARD" | "CREDIT";
  date: string;
  referenceId?: string | null;
  checkDepositDate?: string | null;
  dueDate?: string | null;
  status?: "PENDING" | "COMPLETED" | "BOUNCED" | "CLEARED";
}

interface NewPayment {
  id?: number;
  amount: string;
  method: "CASH" | "MPESA" | "BANK" | "CHECK" | "CARD" | "CREDIT";
  referenceId?: string;
  checkDepositDate?: string;
  checkNumber?: string;
  dueDate?: string;
  bankName?: string;
  checkDate?: string;
  isVerified?: boolean;
  status?: "PENDING" | "CLEARED" | "BOUNCED";
}

interface Sale {
  id: number;
  saleitems: SaleItem[];
  amount: number;
  date: string;
  status: "PAID" | "PARTIAL" | "UNPAID";
  dueDate?: string | null;
  customer: Customer;
  payments: Payment[];
  remainingAmount: number;
  paymentMethod?: "CASH" | "MPESA" | "BANK" | "CHECK" | "CARD" | "CREDIT" | "MULTIPLE";
  checkDepositDate?: string | null;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface NewSaleItem {
  productId: number;
  quantity: number;
  price: number;
  productName: string;
  originalPrice?: number;
}

interface UserDetail {
  email: string;
  name: string;
  displayName?: string;
  photoURL?: string;
}

const EnhancedSalesPage = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockError, setStockError] = useState<string | null>(null);
  const [stockValidationTimeout, setStockValidationTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const [editSaleItems, setEditSaleItems] = useState<NewSaleItem[]>([]);
  const [currentEditItem, setCurrentEditItem] = useState<NewSaleItem>({
    productId: 0,
    quantity: 0,
    price: 0,
    productName: ""
  });
  
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const [editPayments, setEditPayments] = useState<NewPayment[]>([]);
  const [currentPayment, setCurrentPayment] = useState<NewPayment>({
    amount: "",
    method: "CASH",
    referenceId: "",
    checkDepositDate: "",
    dueDate: ""
  });
  
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"messaging" | "overview" | "paid" | "partial" | "unpaid">("overview");
  const [selectedSales, setSelectedSales] = useState<number[]>([]);
  const [selectedMessageType, setSelectedMessageType] = useState("delivery");

  // Filter state variables
  const [customerFilter, setCustomerFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  
  // Restock confirmation state
  const [showRestockConfirm, setShowRestockConfirm] = useState<number | null>(null);
  
  // User details state
  const [userDetails, setUserDetails] = useState<Map<string, UserDetail>>(new Map());
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Mobile states
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return phone;
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("07")) return "254" + cleanPhone.substring(1);
    if (cleanPhone.startsWith("7") && cleanPhone.length === 9) return "254" + cleanPhone;
    return cleanPhone;
  };

  // Format date helper
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return "";
    }
  };

  // Format time helper
  const formatTime = (dateString: string | null | undefined): string => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return "";
    }
  };

  // Format currency helper
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Corrected message templates
  const messageTypes = [
    { 
      value: "delivery", 
      label: "Delivery",
      getTemplate: (sale: Sale) => 
        `Hello ${sale.customer.name}, your order has been confirmed for delivery. Thank you for choosing Swift Metals.`
    },
    { 
      value: "payment", 
      label: "Payment Reminder",
      getTemplate: (sale: Sale) => {
        // Get items list
        const itemsList = sale.saleitems?.map(item => 
          `${item.product.name} (${item.quantity} units)`
        ).join(', ') || 'Various items';
        
        // Calculate outstanding balance
        const outstandingBalance = sale.remainingAmount > 0.01 ? sale.remainingAmount : sale.amount;
        
        // Construct the receipt URL
        const receiptLink = typeof window !== 'undefined' ? 
          `${window.location.origin}/api/receipt/${sale.id}` : 
          `/api/receipt/${sale.id}`;
        
        return `Hello ${sale.customer.name},

This is a friendly reminder regarding your pending payment for sale #${sale.id} dated ${formatDate(sale.date)}.

Sale Details:
- Invoice #: ${sale.id}
- Date: ${formatDate(sale.date)}
- Amount Due: KES ${formatCurrency(sale.amount)}
- Items: ${itemsList}

Outstanding Balance: KES ${formatCurrency(outstandingBalance)}

We kindly request that you settle this outstanding balance at your earliest convenience.

Attached is the receipt: ${receiptLink}

Best regards,
Swiftmetals`;
      }
    },
    { 
      value: "check", 
      label: "Check Reminder",
      getTemplate: (sale: Sale) => {
        // Find check payment if any
        const checkPayment = sale.payments?.find(p => p.method === "CHECK");
        
        if (checkPayment?.checkDepositDate) {
          const depositDate = new Date(checkPayment.checkDepositDate);
          const formattedDate = depositDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
          
          return `Hello ${sale.customer.name}, this is a reminder that your check payment (KES ${formatCurrency(checkPayment.amount)}) is scheduled for deposit on ${formattedDate}. Please ensure sufficient funds are available in your account. Best regards, Swift Metals.`;
        }
        
        return `Hello ${sale.customer.name}, this is a reminder that your check payment is scheduled for deposit soon. Please ensure sufficient funds are available. Best regards, Swift Metals.`;
      }
    }
  ];

  const calculateSaleStatus = useCallback((sale: any): Sale => {
    const totalPayments = sale.payments?.reduce((sum: number, p: Payment) => 
      sum + Number(p.amount || 0), 0) || 0;
    
    const remainingAmount = Math.max(0, Number(sale.amount) - totalPayments);
    
    const hasPendingChecks = sale.payments?.some((p: Payment) => {
      if (p.method !== "CHECK") return false;
      const today = new Date().toISOString().split('T')[0];
      return !p.checkDepositDate || p.checkDepositDate > today || p.status === "PENDING";
    }) || false;

    let status: "PAID" | "PARTIAL" | "UNPAID";
    if (hasPendingChecks && remainingAmount <= 0.01) {
      status = "PARTIAL";
    } else if (remainingAmount <= 0.01) {
      status = "PAID";
    } else if (totalPayments > 0) {
      status = "PARTIAL";
    } else {
      status = "UNPAID";
    }

    return { ...sale, remainingAmount, status, payments: sale.payments || [] };
  }, []);

  // Helper function to get user display name
  const getUserDisplayName = (email: string | null | undefined): { name: string, email: string } => {
    if (!email) return { name: "Unknown", email: "Unknown" };
    
    const user = userDetails.get(email);
    if (user) {
      return {
        name: user.displayName || user.name || email.split('@')[0],
        email: user.email
      };
    }
    
    const nameFromEmail = email.split('@')[0]
      .split(/[._-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    
    return {
      name: nameFromEmail,
      email: email
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const user = auth.currentUser;
        let idToken = "";
        
        if (user) {
          idToken = await user.getIdToken();
          
          const sessionRes = await fetch("/api/auth/session", {
            headers: {
              "Authorization": `Bearer ${idToken}`
            }
          });

          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            setCurrentUser(sessionData?.user?.email || sessionData?.email || "");
          }
        }

        const endpoints = [
          { url: "/api/sales", name: "Sales" },
          { url: "/api/customers", name: "Customers", fallback: "/api/customer" },
          { url: "/api/products", name: "Products" }
        ];

        const [salesRes, customersRes, productsRes] = await Promise.all([
          fetch(endpoints[0].url).catch(err => {
            console.error(`❌ ${endpoints[0].name} fetch failed:`, err);
            return null;
          }),
          fetch(endpoints[1].url).catch(err => {
            console.error(`❌ ${endpoints[1].name} fetch failed:`, err);
            return null;
          }),
          fetch(endpoints[2].url).catch(err => {
            console.error(`❌ ${endpoints[2].name} fetch failed:`, err);
            return null;
          })
        ]);

        let customersData = [];
        if (!customersRes || !customersRes.ok) {
          try {
            const altRes = await fetch("/api/customer");
            if (altRes.ok) customersData = await altRes.json();
          } catch (err) {
            console.error("❌ Fallback also failed:", err);
          }
        } else {
          customersData = await customersRes.json();
        }

        if (!salesRes || !salesRes.ok) {
          throw new Error("Failed to fetch sales data");
        }
        if (!productsRes || !productsRes.ok) {
          throw new Error("Failed to fetch products data");
        }

        const [salesData, productsData] = await Promise.all([
          salesRes.json(),
          productsRes.json()
        ]);

        const validCustomers = Array.isArray(customersData) 
          ? customersData 
          : (customersData?.customers || customersData?.data || []);
        
        const processedSales = Array.isArray(salesData) 
          ? salesData.map(calculateSaleStatus) 
          : [];
        
        const validProducts = Array.isArray(productsData) ? productsData : [];
        
        setSales(processedSales);
        setCustomers(validCustomers);
        setProducts(validProducts);

        if (validCustomers.length === 0) {
          console.warn("⚠️ No customers found");
          setError("No customers found. Please add customers first.");
        }
      } catch (err: any) {
        const errorMsg = err.message || "Failed to load data";
        setError(errorMsg);
        console.error("❌ Error fetching data:", err);
        setSales([]);
        setCustomers([]);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchData();
      } else {
        setCurrentUser("");
        setError("Please log in to access sales data");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [calculateSaleStatus]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.customer-dropdown-container')) {
        setShowCustomerDropdown(false);
      }
      if (!target.closest('.product-dropdown-container')) {
        setShowProductDropdown(false);
      }
      if (!target.closest('.date-filter-container')) {
        setShowDateFilter(false);
      }
      if (!target.closest('.mobile-filter-container')) {
        setShowMobileFilters(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const paymentMethods = [
    { value: "CASH", label: "Cash", color: "bg-green-100 text-green-800" },
    { value: "MPESA", label: "M-Pesa", color: "bg-blue-100 text-blue-800" },
    { value: "BANK", label: "Bank", color: "bg-purple-100 text-purple-800" },
    { value: "CHECK", label: "Check", color: "bg-orange-100 text-orange-800" },
    { value: "CARD", label: "Card", color: "bg-pink-100 text-pink-800" },
    { value: "CREDIT", label: "Credit", color: "bg-yellow-100 text-yellow-800" }
  ];

  const handleAddItemToEditSale = () => {
    if (stockValidationTimeout) clearTimeout(stockValidationTimeout);
    
    if (!currentEditItem.productId || currentEditItem.quantity <= 0 || currentEditItem.price <= 0) {
      setError("Please fill in all item details");
      return;
    }
    
    const product = products.find(p => p.id === currentEditItem.productId);
    if (!product) {
      setError("Product not found");
      return;
    }
    
    let productStock = 0;
    if (Array.isArray(product.stock)) {
      productStock = product.stock.reduce((total: number, s: any) => total + (s.quantity || 0), 0);
    } else if (typeof product.stock === 'object' && product.stock !== null) {
      productStock = (product.stock as any).quantity || 0;
    } else {
      productStock = Number(product.stock) || 0;
    }
    
    const existingItem = editSaleItems.find(item => item.productId === currentEditItem.productId);
    const existingQuantity = existingItem ? existingItem.quantity : 0;
    const totalQuantity = existingQuantity + currentEditItem.quantity;
    
    if (totalQuantity > productStock) {
      const errorMsg = `Insufficient stock for ${product.name}. Available: ${productStock}, Requested: ${totalQuantity}`;
      setStockError(errorMsg);
      setError(errorMsg);
      
      const timeout = setTimeout(() => {
        setStockError(null);
        setError(null);
      }, 5000);
      setStockValidationTimeout(timeout);
      return;
    }
    
    const existingItemIndex = editSaleItems.findIndex(item => item.productId === currentEditItem.productId);

    if (existingItemIndex >= 0) {
      const updatedItems = [...editSaleItems];
      updatedItems[existingItemIndex].quantity += currentEditItem.quantity;
      updatedItems[existingItemIndex].price = currentEditItem.price;
      setEditSaleItems(updatedItems);
    } else {
      setEditSaleItems([...editSaleItems, { 
        ...currentEditItem, 
        productName: product.name,
        originalPrice: product.price
      }]);
    }
    
    setCurrentEditItem({
      productId: 0,
      quantity: 0,
      price: 0,
      productName: ""
    });
    setProductSearch("");
    setError(null);
    setStockError(null);
  };

  const handleEditSale = (sale: Sale) => {
    setEditingSale(sale);
    setEditPayments(sale.payments.map(p => ({
      id: p.id,
      amount: p.amount.toString(),
      method: p.method,
      referenceId: p.referenceId || "",
      checkDepositDate: p.checkDepositDate || ""
    })));
    setEditSaleItems(sale.saleitems.map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
      price: item.price,
      productName: item.product.name,
      originalPrice: item.product.price
    })));
  };

  const handleUpdateSale = async () => {
    if (!editingSale) return;

    if (!currentUser) {
      setError("Please log in to update a sale");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess("Updating sale, please wait...");
    
    try {
      const newTotalAmount = editSaleItems.reduce((total, item) => 
        total + (item.quantity * item.price), 0);

      const updateData = {
        saleItems: editSaleItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
        payments: editPayments.filter(p => p.id).map(p => ({
          id: p.id,
          amount: Number(p.amount),
          method: p.method,
          referenceId: p.referenceId?.trim() || null,
          checkDepositDate: p.checkDepositDate || null,
        })),
        newPayments: editPayments.filter(p => !p.id).map(p => ({
          amount: Number(p.amount),
          method: p.method,
          referenceId: p.referenceId?.trim() || null,
          checkDepositDate: p.checkDepositDate || null,
          dueDate: p.dueDate || null,
          date: new Date().toISOString(),
          status: p.method === "CHECK" ? "PENDING" : "COMPLETED",
        })),
        amount: newTotalAmount,
        dueDate: editingSale.dueDate || null,
        updatedBy: currentUser,
      };

      const response = await fetch(`/api/sales/${editingSale.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update sale");
      }

      const updatedSale = await response.json();
      const processedSale = calculateSaleStatus(updatedSale);

      setSales(prevSales => 
        prevSales.map(s => s.id === processedSale.id ? processedSale : s)
      );

      setEditingSale(null);
      setEditSaleItems([]);
      setEditPayments([]);
      setCurrentPayment({
        amount: "",
        method: "CASH",
        referenceId: "",
        checkDepositDate: "",
        dueDate: ""
      });
      
      setSuccess("Sale updated successfully!");
      setTimeout(() => setSuccess(null), 3000);

      const salesRes = await fetch("/api/sales");
      if (salesRes.ok) {
        const refreshedSales = await salesRes.json();
        const processedSales = refreshedSales.map(calculateSaleStatus);
        setSales(processedSales);
      }
    } catch (err: any) {
      setError(err.message || "Failed to update sale");
      console.error("Error updating sale:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayment = async (paymentId: number, saleId: number) => {
    try {
      const currentEditingSale = editingSale;
      const currentSales = sales;
      
      setDeletingPaymentId(paymentId);

      const response = await fetch(`/api/payment/${paymentId}?saleId=${saleId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to delete payment");
      }

      const updatedSale = await response.json();
      const processedSale = calculateSaleStatus(updatedSale);

      setSales(currentSales.map(s => s.id === processedSale.id ? processedSale : s));
      
      if (currentEditingSale?.id === saleId) {
        setEditingSale(processedSale);
        setEditPayments(
          processedSale.payments.map((p: Payment) => ({
            id: p.id,
            amount: p.amount.toString(),
            method: p.method,
            referenceId: p.referenceId || "",
            checkDepositDate: p.checkDepositDate || ""
          }))
        );
      }

      setSuccess("Payment deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);

    } catch (error: any) {
      console.error("Error deleting payment:", error);
      setError(error.message || "Failed to delete payment");
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const handleDeleteSale = async (saleId: number, restockItems: boolean = false) => {
    setLoading(true);
    setError(null);
    setSuccess("Deleting sale, please wait...");
    
    try {
      const response = await fetch(`/api/sales/${saleId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restockItems })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete sale");
      }

      setSales(prevSales => prevSales.filter(s => s.id !== saleId));
      setShowRestockConfirm(null);
      
      setSuccess(`Sale deleted successfully${restockItems ? ' with items restocked' : ''}!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error("Error deleting sale:", error);
      setError(error.message || "Failed to delete sale");
    } finally {
      setLoading(false);
    }
  };

  const showDeleteConfirmation = (saleId: number) => {
    setShowRestockConfirm(saleId);
  };

  const addEditPayment = () => {
    if (currentPayment.method === "CREDIT") {
      if (!currentPayment.dueDate) {
        setError("Due date is required for credit/pay later");
        return;
      }
      
      setEditPayments([...editPayments, {
        amount: "0",
        method: currentPayment.method,
        referenceId: "",
        checkDepositDate: "",
        dueDate: currentPayment.dueDate
      }]);
    } else {
      const amount = parseFloat(currentPayment.amount);
      if (!amount || amount <= 0) {
        setError("Please enter a valid payment amount");
        return;
      }

      const currentTotal = editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      const currentPayments = editPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const remainingAmount = currentTotal - currentPayments;

      if (amount > remainingAmount) {
        setError(`Payment amount cannot exceed remaining balance of Ksh ${remainingAmount.toFixed(2)}`);
        return;
      }
      
      if (currentPayment.method === "CHECK" && !currentPayment.checkDepositDate) {
        setError("Please specify check deposit date");
        return;
      }

      if (["MPESA", "BANK", "CARD"].includes(currentPayment.method) && !currentPayment.referenceId?.trim()) {
        setError("Please enter transaction reference");
        return;
      }
      
      setEditPayments([...editPayments, {
        amount: currentPayment.amount,
        method: currentPayment.method,
        referenceId: currentPayment.referenceId || "",
        checkDepositDate: currentPayment.checkDepositDate || "",
        dueDate: ""
      }]);
    }

    setCurrentPayment({
      amount: "",
      method: "CASH",
      referenceId: "",
      checkDepositDate: "",
      dueDate: ""
    });
    setError(null);
  };
    
  const clearMessages = () => {
    setError(null);
    setSuccess(null);
    setStockError(null);
  };

  const clearFilters = () => {
    setCustomerFilter("");
    setDateFilter("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setExpandedSaleId(null);
  };

  const isFilterActive = useMemo(() => {
    return customerFilter.trim() !== "" || dateFilter !== "all";
  }, [customerFilter, dateFilter]);

  const stats = useMemo(() => ({
    totalSales: sales.reduce((acc, s) => acc + Number(s.amount), 0),
    paidSales: sales.filter(s => s.status === "PAID").reduce((acc, s) => acc + Number(s.amount), 0),
    partialSales: sales.filter(s => s.status === "PARTIAL").reduce((acc, s) => acc + Number(s.amount), 0),
    unpaidSales: sales.filter(s => s.status === "UNPAID").reduce((acc, s) => acc + Number(s.amount), 0),
    totalOutstanding: sales.reduce((acc, s) => acc + Number(s.remainingAmount), 0),
    paidCount: sales.filter(s => s.status === "PAID").length,
    partialCount: sales.filter(s => s.status === "PARTIAL").length,
    unpaidCount: sales.filter(s => s.status === "UNPAID").length
  }), [sales]);

  const filteredSales = useMemo(() => {
    switch (activeTab) {
      case "paid":
        return sales.filter(s => s.status === "PAID");
      case "partial":
        return sales.filter(s => s.status === "PARTIAL");
      case "unpaid":
        return sales.filter(s => s.status === "UNPAID");
      case "overview":
      default:
        return sales;
    }
  }, [sales, activeTab]);

  const fullyFilteredSales = useMemo(() => {
    let filtered = filteredSales;

    if (customerFilter.trim()) {
      const searchTerm = customerFilter.toLowerCase().trim();
      filtered = filtered.filter(sale => {
        const customerName = sale.customer?.name?.toLowerCase() || "";
        const customerPhone = sale.customer?.phone?.toLowerCase() || "";
        return customerName.includes(searchTerm) || customerPhone.includes(searchTerm);
      });
    }

    if (dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.date);
        
        switch (dateFilter) {
          case "today":
            return saleDate.toDateString() === today.toDateString();
          
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
          
          case "custom":
            if (customStartDate && customEndDate) {
              const start = new Date(customStartDate);
              const end = new Date(customEndDate);
              end.setHours(23, 59, 59, 999);
              return saleDate >= start && saleDate <= end;
            }
            return true;
          
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [filteredSales, customerFilter, dateFilter, customStartDate, customEndDate]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const searchLower = customerSearch.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchLower) ||
      (c.phone && c.phone.includes(searchLower))
    );
  }, [customers, customerSearch]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const searchLower = productSearch.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(searchLower)
    );
  }, [products, productSearch]);

  // Handle sending messages via WhatsApp/SMS (directly opens messaging app)
  const handleSendMessage = (sale: Sale) => {
    if (!sale.customer?.phone) {
      setError("Customer phone number is required");
      setTimeout(() => setError(null), 3000);
      return;
    }

    const phone = formatPhoneNumber(sale.customer.phone);
    const selectedTemplate = messageTypes.find(t => t.value === selectedMessageType);
    const message = encodeURIComponent(selectedTemplate?.getTemplate(sale) || "Thank you for your business!");

    const useWhatsApp = confirm("Send via WhatsApp? (Cancel for SMS)");

    if (useWhatsApp) {
      window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
    } else {
      window.open(`sms:${phone}?body=${message}`, "_blank");
    }
  };

  if (loading && sales.length === 0) {
    return (
      <div className="p-3 bg-gray-50 min-h-screen">
        <div className="text-center text-black">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 bg-gray-50 min-h-screen">
      {/* Restock Confirmation Modal - Mobile Optimized */}
      {showRestockConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-[60]">
          <div className="bg-white rounded-lg max-w-sm w-full p-4 mx-2">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="text-yellow-500" size={20} />
              <h3 className="text-lg font-bold text-black">Confirm Sale Deletion</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Would you like to restock the items from this sale back to inventory?
            </p>
            
            <div className="space-y-2">
              <button
                onClick={() => handleDeleteSale(showRestockConfirm, true)}
                disabled={loading}
                className="w-full bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                <CheckCircle size={16} />
                Yes, delete and restock
              </button>
              
              <button
                onClick={() => handleDeleteSale(showRestockConfirm, false)}
                disabled={loading}
                className="w-full bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                <Trash2 size={16} />
                No, just delete
              </button>
              
              <button
                onClick={() => setShowRestockConfirm(null)}
                disabled={loading}
                className="w-full bg-gray-500 text-white px-3 py-2 rounded-lg hover:bg-gray-600 disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header - Mobile Optimized */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-black">Sales Management</h1>
            <p className="text-xs text-gray-600">Dashboard</p>
          </div>
          <button
            onClick={() => {
              const csvData = sales.map(sale => ({
                'Sale ID': sale.id,
                'Date': new Date(sale.date).toLocaleDateString(),
                'Customer': sale.customer?.name || '-',
                'Customer Phone': sale.customer?.phone || '-',
                'Products': sale.saleitems?.map(item => `${item.product.name} (x${item.quantity})`).join('; ') || '-',
                'Total Amount': sale.amount.toFixed(2),
                'Status': sale.status,
                'Amount Paid': (sale.amount - sale.remainingAmount).toFixed(2),
                'Remaining Amount': sale.remainingAmount.toFixed(2),
                'Due Date': sale.dueDate ? new Date(sale.dueDate).toLocaleDateString() : '-',
                'Payment Methods': sale.payments?.map(p => p.method).join('; ') || '-',
                'Created By': sale.createdBy || '-',
                'Updated By': sale.updatedBy || '-'
              }));

              const headers = Object.keys(csvData[0] || {});
              const csvContent = [
                headers.join(','),
                ...csvData.map(row => 
                  headers.map(header => {
                    const value = row[header as keyof typeof row];
                    return `"${String(value).replace(/"/g, '""')}"`;
                  }).join(',')
                )
              ].join('\n');

              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              const url = URL.createObjectURL(blob);
              link.setAttribute('href', url);
              link.setAttribute('download', `sales_report_${new Date().toISOString().split('T')[0]}.csv`);
              link.style.visibility = 'hidden';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 flex items-center gap-1.5 text-sm shadow"
          >
            <Download size={16} />
            <span className="hidden xs:inline">Export</span>
          </button>
        </div>

        {/* Mobile Filter Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="flex items-center gap-1.5 bg-white border border-gray-300 px-3 py-1.5 rounded-lg text-sm text-black hover:bg-gray-50"
          >
            <Filter size={16} />
            Filters
            {isFilterActive && <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full text-xs">•</span>}
          </button>
          
          {isFilterActive && (
            <button
              onClick={clearFilters}
              className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1"
            >
              <XCircle size={16} />
              Clear
            </button>
          )}
        </div>

        {/* Mobile Filters Panel */}
        {showMobileFilters && (
          <div className="mobile-filter-container bg-white p-3 rounded-lg border shadow-sm space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Search Customer</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Customer name or phone..."
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="w-full pl-7 pr-7 py-1.5 text-sm border border-gray-300 rounded-lg text-black"
                />
                {customerFilter && (
                  <button
                    onClick={() => setCustomerFilter("")}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XCircle size={14} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date Range</label>
              <div className="space-y-2">
                <div className="flex gap-1 flex-wrap">
                  {["all", "today", "week", "month"].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setDateFilter(filter as any)}
                      className={`px-2 py-1 text-xs rounded ${
                        dateFilter === filter 
                          ? "bg-blue-100 text-blue-700 border border-blue-300" 
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {filter === "all" ? "All" : 
                       filter === "today" ? "Today" : 
                       filter === "week" ? "Week" : "Month"}
                    </button>
                  ))}
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => {
                        setCustomStartDate(e.target.value);
                        setDateFilter("custom");
                      }}
                      className="w-full p-1.5 text-xs border rounded text-black"
                      max={customEndDate || new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => {
                        setCustomEndDate(e.target.value);
                        setDateFilter("custom");
                      }}
                      className="w-full p-1.5 text-xs border rounded text-black"
                      min={customStartDate}
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Filters Display - Mobile */}
        {isFilterActive && (
          <div className="flex flex-wrap gap-1.5">
            {customerFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                {customerFilter.length > 12 ? customerFilter.substring(0, 12) + '...' : customerFilter}
                <button onClick={() => setCustomerFilter("")} className="text-blue-600 hover:text-blue-800">
                  <X size={10} />
                </button>
              </span>
            )}
            {dateFilter !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                {dateFilter === "today" ? "Today" :
                 dateFilter === "week" ? "Week" :
                 dateFilter === "month" ? "Month" : "Custom"}
                <button onClick={() => setDateFilter("all")} className="text-green-600 hover:text-green-800">
                  <X size={10} />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-3 flex justify-between items-start text-sm">
          <div className="flex items-start gap-1.5">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button onClick={clearMessages} className="font-bold text-red-700 text-lg leading-none hover:text-red-900">×</button>
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded mb-3 flex justify-between items-start text-sm">
          <div className="flex items-start gap-1.5">
            <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
          <button onClick={clearMessages} className="font-bold text-green-700 text-lg leading-none hover:text-green-900">×</button>
        </div>
      )}

      {/* Stats Cards - Mobile Optimized */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-white p-3 rounded-lg shadow border-l-2 border-emerald-500">
          <div className="text-xs text-gray-600">Total Sales</div>
          <div className="text-base font-bold text-emerald-600">Ksh {formatCurrency(stats.totalSales)}</div>
          <div className="text-xs text-black">{sales.length} orders</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow border-l-2 border-blue-500">
          <div className="text-xs text-gray-600">Fully Paid</div>
          <div className="text-base font-bold text-blue-600">Ksh {formatCurrency(stats.paidSales)}</div>
          <div className="text-xs text-black">{stats.paidCount} orders</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow border-l-2 border-orange-500">
          <div className="text-xs text-gray-600">Partial</div>
          <div className="text-base font-bold text-orange-600">Ksh {formatCurrency(stats.partialSales)}</div>
          <div className="text-xs text-black">{stats.partialCount} orders</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow border-l-2 border-red-500">
          <div className="text-xs text-gray-600">Unpaid</div>
          <div className="text-base font-bold text-red-600">Ksh {formatCurrency(stats.unpaidSales)}</div>
          <div className="text-xs text-black">{stats.unpaidCount} orders</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow border-l-2 border-purple-500 col-span-2">
          <div className="text-xs text-gray-600">Outstanding Amount</div>
          <div className="text-base font-bold text-purple-600">Ksh {formatCurrency(stats.totalOutstanding)}</div>
          <div className="text-xs text-black">Total remaining</div>
        </div>
      </div>

      {/* Tabs - Mobile Optimized */}
      <div className="bg-white rounded-lg shadow mb-3">
        <div className="flex overflow-x-auto scrollbar-thin border-b">
          {[
            { key: "overview", label: "All", count: sales.length },
            { key: "paid", label: "Paid", count: stats.paidCount },
            { key: "partial", label: "Partial", count: stats.partialCount },
            { key: "unpaid", label: "Unpaid", count: stats.unpaidCount }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-shrink-0 px-3 py-2.5 text-center transition-colors whitespace-nowrap min-w-[70px] ${
                activeTab === tab.key
                  ? "border-b-2 border-blue-500 text-blue-600 font-semibold"
                  : "text-black hover:text-gray-800"
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="text-xs">{tab.label}</span>
                <span className="text-xs text-gray-500">({tab.count})</span>
              </div>
            </button>
          ))}
        </div>

        <div className="p-2">
          {/* Sales List - Mobile Cards */}
          <div className="space-y-2">
            {fullyFilteredSales.map((sale) => (
              <div key={sale.id} className="bg-white border rounded-lg p-3 shadow-sm">
                {/* Header */}
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-black text-sm truncate max-w-[150px]">
                      {sale.customer?.name || "-"}
                    </h3>
                    {sale.customer?.phone && (
                      <p className="text-xs text-gray-500">{sale.customer.phone}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      sale.status === "PAID" ? "bg-green-100 text-green-800" :
                      sale.status === "PARTIAL" ? "bg-orange-100 text-orange-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      {sale.status}
                    </span>
                    <button
                      onClick={() => setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      {expandedSaleId === sale.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div>
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-semibold text-emerald-600 ml-1">Ksh {formatCurrency(sale.amount)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Remaining:</span>
                    <span className="font-semibold text-red-600 ml-1">Ksh {formatCurrency(sale.remainingAmount)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Date:</span>
                    <span className="ml-1 text-black">{formatDate(sale.date)}</span>
                  </div>
                  {sale.dueDate && (
                    <div>
                      <span className="text-gray-600">Due:</span>
                      <span className="ml-1 text-black">{formatDate(sale.dueDate)}</span>
                    </div>
                  )}
                </div>

                {/* Expanded Details */}
                {expandedSaleId === sale.id && (
                  <div className="mt-2 pt-2 border-t border-gray-200 space-y-2">
                    {/* Products */}
                    {sale.saleitems && sale.saleitems.length > 0 && (
                      <div className="text-xs">
                        <div className="font-medium text-gray-700 mb-1">Products:</div>
                        <div className="space-y-1">
                          {sale.saleitems.map((item, idx) => (
                            <div key={idx} className="text-black flex justify-between">
                              <span className="truncate max-w-[120px]">{item.product.name}</span>
                              <span>×{item.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* User Accountability */}
                    {(sale.createdBy || sale.updatedBy) && (
                      <div className="text-xs text-gray-500">
                        {sale.createdBy && (
                          <div className="flex items-start gap-1 mb-1">
                            <User size={10} className="text-blue-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="font-medium">Created by: </span>
                              <span className="text-blue-600">{getUserDisplayName(sale.createdBy).name}</span>
                            </div>
                          </div>
                        )}
                        {sale.updatedBy && sale.updatedBy !== sale.createdBy && (
                          <div className="flex items-start gap-1">
                            <User size={10} className="text-green-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="font-medium">Updated by: </span>
                              <span className="text-green-600">{getUserDisplayName(sale.updatedBy).name}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Payment Methods */}
                    {sale.payments && sale.payments.length > 0 && (
                      <div className="text-xs">
                        <div className="font-medium text-gray-700 mb-1">Payments:</div>
                        <div className="flex flex-wrap gap-1">
                          {sale.payments.slice(0, 3).map((payment, idx) => (
                            <span key={idx} className={`px-1.5 py-0.5 rounded-full text-xs ${
                              paymentMethods.find(m => m.value === payment.method)?.color || "bg-gray-100 text-gray-800"
                            }`}>
                              {payment.method}
                            </span>
                          ))}
                          {sale.payments.length > 3 && (
                            <span className="text-gray-500 text-xs">+{sale.payments.length - 3} more</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-3 pt-2 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={selectedMessageType}
                      onChange={(e) => setSelectedMessageType(e.target.value)}
                      className="col-span-2 px-2 py-1 text-xs border border-gray-300 rounded text-black bg-white"
                    >
                      {messageTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    
                    <div className="col-span-2 grid grid-cols-4 gap-1">
                      <button
                        onClick={() => handleSendMessage(sale)}
                        disabled={!sale.customer?.phone}
                        className="px-1 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-0.5"
                        title="Message"
                      >
                        <MessageSquare size={12} />
                        <span className="hidden xs:inline">Msg</span>
                      </button>
                      
                      <button
                        onClick={() => window.open(`/api/receipt/${sale.id}`, "_blank")}
                        className="px-1 py-1.5 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center justify-center gap-0.5"
                        title="Receipt"
                      >
                        <Download size={12} />
                        <span className="hidden xs:inline">Rcpt</span>
                      </button>
                      
                      <button
                        onClick={() => handleEditSale(sale)}
                        className="px-1 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center gap-0.5"
                        title="Edit"
                      >
                        <Edit size={12} />
                        <span className="hidden xs:inline">Edit</span>
                      </button>
                      
                      <button
                        onClick={() => showDeleteConfirmation(sale.id)}
                        disabled={loading}
                        className="px-1 py-1.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-0.5"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                        <span className="hidden xs:inline">Del</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {fullyFilteredSales.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                {isFilterActive ? "No sales match your filters" : "No sales found"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Sale Modal - Mobile Optimized */}
      {editingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-2 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto mt-2">
            <div className="p-3 border-b sticky top-0 bg-white z-10">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-black">Edit Sale #{editingSale.id}</h2>
                <button
                  onClick={() => setEditingSale(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-3 space-y-4">
              {/* Sale Info */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <h3 className="font-semibold mb-2 text-black text-sm">Sale Information</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600">Customer:</span>
                    <div className="font-medium text-black truncate">{editingSale.customer.name}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Date:</span>
                    <div className="text-black">{formatDate(editingSale.date)}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">Status:</span>
                    <span className={`ml-2 px-2 py-1 rounded text-xs font-bold ${
                      editingSale.status === "PAID" ? "bg-green-100 text-green-800" :
                      editingSale.status === "PARTIAL" ? "bg-orange-100 text-orange-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      {editingSale.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Edit Items */}
              <div>
                <h3 className="text-sm font-semibold mb-2 text-black flex items-center gap-1">
                  <Calculator size={16} />
                  Edit Sale Items
                </h3>
                
                {/* Add New Item */}
                <div className="space-y-2 mb-3 p-2 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-black text-xs">Add New Item</h4>
                  <div className="space-y-2">
                    <div className="relative product-dropdown-container">
                      <input
                        type="text"
                        placeholder="Search product..."
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          setShowProductDropdown(true);
                        }}
                        onFocus={() => setShowProductDropdown(true)}
                        className="w-full p-1.5 border border-gray-300 rounded text-black text-sm"
                      />
                      {showProductDropdown && filteredProducts.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {filteredProducts.map(product => (
                            <div
                              key={product.id}
                              onClick={() => {
                                setCurrentEditItem({
                                  ...currentEditItem,
                                  productId: product.id,
                                  price: product.price || 0,
                                  productName: product.name
                                });
                                setProductSearch(product.name);
                                setShowProductDropdown(false);
                              }}
                              className="p-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 text-sm"
                            >
                              <div className="font-medium text-black truncate">{product.name}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <input
                          type="number"
                          min="1"
                          value={currentEditItem.quantity}
                          onChange={(e) => setCurrentEditItem({...currentEditItem, quantity: parseInt(e.target.value) || 1})}
                          placeholder="Qty"
                          className="w-full p-1.5 border rounded text-black text-sm"
                        />
                      </div>
                      
                      <div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={currentEditItem.price}
                          onChange={(e) => setCurrentEditItem({...currentEditItem, price: parseFloat(e.target.value) || 0})}
                          placeholder="Price"
                          className="w-full p-1.5 border rounded text-black text-sm"
                        />
                      </div>
                    </div>
                    
                    <button
                      onClick={handleAddItemToEditSale}
                      disabled={!currentEditItem.productId || currentEditItem.quantity <= 0 || currentEditItem.price <= 0}
                      className="w-full bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600 disabled:opacity-50 text-sm flex items-center justify-center gap-1"
                    >
                      <Plus size={14} />
                      Add Item
                    </button>
                  </div>
                </div>

                {/* Existing Items */}
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {editSaleItems.map((item, index) => (
                    <div key={index} className="bg-gray-50 p-2 rounded border text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <div className="font-medium text-black truncate">{item.productName}</div>
                        <button
                          onClick={() => {
                            if (editSaleItems.length === 1) {
                              setError("Cannot delete the only item");
                              return;
                            }
                            setEditSaleItems(editSaleItems.filter((_, i) => i !== index));
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...editSaleItems];
                            newItems[index].quantity = parseInt(e.target.value) || 1;
                            setEditSaleItems(newItems);
                          }}
                          className="w-full p-1 border rounded text-black text-xs"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => {
                            const newItems = [...editSaleItems];
                            newItems[index].price = parseFloat(e.target.value) || 0;
                            setEditSaleItems(newItems);
                          }}
                          className="w-full p-1 border rounded text-black text-xs"
                        />
                      </div>
                      <div className="text-xs text-green-600 mt-1">
                        Subtotal: Ksh {formatCurrency(item.quantity * item.price)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 p-2 rounded-lg border border-blue-200 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-black text-sm">New Total:</span>
                    <span className="font-bold text-blue-600">
                      Ksh {formatCurrency(editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payments */}
              <div>
                <h3 className="text-sm font-semibold mb-2 text-black">Payments</h3>
                
                {/* Current Payments */}
                {editPayments.length > 0 && (
                  <div className="space-y-1 mb-3">
                    {editPayments.map((payment, index) => (
                      <div key={index} className="flex justify-between items-center bg-white p-2 rounded border text-sm">
                        <div className="flex items-center gap-1">
                          <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                            paymentMethods.find(m => m.value === payment.method)?.color
                          }`}>
                            {payment.method}
                          </span>
                          <span className="font-medium">Ksh {formatCurrency(parseFloat(payment.amount))}</span>
                        </div>
                        {payment.id !== undefined && (
                          <button
                            onClick={() => handleDeletePayment(payment.id as number, editingSale.id)}
                            disabled={deletingPaymentId === payment.id}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Payment */}
                <div className="space-y-2 p-2 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <select
                        value={currentPayment.method}
                        onChange={(e) => setCurrentPayment({...currentPayment, method: e.target.value as any})}
                        className="w-full p-1.5 border rounded text-black text-sm"
                      >
                        {paymentMethods.map(method => (
                          <option key={method.value} value={method.value}>{method.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={currentPayment.amount}
                        onChange={(e) => setCurrentPayment({...currentPayment, amount: e.target.value})}
                        placeholder="Amount"
                        className="w-full p-1.5 border rounded text-black text-sm"
                        disabled={currentPayment.method === "CREDIT"}
                      />
                    </div>
                  </div>
                  
                  {["MPESA", "BANK", "CARD"].includes(currentPayment.method) && (
                    <input
                      type="text"
                      value={currentPayment.referenceId}
                      onChange={(e) => setCurrentPayment({...currentPayment, referenceId: e.target.value})}
                      placeholder="Reference ID"
                      className="w-full p-1.5 border rounded text-black text-sm"
                    />
                  )}
                  
                  {currentPayment.method === "CHECK" && (
                    <input
                      type="date"
                      value={currentPayment.checkDepositDate}
                      onChange={(e) => setCurrentPayment({...currentPayment, checkDepositDate: e.target.value})}
                      className="w-full p-1.5 border rounded text-black text-sm"
                    />
                  )}
                  
                  {currentPayment.method === "CREDIT" && (
                    <input
                      type="date"
                      value={currentPayment.dueDate}
                      onChange={(e) => setCurrentPayment({...currentPayment, dueDate: e.target.value})}
                      className="w-full p-1.5 border rounded text-black text-sm"
                    />
                  )}
                  
                  <button
                    onClick={addEditPayment}
                    className="w-full bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600 text-sm flex items-center justify-center gap-1"
                  >
                    <Plus size={14} />
                    Add Payment
                  </button>
                </div>

                {/* Payment Summary */}
                <div className="bg-blue-50 p-2 rounded-lg text-sm">
                  <div className="flex justify-between mb-1">
                    <span>Total Sale:</span>
                    <span className="font-bold">Ksh {formatCurrency(editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0))}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>Total Payments:</span>
                    <span className="font-bold text-green-600">
                      Ksh {formatCurrency(editPayments.reduce((sum, p) => sum + Number(p.amount), 0))}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t">
                    <span>Remaining:</span>
                    <span className={`font-bold ${
                      Math.max(0, editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0) - editPayments.reduce((sum, p) => sum + Number(p.amount), 0)) > 0 
                        ? 'text-red-600' : 'text-green-600'
                    }`}>
                      Ksh {formatCurrency(Math.max(0, editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0) - editPayments.reduce((sum, p) => sum + Number(p.amount), 0)))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3 border-t">
                <button
                  onClick={() => setEditingSale(null)}
                  disabled={loading}
                  className="flex-1 bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600 disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateSale}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center justify-center gap-1"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Update
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedSalesPage;