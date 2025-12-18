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
  status?: "PENDING" | "COMPLETED" | "BOUNCED";
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
  const [messagingLoading, setMessagingLoading] = useState(false);
  const [selectedMessageType, setSelectedMessageType] = useState("delivery");

  // ADD: Filter state variables
  const [customerFilter, setCustomerFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  
  // ADD: Restock confirmation state
  const [showRestockConfirm, setShowRestockConfirm] = useState<number | null>(null);
  
  // ADD: User details state
  const [userDetails, setUserDetails] = useState<Map<string, UserDetail>>(new Map());
  const [loadingUsers, setLoadingUsers] = useState(false);

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return phone;
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("07")) return "254" + cleanPhone.substring(1);
    if (cleanPhone.startsWith("7") && cleanPhone.length === 9) return "254" + cleanPhone;
    return cleanPhone;
  };

  // UPDATED: Clearer message templates
  const messageTypes = [
    { 
      value: "delivery", 
      label: "Delivery Confirmation",
      getTemplate: (sale: Sale) => 
        `Hello ${sale.customer.name}, your order has been confirmed for delivery. Thank you for choosing Swift Metals.`
    },
    { 
      value: "payment", 
      label: "Payment Reminder",
      getTemplate: (sale: Sale) => 
        `Hello ${sale.customer.name}, this is a kind reminder of your outstanding balance of Ksh ${sale.remainingAmount.toFixed(2)}. We kindly request that you settle at your earliest convenience. Best regards, Swift Metals.`
    },
    { 
      value: "check", 
      label: "Check Deposit Reminder",
      getTemplate: (sale: Sale) => 
        `Hello ${sale.customer.name}, this is a reminder that your check payment is scheduled for deposit soon. Please ensure sufficient funds are available. Best regards, Swift Metals.`
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

  // Fetch user details for createdBy/updatedBy fields
  const fetchUserDetails = useCallback(async (userEmails: string[]) => {
    if (userEmails.length === 0) return;
    
    try {
      setLoadingUsers(true);
      console.log("🔍 Fetching user details for emails:", userEmails);
      
      // Remove duplicates and filter out empty/null values
      const uniqueEmails = [...new Set(userEmails.filter(email => 
        email && 
        typeof email === 'string' && 
        email.trim() && 
        email.includes('@') &&
        email !== "Unknown" && 
        email !== "unknown"
      ))];
      
      if (uniqueEmails.length === 0) {
        setLoadingUsers(false);
        return;
      }
      
      console.log(`📧 Fetching ${uniqueEmails.length} unique user emails`);
      
      // Fetch user details from API
      const response = await fetch(`/api/users/details?emails=${encodeURIComponent(JSON.stringify(uniqueEmails))}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user details: ${response.status}`);
      }
      
      const users: UserDetail[] = await response.json();
      const userMap = new Map<string, UserDetail>();
      
      users.forEach((user) => {
        if (user.email) {
          userMap.set(user.email, user);
        }
      });
      
      setUserDetails(userMap);
      console.log("✅ User details loaded:", userMap.size, "users");
      
    } catch (error) {
      console.error("❌ Error fetching user details:", error);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Extract all unique user emails from sales
  useEffect(() => {
    if (sales.length === 0) return;
    
    const userEmails: string[] = [];
    
    sales.forEach(sale => {
      if (sale.createdBy && sale.createdBy.trim()) {
        userEmails.push(sale.createdBy);
      }
      if (sale.updatedBy && sale.updatedBy.trim() && sale.updatedBy !== sale.createdBy) {
        userEmails.push(sale.updatedBy);
      }
    });
    
    if (userEmails.length > 0) {
      fetchUserDetails(userEmails);
    }
  }, [sales, fetchUserDetails]);

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
    
    // Fallback: extract name from email
    const nameFromEmail = email.split('@')[0]
      .split(/[._-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    
    return {
      name: nameFromEmail,
      email: email
    };
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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Get Firebase ID token
        const user = auth.currentUser;
        let idToken = "";
        
        if (user) {
          idToken = await user.getIdToken();
          
          // Fetch user session with Firebase token
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
          console.log("⚠️ Trying fallback /api/customer...");
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

    // Listen for auth state changes
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
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const paymentMethods = [
    { value: "CASH", label: "Cash", color: "bg-green-100 text-green-800" },
    { value: "MPESA", label: "M-Pesa", color: "bg-blue-100 text-blue-800" },
    { value: "BANK", label: "Bank Transfer", color: "bg-purple-100 text-purple-800" },
    { value: "CHECK", label: "Check", color: "bg-orange-100 text-orange-800" },
    { value: "CARD", label: "Card Payment", color: "bg-pink-100 text-pink-800" },
    { value: "CREDIT", label: "Credit/Pay Later", color: "bg-yellow-100 text-yellow-800" }
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
    
    // Handle stock as either a number or an object with quantity property
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
      // Calculate new total from edited items
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

      // Update the sales list with the processed sale
      setSales(prevSales => 
        prevSales.map(s => s.id === processedSale.id ? processedSale : s)
      );

      // Close the edit modal
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

      // Refresh sales list to ensure sync
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
    // Store references before starting async operation
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

    // Batch state updates to minimize re-renders
    setSales(currentSales.map(s => s.id === processedSale.id ? processedSale : s));
    
    // Only update edit states if editing the same sale
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

  // UPDATED: Handle delete sale with restock confirmation
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

  // NEW: Function to show restock confirmation
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

  // ADD: Clear all filters
  const clearFilters = () => {
    setCustomerFilter("");
    setDateFilter("all");
    setCustomStartDate("");
    setCustomEndDate("");
  };

  // ADD: Check if any filter is active
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

  // ADD: Fully filtered sales with all filters applied
  const fullyFilteredSales = useMemo(() => {
    let filtered = filteredSales; // Start with existing status-filtered sales

    // Apply customer filter
    if (customerFilter.trim()) {
      const searchTerm = customerFilter.toLowerCase().trim();
      filtered = filtered.filter(sale => {
        const customerName = sale.customer?.name?.toLowerCase() || "";
        const customerPhone = sale.customer?.phone?.toLowerCase() || "";
        return customerName.includes(searchTerm) || customerPhone.includes(searchTerm);
      });
    }

    // Apply date filter
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
              end.setHours(23, 59, 59, 999); // Include entire end day
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

  const sendDeliveryConfirmation = async (saleId: number) => {
    setMessagingLoading(true);
    try {
      const res = await fetch("/api/sms/send-delivery-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId }),
      });

      const data = await res.json();

      if (res.ok && !data.blacklist) {
        setSuccess(`Delivery confirmation SMS sent to ${data.customer}`);
      } else {
        setError(data.error || "Failed to send delivery confirmation SMS");
      }
    } catch (err) {
      setError("Failed to send delivery confirmation SMS");
    } finally {
      setMessagingLoading(false);
    }
  };

  if (loading && sales.length === 0) {
    return (
      <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
        <div className="text-center text-black">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 lg:p-8 bg-gray-50 min-h-screen">
      {/* Restock Confirmation Modal */}
      {showRestockConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-yellow-500" size={24} />
              <h3 className="text-xl font-bold text-black">Confirm Sale Deletion</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Would you like to restock the items from this sale back to inventory?
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => handleDeleteSale(showRestockConfirm, true)}
                disabled={loading}
                className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle size={18} />
                Yes, delete and restock items
              </button>
              
              <button
                onClick={() => handleDeleteSale(showRestockConfirm, false)}
                disabled={loading}
                className="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
                No, just delete sale
              </button>
              
              <button
                onClick={() => setShowRestockConfirm(null)}
                disabled={loading}
                className="w-full bg-gray-500 text-white px-4 py-3 rounded-lg hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-black">Sales Management Dashboard</h1>
        <div className="flex gap-2 w-full md:w-auto">
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
            className="flex-1 md:flex-none bg-green-600 text-white px-4 md:px-6 py-3 rounded-xl hover:bg-green-700 flex items-center justify-center gap-2 shadow-lg transition-all text-sm md:text-base"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex justify-between items-start">
          <div className="flex items-start gap-2">
            <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
          <button onClick={clearMessages} className="font-bold text-red-700 text-xl leading-none hover:text-red-900">×</button>
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 flex justify-between items-start">
          <div className="flex items-start gap-2">
            <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
            <span className="text-sm">{success}</span>
          </div>
          <button onClick={clearMessages} className="font-bold text-green-700 text-xl leading-none hover:text-green-900">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-6 mb-6 md:mb-8">
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg border-l-4 border-emerald-500">
          <div className="text-slate-500 text-xs md:text-sm font-medium">Total Sales</div>
          <div className="text-lg md:text-2xl font-bold text-emerald-600">Ksh {stats.totalSales.toFixed(2)}</div>
          <div className="text-xs text-black">{sales.length} orders</div>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
          <div className="text-slate-500 text-xs md:text-sm font-medium">Fully Paid</div>
          <div className="text-lg md:text-2xl font-bold text-blue-600">Ksh {stats.paidSales.toFixed(2)}</div>
          <div className="text-xs text-black">{stats.paidCount} orders</div>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg border-l-4 border-orange-500">
          <div className="text-slate-500 text-xs md:text-sm font-medium">Partially Paid</div>
          <div className="text-lg md:text-2xl font-bold text-orange-600">Ksh {stats.partialSales.toFixed(2)}</div>
          <div className="text-xs text-black">{stats.partialCount} orders</div>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg border-l-4 border-red-500">
          <div className="text-slate-500 text-xs md:text-sm font-medium">Unpaid</div>
          <div className="text-lg md:text-2xl font-bold text-red-600">Ksh {stats.unpaidSales.toFixed(2)}</div>
          <div className="text-xs text-black">{stats.unpaidCount} orders</div>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg border-l-4 border-purple-500">
          <div className="text-slate-500 text-xs md:text-sm font-medium">Outstanding Amount</div>
          <div className="text-lg md:text-2xl font-bold text-purple-600">Ksh {stats.totalOutstanding.toFixed(2)}</div>
          <div className="text-xs text-black">Total remaining</div>
        </div>
      </div>

      {editingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto my-4">
            <div className="p-4 md:p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex justify-between items-center">
                <h2 className="text-xl md:text-2xl font-bold text-black">Edit Sale #{editingSale.id}</h2>
                <button
                  onClick={() => setEditingSale(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-4 md:p-6 space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-3 text-black">Sale Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Customer:</span>
                    <span className="font-medium ml-2 text-black">{editingSale.customer.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-medium ml-2 text-black">Ksh {editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Date:</span>
                    <span className="font-medium ml-2 text-black">{new Date(editingSale.date).toLocaleDateString()}</span>
                  </div>
                  <div>
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
                
                {/* Updated Accountability Section */}
                {(editingSale.createdBy || editingSale.updatedBy) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">Accountability</h4>
                    {editingSale.createdBy && (
                      <div className="text-xs text-gray-600 mb-2">
                        <div className="flex items-center gap-1 mb-1">
                          <User size={10} className="text-blue-500" />
                          <span className="font-medium">Created by:</span>
                        </div>
                        <div className="ml-4">
                          <div className="text-blue-600 font-medium">
                            {getUserDisplayName(editingSale.createdBy).name}
                          </div>
                          <div className="text-gray-500">
                            {getUserDisplayName(editingSale.createdBy).email}
                          </div>
                          {editingSale.createdAt && (
                            <div className="text-gray-400">
                              {new Date(editingSale.createdAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {editingSale.updatedBy && (
                      <div className="text-xs text-gray-600">
                        <div className="flex items-center gap-1 mb-1">
                          <User size={10} className="text-green-500" />
                          <span className="font-medium">Last updated by:</span>
                        </div>
                        <div className="ml-4">
                          <div className="text-green-600 font-medium">
                            {getUserDisplayName(editingSale.updatedBy).name}
                          </div>
                          <div className="text-gray-500">
                            {getUserDisplayName(editingSale.updatedBy).email}
                          </div>
                          {editingSale.updatedAt && (
                            <div className="text-gray-400">
                              {new Date(editingSale.updatedAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {editingSale.remainingAmount > 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <label className="block text-sm font-medium text-black mb-2">
                      Payment Due Date {editingSale.remainingAmount > 0 && <span className="text-red-600">*</span>}
                    </label>
                    <input
                      type="date"
                      value={editingSale.dueDate || ""}
                      onChange={(e) => setEditingSale({...editingSale, dueDate: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg text-black"
                      min={new Date().toISOString().split('T')[0]}
                    />
                    {!editingSale.dueDate && editingSale.remainingAmount > 0 && (
                      <p className="text-xs text-red-600 mt-1">Due date is required for outstanding balance</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3 text-black flex items-center gap-2">
                  <Calculator size={20} />
                  Edit Sale Items
                </h3>
                
                {/* Add New Item Section */}
                <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-black">Add New Item</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="relative product-dropdown-container">
                      <label className="block text-sm font-medium text-black mb-1">Product *</label>
                      <input
                        type="text"
                        placeholder="Search product by name..."
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          setShowProductDropdown(true);
                        }}
                        onFocus={() => setShowProductDropdown(true)}
                        className="w-full p-2 border border-gray-300 rounded text-black"
                      />
                      {showProductDropdown && filteredProducts.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {[...filteredProducts].sort((a, b) => a.name.localeCompare(b.name)).map(product => (
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
                              className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-medium text-black">{product.name}</div>
                                  <div className="text-sm text-gray-600">
                                    Stock:{" "}
                                    {Array.isArray(product.stock)
                                      ? product.stock.reduce((total, s) => total + (s.quantity || 0), 0)
                                      : 0}
                                    {" "} | Price: Ksh {product.price?.toLocaleString() || 0}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {showProductDropdown && productSearch && filteredProducts.length === 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3">
                          <div className="text-gray-500 text-sm">No products found</div>
                        </div>
                      )}
                      {currentEditItem.productId > 0 && (
                        <div className="mt-1 text-sm text-green-600 flex items-center gap-1">
                          <CheckCircle size={14} />
                          {currentEditItem.productName} selected
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Quantity *</label>
                        <input
                          type="number"
                          min="1"
                          value={currentEditItem.quantity}
                          onChange={(e) => setCurrentEditItem({...currentEditItem, quantity: parseInt(e.target.value) || 1})}
                          className="w-full p-2 border rounded text-black text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Price *</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={currentEditItem.price}
                          onChange={(e) => setCurrentEditItem({...currentEditItem, price: parseFloat(e.target.value) || 0})}
                          className="w-full p-2 border rounded text-black text-sm"
                        />
                      </div>
                    </div>
                    
                    {currentEditItem.productId > 0 && (
                      <div className="bg-blue-50 p-3 rounded-lg text-sm">
                        <div className="font-medium text-black">
                          Total: Ksh {(currentEditItem.quantity * currentEditItem.price).toFixed(2)}
                        </div>
                      </div>
                    )}
                    
                    <button
                      type="button"
                      onClick={handleAddItemToEditSale}
                      disabled={!currentEditItem.productId || currentEditItem.quantity <= 0 || currentEditItem.price <= 0}
                      className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Plus size={16} />
                      Add Item to Sale
                    </button>
                  </div>
                </div>

                {/* Existing Items */}
                <div className="space-y-3">
                  {editSaleItems.map((item, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg border">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Product</label>
                          <input
                            type="text"
                            value={item.productName}
                            disabled
                            className="w-full p-2 border rounded bg-gray-100 text-black text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const newItems = [...editSaleItems];
                              newItems[index].quantity = parseInt(e.target.value) || 1;
                              setEditSaleItems(newItems);
                            }}
                            className="w-full p-2 border rounded text-black text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Price</label>
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
                            className="w-full p-2 border rounded text-black text-sm"
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex justify-between items-center">
                        <span className="text-sm font-semibold text-green-600">
                          Subtotal: Ksh {(item.quantity * item.price).toFixed(2)}
                        </span>
                        <button
                          onClick={() => {
                            if (editSaleItems.length === 1) {
                              setError("Cannot delete the only item. Delete the entire sale instead.");
                              return;
                            }
                            setEditSaleItems(editSaleItems.filter((_, i) => i !== index));
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-black">New Total:</span>
                      <span className="text-xl font-bold text-blue-600">
                        Ksh {editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4 text-black">Payments</h3>
                
                {editPayments.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <h4 className="font-medium text-black">Current Payments:</h4>
                    {editPayments.map((payment, index) => (
                      <div key={index} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-lg border gap-2">
                        <div className="flex items-center gap-2 flex-wrap flex-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            paymentMethods.find(m => m.value === payment.method)?.color
                          }`}>
                            {payment.method}
                          </span>
                          <span className="font-medium text-black">Ksh {parseFloat(payment.amount).toFixed(2)}</span>
                          {payment.referenceId && (
                            <span className="text-gray-600 text-sm">Ref: {payment.referenceId}</span>
                          )}
                        </div>
                        {payment.id !== undefined && (
                          <button
                            onClick={() => handleDeletePayment(payment.id as number, editingSale.id)}
                            disabled={deletingPaymentId === payment.id}
                            className="text-red-500 hover:text-red-700 disabled:opacity-50"
                          >
                            {deletingPaymentId === payment.id ? (
                              <span className="animate-spin border-2 border-red-500 border-t-transparent rounded-full w-4 h-4 inline-block"></span>
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-black">Add New Payment</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-black mb-1">Payment Method</label>
                        <select
                          value={currentPayment.method}
                          onChange={(e) => setCurrentPayment({...currentPayment, method: e.target.value as any})}
                          className="w-full p-2 border border-gray-300 rounded text-black"
                        >
                          {paymentMethods.map(method => (
                            <option key={method.value} value={method.value}>{method.label}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-black mb-1">
                          Amount {currentPayment.method !== "CREDIT" && "*"}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          max={Math.max(0, editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0) - editPayments.reduce((sum, p) => sum + Number(p.amount), 0))}
                          value={currentPayment.amount}
                          onChange={(e) => setCurrentPayment({...currentPayment, amount: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded text-black"
                          placeholder={currentPayment.method === "CREDIT" ? "0.00 (optional)" : "0.00"}
                          disabled={currentPayment.method === "CREDIT"}
                        />
                        <div className="text-xs text-gray-600 mt-1">
                          {currentPayment.method === "CREDIT" 
                            ? "No payment required for credit" 
                            : `Max: Ksh ${Math.max(0, editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0) - editPayments.reduce((sum, p) => sum + Number(p.amount), 0)).toFixed(2)}`}
                        </div>
                      </div>
                    </div>
                    
                    {["MPESA", "BANK", "CARD"].includes(currentPayment.method) && (
                      <div>
                        <label className="block text-sm font-medium text-black mb-1">
                          Reference ID <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={currentPayment.referenceId}
                          onChange={(e) => setCurrentPayment({...currentPayment, referenceId: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded text-black"
                          placeholder="Transaction ID / Reference Number"
                        />
                      </div>
                    )}
                    
                    {currentPayment.method === "CHECK" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-black mb-1">
                            Check Number
                          </label>
                          <input
                            type="text"
                            value={currentPayment.referenceId}
                            onChange={(e) => setCurrentPayment({...currentPayment, referenceId: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded text-black"
                            placeholder="Check Number"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-black mb-1">
                            Deposit Date <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="date"
                            value={currentPayment.checkDepositDate}
                            onChange={(e) => setCurrentPayment({...currentPayment, checkDepositDate: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded text-black"
                          />
                        </div>
                      </div>
                    )}
                    
                    {currentPayment.method === "CREDIT" && (
                      <div>
                        <label className="block text-sm font-medium text-black mb-1">
                          Due Date <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="date"
                          value={currentPayment.dueDate}
                          onChange={(e) => setCurrentPayment({...currentPayment, dueDate: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded text-black"
                          min={new Date().toISOString().split("T")[0]}
                        />
                      </div>
                    )}
                    
                    <button
                      type="button"
                      onClick={addEditPayment}
                      disabled={
                        (currentPayment.method !== "CREDIT" && (!currentPayment.amount || parseFloat(currentPayment.amount) <= 0)) ||
                        (["MPESA", "BANK", "CARD"].includes(currentPayment.method) && !currentPayment.referenceId?.trim()) ||
                        (currentPayment.method === "CHECK" && !currentPayment.checkDepositDate) ||
                        (currentPayment.method === "CREDIT" && !currentPayment.dueDate)
                      }
                      className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Plus size={16} />
                      Add Payment
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-black">Total Sale Amount:</span>
                    <span className="font-bold text-blue-600">Ksh {editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-black">Total Payments:</span>
                    <span className="font-bold text-green-600">
                      Ksh {editPayments.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="font-medium text-black">Remaining Amount:</span>
                    <span className={`font-bold ${
                      Math.max(0, editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0) - editPayments.reduce((sum, p) => sum + Number(p.amount), 0)) > 0 
                        ? 'text-red-600' : 'text-green-600'
                    }`}>
                      Ksh {Math.max(0, editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0) - editPayments.reduce((sum, p) => sum + Number(p.amount), 0)).toFixed(2)}
                    </span>
                  </div>
                  
                  {currentPayment.amount && Number(currentPayment.amount) > Math.max(0, editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0) - editPayments.reduce((sum, p) => sum + Number(p.amount), 0)) && (
                    <div className="mt-3 bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
                      Warning: Payment amount exceeds remaining balance. Maximum allowed: Ksh {Math.max(0, editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0) - editPayments.reduce((sum, p) => sum + Number(p.amount), 0)).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
                <button
                  onClick={() => setEditingSale(null)}
                  disabled={loading}
                  className="flex-1 bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateSale}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Updating Sale...
                    </>
                  ) : (
                    <>
                      <Save size={20} />
                      Update Sale
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow mb-6 overflow-hidden">
        <div className="flex overflow-x-auto scrollbar-thin">
          {[
            { key: "messaging", label: "SMS", icon: <MessageSquare size={16} />, count: 0 },
            { key: "overview", label: "All", count: sales.length },
            { key: "paid", label: "Paid", count: stats.paidCount },
            { key: "partial", label: "Partial", count: stats.partialCount },
            { key: "unpaid", label: "Unpaid", count: stats.unpaidCount }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-shrink-0 px-3 md:px-4 py-3 text-center transition-colors whitespace-nowrap min-w-[80px] ${
                activeTab === tab.key
                  ? "border-b-2 border-blue-500 text-blue-600 font-semibold"
                  : "text-black hover:text-gray-800"
              }`}
            >
              <div className="flex items-center justify-center gap-1 md:gap-2">
                {tab.icon}
                <span className="text-xs md:text-sm">{tab.label}</span>
                <span className="text-xs">({tab.count})</span>
              </div>
            </button>
          ))}
        </div>

        {activeTab === "messaging" && (
          <div className="p-4 md:p-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-blue-800 mb-2">SMS Messaging</h4>
              <p className="text-sm text-blue-700">Send automated payment reminders and delivery confirmations via SMS</p>
            </div>
          </div>
        )}

        {activeTab !== "messaging" && (
          <div className="p-3 md:p-6">
            {/* Filter controls */}
            <div className="mb-4 p-3 md:p-4 bg-white rounded-lg border shadow-sm">
              <div className="flex flex-col md:flex-row gap-3">
                {/* Customer Search */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search customer..."
                      value={customerFilter}
                      onChange={(e) => setCustomerFilter(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {customerFilter && (
                      <button
                        onClick={() => setCustomerFilter("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <XCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Date Filter */}
                <div className="relative date-filter-container">
                  <button
                    onClick={() => setShowDateFilter(!showDateFilter)}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 border rounded-lg text-black hover:bg-gray-50 text-sm ${
                      dateFilter !== "all" ? "bg-blue-50 border-blue-200" : ""
                    }`}
                  >
                    <Calendar size={16} />
                    <span>
                      {dateFilter === "today" ? "Today" :
                       dateFilter === "week" ? "Week" :
                       dateFilter === "month" ? "Month" :
                       dateFilter === "custom" ? "Custom" : "Date"}
                    </span>
                    <ChevronDown size={14} className={`transition-transform ${showDateFilter ? "rotate-180" : ""}`} />
                  </button>

                  {showDateFilter && (
                    <div className="absolute z-20 mt-2 w-64 bg-white border border-gray-300 rounded-lg shadow-lg right-0">
                      <div className="p-3 space-y-2">
                        <button
                          onClick={() => { setDateFilter("all"); setShowDateFilter(false); }}
                          className={`w-full text-left px-3 py-2 rounded text-sm ${dateFilter === "all" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-black"}`}
                        >
                          All Dates
                        </button>
                        <button
                          onClick={() => { setDateFilter("today"); setShowDateFilter(false); }}
                          className={`w-full text-left px-3 py-2 rounded text-sm ${dateFilter === "today" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-black"}`}
                        >
                          Today
                        </button>
                        <button
                          onClick={() => { setDateFilter("week"); setShowDateFilter(false); }}
                          className={`w-full text-left px-3 py-2 rounded text-sm ${dateFilter === "week" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-black"}`}
                        >
                          This Week
                        </button>
                        <button
                          onClick={() => { setDateFilter("month"); setShowDateFilter(false); }}
                          className={`w-full text-left px-3 py-2 rounded text-sm ${dateFilter === "month" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-black"}`}
                        >
                          This Month
                        </button>
                        <div className="pt-2 border-t">
                          <div className="px-3 py-2 text-xs font-medium text-gray-500">Custom Range</div>
                          <div className="px-3 pb-2 space-y-2">
                            <div>
                              <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => {
                                  setCustomStartDate(e.target.value);
                                  setDateFilter("custom");
                                }}
                                className="w-full p-2 text-xs border rounded text-black"
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
                                className="w-full p-2 text-xs border rounded text-black"
                                min={customStartDate}
                                max={new Date().toISOString().split('T')[0]}
                              />
                            </div>
                            <button
                              onClick={() => setShowDateFilter(false)}
                              className="w-full text-sm px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                              Apply Range
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Clear Filters Button */}
                {isFilterActive && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-2 px-3 md:px-4 py-2 text-xs md:text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg border border-red-200"
                  >
                    <XCircle size={14} />
                    Clear
                  </button>
                )}
              </div>

              {/* Active Filters Display */}
              {isFilterActive && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-gray-600">Active filters:</span>
                    {customerFilter && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                        {customerFilter.length > 15 ? customerFilter.substring(0, 15) + '...' : customerFilter}
                        <button onClick={() => setCustomerFilter("")} className="text-blue-600 hover:text-blue-800">
                          <X size={12} />
                        </button>
                      </span>
                    )}
                    {dateFilter !== "all" && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                        {dateFilter === "today" ? "Today" :
                         dateFilter === "week" ? "Week" :
                         dateFilter === "month" ? "Month" : "Custom"}
                        <button onClick={() => setDateFilter("all")} className="text-green-600 hover:text-green-800">
                          <X size={12} />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile View - Improved Layout */}
            <div className="block lg:hidden space-y-4">
              {fullyFilteredSales.map((sale) => (
                <div key={sale.id} className="bg-white border rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-black text-sm">{sale.customer?.name || "-"}</h3>
                      {sale.customer?.phone && (
                        <p className="text-xs text-gray-500">{sale.customer.phone}</p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      sale.status === "PAID" ? "bg-green-100 text-green-800" :
                      sale.status === "PARTIAL" ? "bg-orange-100 text-orange-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      {sale.status}
                    </span>
                  </div>

                  <div className="space-y-2 mb-3">
                    {sale.saleitems && sale.saleitems.length > 0 && (
                      <div className="text-xs">
                        {sale.saleitems.slice(0, 2).map((item, idx) => (
                          <div key={idx} className="text-black">
                            <span className="font-medium">{item.product.name}</span>
                            <span> (×{item.quantity})</span>
                          </div>
                        ))}
                        {sale.saleitems.length > 2 && (
                          <div className="text-gray-500 mt-1">
                            +{sale.saleitems.length - 2} more items
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div>
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-semibold text-emerald-600 ml-1">Ksh {sale.amount.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Remaining:</span>
                      <span className="font-semibold text-red-600 ml-1">Ksh {sale.remainingAmount.toFixed(2)}</span>
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

                  {/* Updated User Accountability Section for Mobile */}
                  {(sale.createdBy || sale.updatedBy) && (
                    <div className="text-xs text-gray-500 mb-3 p-2 bg-gray-50 rounded">
                      {sale.createdBy && (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <User size={10} className="text-blue-500" />
                            <span className="font-medium">Created by:</span>
                          </div>
                          <div className="ml-4">
                            <div className="text-blue-600 font-medium">
                              {getUserDisplayName(sale.createdBy).name}
                            </div>
                            <div className="text-gray-400 text-xs">
                              {formatDate(sale.createdAt)} at {formatTime(sale.createdAt)}
                            </div>
                          </div>
                        </div>
                      )}
                      {sale.updatedBy && sale.updatedBy !== sale.createdBy && (
                        <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-gray-200">
                          <div className="flex items-center gap-1">
                            <User size={10} className="text-green-500" />
                            <span className="font-medium">Updated by:</span>
                          </div>
                          <div className="ml-4">
                            <div className="text-green-600 font-medium">
                              {getUserDisplayName(sale.updatedBy).name}
                            </div>
                            <div className="text-gray-400 text-xs">
                              {formatDate(sale.updatedAt)} at {formatTime(sale.updatedAt)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedMessageType}
                        onChange={(e) => setSelectedMessageType(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded text-black"
                      >
                        {messageTypes.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                      
                      <button
                        onClick={() => window.open(`/api/receipt/${sale.id}`, "_blank")}
                        className="px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center gap-1"
                        title="Download receipt"
                      >
                        <Download size={12} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          if (!sale.customer?.phone) {
                            setError("Customer phone required");
                            setTimeout(() => setError(null), 3000);
                            return;
                          }

                          const phone = formatPhoneNumber(sale.customer.phone);
                          const selectedTemplate = messageTypes.find(t => t.value === selectedMessageType);
                          const message = encodeURIComponent(selectedTemplate?.getTemplate(sale) || "Thank you for your business!");

                          const useWhatsApp = confirm("Send via WhatsApp? (Click Cancel for SMS)");

                          if (useWhatsApp) {
                            window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
                          } else {
                            window.open(`sms:${phone}?body=${message}`, "_blank");
                          }
                        }}
                        disabled={!sale.customer?.phone}
                        className="px-2 py-2 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <MessageSquare size={12} />
                        <span className="hidden xs:inline">Message</span>
                      </button>
                      
                      <button
                        onClick={() => handleEditSale(sale)}
                        className="px-2 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center gap-1"
                      >
                        <Edit size={12} />
                        <span className="hidden xs:inline">Edit</span>
                      </button>
                      
                      <button
                        onClick={() => showDeleteConfirmation(sale.id)}
                        disabled={loading}
                        className="px-2 py-2 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <Trash2 size={12} />
                        <span className="hidden xs:inline">Delete</span>
                      </button>
                      
                      <button
                        onClick={() => sendDeliveryConfirmation(sale.id)}
                        disabled={messagingLoading || !sale.customer?.phone}
                        className="px-2 py-2 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <MessageSquare size={12} />
                        <span className="hidden xs:inline">SMS</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {fullyFilteredSales.length === 0 && (
                <div className="text-center py-8 text-black text-sm">
                  {isFilterActive ? "No sales match your filters" : "No sales found for this category"}
                </div>
              )}
            </div>

            {/* Desktop View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="p-3 text-left text-black text-sm font-semibold">Product(s)</th>
                    <th className="p-3 text-left text-black text-sm font-semibold">Customer</th>
                    <th className="p-3 text-left text-black text-sm font-semibold">Amount</th>
                    <th className="p-3 text-left text-black text-sm font-semibold">Status</th>
                    <th className="p-3 text-left text-black text-sm font-semibold">Remaining</th>
                    <th className="p-3 text-left text-black text-sm font-semibold">Date</th>
                    <th className="p-3 text-left text-black text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fullyFilteredSales.map((sale) => (
                    <tr key={sale.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div className="max-w-xs">
                          {sale.saleitems && sale.saleitems.length > 0
                            ? sale.saleitems.map((item, idx) => (
                                <div key={idx} className="text-sm">
                                  <span className="font-medium text-black">{item.product.name}</span>
                                  <span className="text-gray-600"> (×{item.quantity})</span>
                                </div>
                              ))
                            : <span className="text-black">-</span>}
                        </div>
                      </td>
                      <td className="p-3">
                        <div>
                          <div className="font-medium text-black">{sale.customer?.name || "-"}</div>
                          {sale.customer?.phone && (
                            <div className="text-xs text-gray-500">{sale.customer.phone}</div>
                          )}
                          {/* Updated User Accountability for Desktop */}
                          {(sale.createdBy || sale.updatedBy) && (
                            <div className="text-xs text-gray-400 mt-1 space-y-1">
                              {sale.createdBy && (
                                <div className="flex items-center gap-1">
                                  <User size={10} className="text-blue-500 flex-shrink-0" />
                                  <span className="text-blue-600 font-medium truncate max-w-[100px]">
                                    {getUserDisplayName(sale.createdBy).name}
                                  </span>
                                  <span className="text-gray-500">created</span>
                                  {sale.createdAt && (
                                    <span className="text-gray-400 text-xs">
                                      {formatDate(sale.createdAt)}
                                    </span>
                                  )}
                                </div>
                              )}
                              {sale.updatedBy && sale.updatedBy !== sale.createdBy && (
                                <div className="flex items-center gap-1">
                                  <User size={10} className="text-green-500 flex-shrink-0" />
                                  <span className="text-green-600 font-medium truncate max-w-[100px]">
                                    {getUserDisplayName(sale.updatedBy).name}
                                  </span>
                                  <span className="text-gray-500">updated</span>
                                  {sale.updatedAt && (
                                    <span className="text-gray-400 text-xs">
                                      {formatDate(sale.updatedAt)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-emerald-600">
                        Ksh {sale.amount.toFixed(2)}
                      </td>
                      <td className="p-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          sale.status === "PAID" ? "bg-green-100 text-green-800" :
                          sale.status === "PARTIAL" ? "bg-orange-100 text-orange-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {sale.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {sale.remainingAmount > 0 ? (
                          <span className="font-bold text-red-600">
                            Ksh {sale.remainingAmount.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-green-600 font-medium">Paid in full</span>
                        )}
                      </td>
                      <td className="p-3 text-black text-sm">{formatDate(sale.date)}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <select
                            value={selectedMessageType}
                            onChange={(e) => setSelectedMessageType(e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded text-black"
                          >
                            {messageTypes.map(type => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => {
                              if (!sale.customer?.phone) {
                                setError("Customer phone number required");
                                setTimeout(() => setError(null), 3000);
                                return;
                              }

                              const phone = formatPhoneNumber(sale.customer.phone);
                              const selectedTemplate = messageTypes.find(t => t.value === selectedMessageType);
                              const message = encodeURIComponent(selectedTemplate?.getTemplate(sale) || "Thank you for your business!");

                              const useWhatsApp = confirm("Send via WhatsApp? (Click Cancel for SMS)");

                              if (useWhatsApp) {
                                window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
                              } else {
                                window.open(`sms:${phone}?body=${message}`, "_blank");
                              }
                            }}
                            disabled={!sale.customer?.phone}
                            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            title={!sale.customer?.phone ? "Customer phone number required" : "Open WhatsApp or SMS to send manually"}
                          >
                            <MessageSquare size={14} />
                            Message
                          </button>
                          
                          <button
                            onClick={() => sendDeliveryConfirmation(sale.id)}
                            disabled={messagingLoading || !sale.customer?.phone}
                            className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex items-center gap-1"
                            title={!sale.customer?.phone ? "Customer phone number required" : "Send delivery confirmation SMS"}
                          >
                            <MessageSquare size={14} />
                            SMS
                          </button>
                          
                          <button
                            onClick={() => window.open(`/api/receipt/${sale.id}`, "_blank")}
                            className="px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center gap-1"
                            title="Download receipt"
                          >
                            <Download size={14} />
                            Receipt
                          </button>
                          
                          <button
                            onClick={() => handleEditSale(sale)}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                            title="Edit sale"
                          >
                            <Edit size={14} />
                            Edit
                          </button>
                          
                          <button
                            onClick={() => showDeleteConfirmation(sale.id)}
                            disabled={loading}
                            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 flex items-center gap-1"
                            title="Delete sale"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {fullyFilteredSales.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-black">
                        {isFilterActive ? "No sales match your filters" : "No sales found for this category"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedSalesPage;