"use client";
import Link from "next/link";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  TrendingUp,
  Receipt,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Activity,
  DollarSign,
  ChevronRight,
  Bell,
  X,
  AlertTriangle,
  Info,
  CheckCircle,
  Plus,
  Zap,
  Search,
  Trash2
} from "lucide-react";

interface Customer {
  id: number;
  name: string;
  phone?: string;
}

interface Product {
  id: number;
  name: string;
  price?: number;
  stock?: any;
}

interface QuickSaleItem {
  productId: number;
  productName: string;
  quantity: number;
  price: number;
}

interface RestockForm {
  quantity: number;
  costPrice: string;
  paymentSource: "cash" | "credit";
  creditorName: string;
}

export default function AdminDashboard() {
  const [quickStats, setQuickStats] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Quick Sale States
  const [showQuickSale, setShowQuickSale] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [saleItems, setSaleItems] = useState<QuickSaleItem[]>([]);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [currentPrice, setCurrentPrice] = useState("");
  const [payments, setPayments] = useState<any[]>([]);
  const [currentPayment, setCurrentPayment] = useState({
    amount: "",
    method: "CASH",
    referenceId: "",
    checkDepositDate: "",
    dueDate: ""
  });
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [creating, setCreating] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [saleSuccess, setSaleSuccess] = useState<string | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);

  // Restock Modal States
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockingProduct, setRestockingProduct] = useState<Product | null>(null);
  const [restockForm, setRestockForm] = useState<RestockForm>({
    quantity: 1,
    costPrice: "",
    paymentSource: "cash",
    creditorName: ""
  });
  const [restocking, setRestocking] = useState(false);
  const [restockError, setRestockError] = useState<string | null>(null);

  // Refs for dropdown management
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  const adminSections = [
    {
      title: "Sales",
      description: "View and manage all sales records and transactions.",
      href: "/admin/sales",
      icon: TrendingUp,
      color: "bg-emerald-500",
      stats: "↑ 12% this month",
    },
    {
      title: "Expenses",
      description: "Track and manage expenses and payments efficiently.",
      href: "/admin/expenses",
      icon: Receipt,
      color: "bg-red-500",
      stats: "KSh 45,230 this month",
    },
    {
      title: "Orders",
      description: "Track customer orders and fulfillment status.",
      href: "/admin/orders",
      icon: ShoppingCart,
      color: "bg-orange-500",
      stats: "15 pending orders",
    },
    {
      title: "Customers",
      description: "Manage customer relationships and information.",
      href: "/admin/customers",
      icon: Users,
      color: "bg-purple-500",
      stats: "1,247 total customers",
    },
    {
      title: "Reports",
      description: "Generate comprehensive business analytics.",
      href: "/admin/reports",
      icon: BarChart3,
      color: "bg-teal-500",
      stats: "8 reports available",
    },
    {
      title: "Products",
      description: "View and manage your inventory.",
      href: "/admin/products",
      icon: Package,
      color: "bg-gray-600",
      stats: "Last updated 2d ago",
    },
    {
      title: "Catalog",
      description: "Manage products shown to customers & visitors.",
      href: "/admin/catalog-products",
      icon: Package,
      color: "bg-blue-500",
      stats: "Public-facing items",
    },
  ];

  const paymentMethods = [
    { value: "CASH", label: "Cash", color: "bg-green-100 text-green-800" },
    { value: "MPESA", label: "M-Pesa", color: "bg-blue-100 text-blue-800" },
    { value: "BANK", label: "Bank Transfer", color: "bg-purple-100 text-purple-800" },
    { value: "CHECK", label: "Check", color: "bg-orange-100 text-orange-800" },
    { value: "CARD", label: "Card Payment", color: "bg-pink-100 text-pink-800" },
    { value: "CREDIT", label: "Credit/Pay Later", color: "bg-yellow-100 text-yellow-800" }
  ];

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ordersRes, productsRes, salesRes] = await Promise.all([
        fetch("/api/orders").catch(() => null),
        fetch("/api/products").catch(() => null),
        fetch("/api/sales").catch(() => null)
      ]);

      let customersRes = await fetch("/api/customers").catch(() => null);
      if (!customersRes || !customersRes.ok) {
        customersRes = await fetch("/api/customer").catch(() => null);
      }

      const parseJSON = async (response: Response | null) => {
        if (!response || !response.ok) return [];
        const text = await response.text();
        if (!text || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
          return [];
        }
        try {
          return JSON.parse(text);
        } catch {
          return [];
        }
      };

      const [orders, productsData, sales, customersData] = await Promise.all([
        parseJSON(ordersRes),
        parseJSON(productsRes),
        parseJSON(salesRes),
        parseJSON(customersRes)
      ]);

      setProducts(Array.isArray(productsData) ? productsData : []);
      setCustomers(Array.isArray(customersData) ? customersData : (customersData?.customers || customersData?.data || []));

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayRevenue = sales
        .filter((s: any) => {
          const dateStr = s.createdAt || s.saleDate || s.date || s.created_at;
          if (!dateStr) return false;
          const saleDate = new Date(dateStr);
          saleDate.setHours(0, 0, 0, 0);
          return saleDate.getTime() === today.getTime();
        })
        .reduce((sum: number, s: any) => {
          const amount = s.totalAmount || s.total || s.amount || s.total_amount || 0;
          return sum + amount;
        }, 0);

      const activeOrders = orders.filter((o: any) => o.status === "PENDING").length;
      const lowStockItems = productsData.filter((p: any) => {
        const stock = Array.isArray(p.stock) 
          ? p.stock.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0)
          : (p.stock?.quantity || 0);
        return stock <= 5;
      });
      const criticalStockItems = productsData.filter((p: any) => {
        const stock = Array.isArray(p.stock) 
          ? p.stock.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0)
          : (p.stock?.quantity || 0);
        return stock === 0;
      });

      const newNotifications: any[] = [];

      if (criticalStockItems.length > 0) {
        newNotifications.push({
          id: `critical-stock-${Date.now()}`,
          type: "critical",
          priority: 1,
          icon: AlertTriangle,
          title: "Out of Stock Alert",
          message: `${criticalStockItems.length} product${criticalStockItems.length > 1 ? 's are' : ' is'} out of stock`,
          details: criticalStockItems.slice(0, 3).map((i: any) => i.name).join(", ") + 
                   (criticalStockItems.length > 3 ? ` and ${criticalStockItems.length - 3} more` : ""),
          link: "/admin/products",
          timestamp: new Date().toISOString(),
        });
      }

      if (lowStockItems.length > 0 && criticalStockItems.length < lowStockItems.length) {
        newNotifications.push({
          id: `low-stock-${Date.now()}`,
          type: "warning",
          priority: 2,
          icon: AlertTriangle,
          title: "Low Stock Warning",
          message: `${lowStockItems.length - criticalStockItems.length} product${lowStockItems.length - criticalStockItems.length > 1 ? 's are' : ' is'} running low`,
          link: "/admin/products",
          timestamp: new Date().toISOString(),
        });
      }

      if (activeOrders > 0) {
        newNotifications.push({
          id: `pending-orders-${Date.now()}`,
          type: "info",
          priority: 3,
          icon: ShoppingCart,
          title: "Pending Orders",
          message: `${activeOrders} order${activeOrders > 1 ? 's' : ''} awaiting processing`,
          link: "/admin/orders",
          timestamp: new Date().toISOString(),
        });
      }

      newNotifications.sort((a, b) => a.priority - b.priority);
      setNotifications(newNotifications);

      setQuickStats([
        {
          title: "Today's Revenue",
          value: `KSh ${todayRevenue.toLocaleString()}`,
          change: "+0%",
          icon: DollarSign,
          positive: true,
        },
        {
          title: "Active Orders",
          value: activeOrders.toString(),
          change: `${activeOrders} pending`,
          icon: ShoppingCart,
          positive: true,
        },
        {
          title: "Low Stock Items",
          value: lowStockItems.length.toString(),
          change: criticalStockItems.length > 0 ? `${criticalStockItems.length} critical` : "Good",
          icon: Package,
          positive: lowStockItems.length === 0,
        },
        {
          title: "System Health",
          value: "99.8%",
          change: "Excellent",
          icon: Activity,
          positive: true,
        },
      ]);
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle click outside for dropdowns
  useEffect(() => {
    if (!showQuickSale) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(target)) {
        setShowCustomerDropdown(false);
      }
      
      if (productDropdownRef.current && !productDropdownRef.current.contains(target)) {
        setShowProductDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showQuickSale]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 10);
    return customers.filter(c => 
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(customerSearch))
    ).slice(0, 10);
  }, [customers, customerSearch]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 10);
    return products.filter(p => 
      p.name.toLowerCase().includes(productSearch.toLowerCase())
    ).slice(0, 10);
  }, [products, productSearch]);

  const getProductStock = (product: Product) => {
    if (Array.isArray(product.stock)) {
      return product.stock.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0);
    }
    return product.stock?.quantity || 0;
  };

  const isLowStock = (product: Product) => {
    const stock = getProductStock(product);
    return stock <= 5;
  };

  const isOutOfStock = (product: Product) => {
    const stock = getProductStock(product);
    return stock === 0;
  };

  const openRestockModal = (product: Product) => {
    setRestockingProduct(product);
    setRestockForm({
      quantity: 1,
      costPrice: product.price?.toString() || "",
      paymentSource: "cash",
      creditorName: ""
    });
    setRestockError(null);
    setShowRestockModal(true);
  };

  const closeRestockModal = () => {
    setShowRestockModal(false);
    setRestockingProduct(null);
    setRestockForm({
      quantity: 1,
      costPrice: "",
      paymentSource: "cash",
      creditorName: ""
    });
    setRestockError(null);
  };

  const handleRestockSubmit = async () => {
    if (!restockingProduct) return;

    // Validation
    if (restockForm.quantity <= 0) {
      setRestockError("Quantity must be greater than 0");
      setTimeout(() => setRestockError(null), 3000);
      return;
    }

    const costPrice = parseFloat(restockForm.costPrice);
    if (isNaN(costPrice) || costPrice <= 0) {
      setRestockError("Please enter a valid cost price");
      setTimeout(() => setRestockError(null), 3000);
      return;
    }

    if (restockForm.paymentSource === "credit" && !restockForm.creditorName.trim()) {
      setRestockError("Creditor name is required for credit purchases");
      setTimeout(() => setRestockError(null), 3000);
      return;
    }

    setRestocking(true);
    setRestockError(null);

    try {
      // Calculate total cost
      const totalCost = restockForm.quantity * costPrice;

      // Prepare the request body to match Prisma schema
      const requestBody: any = {
        productId: restockingProduct.id,
        quantity: restockForm.quantity,
        costPrice: costPrice,
        totalCost: totalCost,
        paymentSource: restockForm.paymentSource.toLowerCase(), // "cash" or "credit"
      };

      // Only include creditor info if payment source is credit
      if (restockForm.paymentSource === "credit") {
        requestBody.creditorName = restockForm.creditorName.trim();
      }

      console.log("Restock request body:", requestBody);

      const response = await fetch("/api/restock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();
      console.log("Restock response:", responseData);

      if (!response.ok) {
        throw new Error(responseData.error || responseData.message || "Failed to restock product");
      }

      console.log("Restock successful:", responseData);

      // Show success message
      setSaleSuccess(`✅ ${restockingProduct.name} restocked successfully!`);
      setTimeout(() => setSaleSuccess(null), 3000);

      // Refresh products list to get updated stock
      const productsRes = await fetch("/api/products");
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(Array.isArray(productsData) ? productsData : []);
        
        // Update current product if it's the one being restocked
        if (currentProduct && currentProduct.id === restockingProduct.id) {
          const updatedProduct = (Array.isArray(productsData) ? productsData : [])
            .find((p: Product) => p.id === restockingProduct.id);
          if (updatedProduct) {
            setCurrentProduct(updatedProduct);
          }
        }
      }

      // Close modal
      closeRestockModal();

    } catch (error: any) {
      console.error("Error restocking:", error);
      setRestockError(error.message || "Failed to restock product");
    } finally {
      setRestocking(false);
    }
  };

  const addItemToSale = () => {
    if (!currentProduct || currentQuantity <= 0) {
      setSaleError("Please select a product and enter quantity");
      setTimeout(() => setSaleError(null), 3000);
      return;
    }

    // Get the price - use entered price or fall back to product default
    let price = 0;
    if (currentPrice && currentPrice.trim() !== "") {
      price = parseFloat(currentPrice);
    } else if (currentProduct.price) {
      price = currentProduct.price;
    }
    
    if (isNaN(price) || price <= 0) {
      setSaleError("Please enter a valid price or ensure product has a default price");
      setTimeout(() => setSaleError(null), 3000);
      return;
    }

    const stock = getProductStock(currentProduct);
    const existingItem = saleItems.find(i => i.productId === currentProduct.id);
    const totalQuantity = (existingItem?.quantity || 0) + currentQuantity;

    if (totalQuantity > stock) {
      const errorMsg = `Insufficient stock for ${currentProduct.name}. Available: ${stock}, Requested: ${totalQuantity}`;
      setStockError(errorMsg);
      setSaleError(errorMsg);
      setTimeout(() => {
        setStockError(null);
        setSaleError(null);
      }, 5000);
      return;
    }
    
    if (existingItem) {
      setSaleItems(saleItems.map(item => 
        item.productId === currentProduct.id 
          ? { ...item, quantity: item.quantity + currentQuantity, price }
          : item
      ));
    } else {
      setSaleItems([...saleItems, {
        productId: currentProduct.id,
        productName: currentProduct.name,
        quantity: currentQuantity,
        price
      }]);
    }

    // Clear all product-related states
    setCurrentProduct(null);
    setCurrentQuantity(1);
    setCurrentPrice("");
    setProductSearch("");
    setShowProductDropdown(false);
    setSaleError(null);
    setStockError(null);
  };

  const removeItem = (productId: number) => {
    setSaleItems(saleItems.filter(i => i.productId !== productId));
  };

  const calculateTotalAmount = () => {
    return saleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  const calculateTotalPayments = () => {
    return payments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  };

  const getRemainingAmount = () => {
    return Math.max(0, calculateTotalAmount() - calculateTotalPayments());
  };

  const handleAddPayment = () => {
    const amount = parseFloat(currentPayment.amount);
    const remainingAmount = getRemainingAmount();
    
    // Validation for non-CREDIT payments
    if (currentPayment.method !== "CREDIT") {
      if (!currentPayment.amount || isNaN(amount) || amount <= 0) {
        setSaleError("Please enter a valid payment amount");
        setTimeout(() => setSaleError(null), 3000);
        return;
      }

      if (amount > remainingAmount + 0.01) { // Small buffer for floating point
        setSaleError(`Payment amount (KSh ${amount.toFixed(2)}) cannot exceed remaining balance of KSh ${remainingAmount.toFixed(2)}`);
        setTimeout(() => setSaleError(null), 3000);
        return;
      }
    }

    // Validation for CHECK payment
    if (currentPayment.method === "CHECK" && !currentPayment.checkDepositDate) {
      setSaleError("Please specify check deposit date for CHECK payments");
      setTimeout(() => setSaleError(null), 3000);
      return;
    }

    // Validation for CREDIT payment
    if (currentPayment.method === "CREDIT" && !currentPayment.dueDate) {
      setSaleError("Due date is MANDATORY for credit/pay later payments");
      setTimeout(() => setSaleError(null), 3000);
      return;
    }

    // Add the payment
    setPayments([
      ...payments,
      {
        amount: currentPayment.method === "CREDIT" ? "0" : currentPayment.amount,
        method: currentPayment.method,
        referenceId: currentPayment.referenceId?.trim() || "",
        checkDepositDate: currentPayment.checkDepositDate || "",
        dueDate: currentPayment.dueDate || "",
      },
    ]);

    // Reset the form
    setCurrentPayment({
      amount: "",
      method: "CASH",
      referenceId: "",
      checkDepositDate: "",
      dueDate: ""
    });
    setSaleError(null);
    
    // Show success message
    setSaleSuccess("Payment added successfully!");
    setTimeout(() => setSaleSuccess(null), 2000);
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handleCreateSale = async () => {
    if (!selectedCustomer) {
      setSaleError("Please select a customer");
      setTimeout(() => setSaleError(null), 3000);
      return;
    }

    if (saleItems.length === 0) {
      setSaleError("Please add at least one item to the sale");
      setTimeout(() => setSaleError(null), 3000);
      return;
    }

    const totalAmount = calculateTotalAmount();
    const totalPayments = calculateTotalPayments();
    const remainingAmount = totalAmount - totalPayments;

    if (remainingAmount > 0 && !dueDate) {
      setSaleError("Due date is MANDATORY when there's an outstanding balance");
      setTimeout(() => setSaleError(null), 3000);
      return;
    }

    setCreating(true);
    setSaleError(null);
    setSaleSuccess("Creating sale, please wait...");

    try {
      let status: "PAID" | "PARTIAL" | "UNPAID";
      if (remainingAmount <= 0.01) {
        status = "PAID";
      } else if (totalPayments > 0) {
        status = "PARTIAL";
      } else {
        status = "UNPAID";
      }

      const paymentsData = payments.length > 0
        ? payments.map(p => {
            const isCheck = p.method?.toUpperCase() === "CHECK";
            return {
              amount: Number(p.amount),
              method: p.method || "CASH",
              referenceId: p.referenceId?.trim() || null,
              checkDepositDate: p.checkDepositDate || null,
              date: new Date().toISOString(),
              status: isCheck ? "PENDING" : "COMPLETED",
            };
          })
        : [];

      const saleData = {
        customerId: selectedCustomer.id,
        amount: totalAmount,
        status,
        dueDate: dueDate || null,
        saleItems: saleItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
        payments: paymentsData,
      };

      console.log("Creating sale with data:", saleData);

      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saleData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create sale");
      }

      const result = await response.json();
      console.log("Sale created successfully:", result);

      setSaleSuccess("Sale created successfully! 🎉");
      
      // Reset form
      setSelectedCustomer(null);
      setCustomerSearch("");
      setSaleItems([]);
      setPayments([]);
      setCurrentProduct(null);
      setProductSearch("");
      setCurrentQuantity(1);
      setCurrentPrice("");
      setCurrentPayment({
        amount: "",
        method: "CASH",
        referenceId: "",
        checkDepositDate: "",
        dueDate: ""
      });
      setDueDate(new Date().toISOString().split('T')[0]);
      
      // Refresh dashboard data
      fetchDashboardData();
      
      setTimeout(() => {
        setSaleSuccess(null);
        setShowQuickSale(false);
      }, 2000);

    } catch (error: any) {
      console.error("Error creating sale:", error);
      setSaleError(error.message || "Failed to create sale");
    } finally {
      setCreating(false);
    }
  };

  const getNotificationStyles = (type: string) => {
    switch (type) {
      case "critical":
        return {
          bg: "bg-red-50",
          border: "border-red-200",
          text: "text-red-700",
          iconBg: "bg-red-100",
          iconColor: "text-red-600",
        };
      case "warning":
        return {
          bg: "bg-orange-50",
          border: "border-orange-200",
          text: "text-orange-700",
          iconBg: "bg-orange-100",
          iconColor: "text-orange-600",
        };
      case "success":
        return {
          bg: "bg-emerald-50",
          border: "border-emerald-200",
          text: "text-emerald-700",
          iconBg: "bg-emerald-100",
          iconColor: "text-emerald-600",
        };
      default:
        return {
          bg: "bg-blue-50",
          border: "border-blue-200",
          text: "text-blue-700",
          iconBg: "bg-blue-100",
          iconColor: "text-blue-600",
        };
    }
  };

  const notificationCount = useMemo(() => notifications.length, [notifications]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 truncate">
                SWIFT METALS <span className="text-blue-600">Admin</span>
              </h1>
              <p className="text-sm sm:text-base text-black mt-1">Your business at a glance</p>
            </div>

            <div className="flex items-center gap-3">
              {/* Quick Sale Button */}
              <button
                onClick={() => setShowQuickSale(true)}
                type="button"
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl font-medium"
              >
                <Zap className="w-5 h-5" />
                <span className="hidden sm:inline">Quick Sale</span>
                <span className="sm:hidden">Sale</span>
              </button>

              {/* Notification Button */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  type="button"
                  className="relative p-2.5 rounded-full bg-blue-100 hover:bg-blue-200 transition-colors"
                >
                  <Bell className="w-5 h-5 text-blue-700" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white bg-red-500 rounded-full">
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 md:hidden"
                      onClick={() => setShowNotifications(false)}
                    />
                    
                    <div className="fixed inset-x-4 top-20 md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-3 w-auto md:w-96 bg-white shadow-2xl rounded-xl border border-slate-200 z-50 max-h-[calc(100vh-6rem)] md:max-h-[600px] flex flex-col">
                      <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50 rounded-t-xl">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-black">Notifications</h3>
                          {notificationCount > 0 && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                              {notificationCount}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setShowNotifications(false)}
                          type="button"
                          className="text-slate-500 hover:text-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <Bell className="w-12 h-12 text-slate-400 mb-2" />
                          <p className="text-black">All caught up!</p>
                        </div>
                      ) : (
                        <ul className="overflow-y-auto flex-1">
                          {notifications.map((note) => {
                            const styles = getNotificationStyles(note.type);
                            const Icon = note.icon || Info;
                            
                            return (
                              <li key={note.id} className={`px-4 py-4 border-b ${styles.bg}`}>
                                <div className="flex gap-3">
                                  <div className={`${styles.iconBg} p-2 rounded-lg h-fit`}>
                                    <Icon className={`w-5 h-5 ${styles.iconColor}`} />
                                  </div>
                                  <div className="flex-1">
                                    <p className={`font-semibold text-sm ${styles.text}`}>{note.title}</p>
                                    <p className="text-sm text-black">{note.message}</p>
                                    {note.link && (
                                      <Link
                                        href={note.link}
                                        onClick={() => setShowNotifications(false)}
                                        className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                                      >
                                        View details →
                                      </Link>
                                    )}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Quick Sale Modal */}
      {showQuickSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap className="w-8 h-8" />
                  <div>
                    <h2 className="text-2xl font-bold">Quick Sale</h2>
                    <p className="text-blue-100 text-sm">Create sale in seconds</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowQuickSale(false);
                    setSaleError(null);
                    setSaleSuccess(null);
                    setStockError(null);
                  }}
                  type="button"
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {saleError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{saleError}</span>
                  </div>
                  <button onClick={() => setSaleError(null)} type="button" className="text-red-700 hover:text-red-900">
                    <X size={16} />
                  </button>
                </div>
              )}

              {saleSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{saleSuccess}</span>
                </div>
              )}

              {/* Customer Selection */}
              <div className="relative" ref={customerDropdownRef}>
                <label className="block text-sm font-semibold text-black mb-2">Customer *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-black" />
                  <input
                    type="text"
                    placeholder="Search customer by name or phone..."
                    value={selectedCustomer ? selectedCustomer.name : customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setSelectedCustomer(null);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-black rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-black placeholder-black"
                  />
                </div>

                {showCustomerDropdown && !selectedCustomer && filteredCustomers.length > 0 && (
                  <div className="absolute z-20 w-full mt-2 bg-white border-2 border-black rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {filteredCustomers.map(customer => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedCustomer(customer);
                          setCustomerSearch("");
                          setShowCustomerDropdown(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-black">{customer.name}</div>
                        {customer.phone && <div className="text-sm text-black">{customer.phone}</div>}
                      </button>
                    ))}
                  </div>
                )}

                {selectedCustomer && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-black">{selectedCustomer.name}</div>
                      {selectedCustomer.phone && <div className="text-sm text-black">{selectedCustomer.phone}</div>}
                    </div>
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  </div>
                )}
              </div>

              {/* Product Selection */}
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Add Products</label>
                <div className="space-y-3">
                  <div className="relative" ref={productDropdownRef}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-black pointer-events-none z-10" />
                    <input
                      type="text"
                      placeholder="Search product..."
                      value={currentProduct ? "" : productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setShowProductDropdown(true);
                      }}
                      onFocus={() => {
                        if (!currentProduct) {
                          setShowProductDropdown(true);
                        }
                      }}
                      disabled={!!currentProduct}
                      className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:bg-slate-100 disabled:cursor-not-allowed text-black placeholder-black"
                    />

                    {showProductDropdown && !currentProduct && filteredProducts.length > 0 && (
                      <div className="absolute z-20 w-full mt-2 bg-white border-2 border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {filteredProducts.map(product => {
                          const stock = getProductStock(product);
                          return (
                            <button
                              key={product.id}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setCurrentProduct(product);
                                setCurrentPrice(product.price?.toString() || "");
                                setProductSearch("");
                                setShowProductDropdown(false);
                                setStockError(null);
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-b-0 transition-colors"
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-medium text-black">{product.name}</div>
                                  <div className="text-sm text-black">
                                    Stock: {stock} | KSh {product.price?.toLocaleString() || 0}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {currentProduct && (
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                      {/* Stock Info and Restock Button - Always Visible */}
                      <div className={`mb-4 p-3 rounded-lg border-2 ${
                        isOutOfStock(currentProduct) 
                          ? 'bg-red-50 border-red-300' 
                          : isLowStock(currentProduct)
                          ? 'bg-orange-50 border-orange-300'
                          : 'bg-green-50 border-green-300'
                      }`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 flex-1">
                            {isOutOfStock(currentProduct) || isLowStock(currentProduct) ? (
                              <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                                isOutOfStock(currentProduct) ? 'text-red-600' : 'text-orange-600'
                              }`} />
                            ) : (
                              <Package className="w-5 h-5 mt-0.5 flex-shrink-0 text-green-600" />
                            )}
                            <div className="flex-1">
                              <p className={`font-semibold text-sm ${
                                isOutOfStock(currentProduct) 
                                  ? 'text-red-800' 
                                  : isLowStock(currentProduct)
                                  ? 'text-orange-800'
                                  : 'text-green-800'
                              }`}>
                                {isOutOfStock(currentProduct) 
                                  ? '⚠️ Product is OUT OF STOCK' 
                                  : isLowStock(currentProduct)
                                  ? '⚠️ Stock is LOW for this product'
                                  : '✓ Stock Available'}
                              </p>
                              <p className={`text-xs mt-0.5 ${
                                isOutOfStock(currentProduct) 
                                  ? 'text-red-700' 
                                  : isLowStock(currentProduct)
                                  ? 'text-orange-700'
                                  : 'text-green-700'
                              }`}>
                                Available: {getProductStock(currentProduct)} units
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => openRestockModal(currentProduct)}
                            type="button"
                            className={`px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-all hover:shadow-md flex items-center gap-1.5 whitespace-nowrap ${
                              isOutOfStock(currentProduct)
                                ? 'bg-red-600 hover:bg-red-700'
                                : isLowStock(currentProduct)
                                ? 'bg-orange-600 hover:bg-orange-700'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            <Package className="w-4 h-4" />
                            Restock
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <div className="font-semibold text-blue-900">{currentProduct.name}</div>
                          <div className="text-sm text-blue-700">
                            Available: {getProductStock(currentProduct)} | Price: KSh {currentProduct.price?.toLocaleString() || 0}
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setCurrentProduct(null);
                            setCurrentPrice("");
                            setCurrentQuantity(1);
                            setProductSearch("");
                          }}
                          type="button"
                          className="text-blue-600 hover:text-blue-800 p-1"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-semibold text-black mb-1">Quantity *</label>
                          <input
                            type="number"
                            min="1"
                            value={currentQuantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setCurrentQuantity(isNaN(val) || val < 1 ? 1 : val);
                            }}
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 text-black placeholder-black"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-black mb-1">Unit Price (KSh)</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={currentPrice}
                              onChange={(e) => setCurrentPrice(e.target.value)}
                              placeholder={currentProduct.price?.toString() || "0.00"}
                              className={`w-full px-3 py-2 border-2 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all ${
                                currentPrice === currentProduct.price?.toString() 
                                  ? 'text-gray-400 italic border-gray-300 bg-gray-50' 
                                  : 'text-black border-slate-200 bg-white'
                              }`}
                            />
                            {currentPrice === currentProduct.price?.toString() && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-orange-500 font-medium bg-orange-50 px-2 py-1 rounded">
                                Default
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="text-xs text-blue-600">
                              Default: KSh {currentProduct.price?.toLocaleString() || 0}
                            </div>
                            {currentPrice !== currentProduct.price?.toString() && currentPrice && (
                              <div className="text-xs text-green-600 font-medium">
                                ✓ Custom price
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {currentQuantity > 0 && currentProduct && (
                        <div className="bg-blue-100 text-blue-900 px-3 py-2 rounded-lg text-sm font-bold mb-3">
                          Subtotal: KSh {(currentQuantity * (currentPrice && currentPrice.trim() !== "" ? parseFloat(currentPrice) : (currentProduct.price || 0))).toLocaleString()}
                        </div>
                      )}
                      <button
                        onClick={addItemToSale}
                        type="button"
                        disabled={!currentProduct || currentQuantity <= 0}
                        className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <Plus className="w-5 h-5" />
                        Add to Sale
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Sale Items */}
              {saleItems.length > 0 && (
                <div className="border-2 border-slate-200 rounded-lg p-4 bg-slate-50">
                  <h3 className="font-semibold text-black mb-3 flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" />
                    Sale Items ({saleItems.length})
                  </h3>
                  <div className="space-y-2 mb-4">
                    {saleItems.map(item => (
                      <div key={item.productId} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
                        <div className="flex-1">
                          <div className="font-medium text-black">{item.productName}</div>
                          <div className="text-sm text-black">
                            {item.quantity} × KSh {item.price.toLocaleString()} = KSh {(item.quantity * item.price).toLocaleString()}
                          </div>
                        </div>
                        <button
                          onClick={() => removeItem(item.productId)}
                          type="button"
                          className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 border-t-2 border-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-black">Total Amount</span>
                      <span className="text-2xl font-bold text-blue-600">KSh {calculateTotalAmount().toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Details */}
              {saleItems.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-black flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                    Payment Details
                  </h3>
                  
                  <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-black mb-1">Payment Method *</label>
                        <select
                          value={currentPayment.method}
                          onChange={(e) => setCurrentPayment({
                            ...currentPayment,
                            method: e.target.value as any,
                            amount: e.target.value === "CREDIT" ? "0" : currentPayment.amount,
                          })}
                          className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 text-black"
                        >
                          {paymentMethods.map(method => (
                            <option key={method.value} value={method.value}>{method.label}</option>
                          ))}
                        </select>
                      </div>

                      {currentPayment.method !== "CREDIT" && (
                        <div>
                          <label className="block text-sm font-medium text-black mb-1">Amount (KSh) *</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            max={getRemainingAmount()}
                            value={currentPayment.amount}
                            onChange={(e) => setCurrentPayment({...currentPayment, amount: e.target.value})}
                            placeholder={getRemainingAmount().toFixed(2)}
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 text-black placeholder-black"
                          />
                          <div className="text-xs text-black mt-1">
                            Max: KSh {getRemainingAmount().toLocaleString()}
                          </div>
                        </div>
                      )}

                      {["MPESA", "BANK", "CARD"].includes(currentPayment.method) && (
                        <div>
                          <label className="block text-sm font-medium text-black mb-1">
                            Transaction Reference <span className="text-gray-500">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            value={currentPayment.referenceId}
                            onChange={(e) => setCurrentPayment({...currentPayment, referenceId: e.target.value})}
                            placeholder={
                              currentPayment.method === "MPESA" ? "e.g., QC12ABC345" :
                              currentPayment.method === "BANK" ? "e.g., TXN123456789" :
                              "e.g., AUTH987654"
                            }
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 text-black placeholder-black"
                          />
                        </div>
                      )}

                      {currentPayment.method === "CHECK" && (
                        <div>
                          <label className="block text-sm font-medium text-black mb-1">
                            Check Deposit Date * <span className="text-red-600">(Required)</span>
                          </label>
                          <input
                            type="date"
                            value={currentPayment.checkDepositDate}
                            onChange={(e) => setCurrentPayment({...currentPayment, checkDepositDate: e.target.value})}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 text-black"
                          />
                        </div>
                      )}

                      {(currentPayment.method === "CREDIT" || 
                        (currentPayment.amount && parseFloat(currentPayment.amount) < getRemainingAmount())) && (
                        <div>
                          <label className="block text-sm font-medium text-black mb-1">
                            Due Date * <span className="text-red-600">(Required)</span>
                          </label>
                          <input
                            type="date"
                            value={currentPayment.dueDate}
                            onChange={(e) => setCurrentPayment({...currentPayment, dueDate: e.target.value})}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 text-black"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleAddPayment}
                      type="button"
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                      Add Payment
                    </button>
                  </div>

                  {/* Payment List */}
                  {payments.length > 0 && (
                    <div className="border-2 border-slate-200 rounded-lg p-4 bg-white">
                      <h4 className="font-semibold text-black mb-3">Payments Added:</h4>
                      <div className="space-y-2 mb-3">
                        {payments.map((payment, index) => (
                          <div key={index} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  paymentMethods.find(m => m.value === payment.method)?.color
                                }`}>
                                  {payment.method}
                                </span>
                                {payment.referenceId && (
                                  <span className="text-xs text-black">Ref: {payment.referenceId}</span>
                                )}
                              </div>
                              <div className="text-sm font-semibold text-black">
                                KSh {Number(payment.amount || 0).toLocaleString()}
                              </div>
                              {payment.dueDate && (
                                <div className="text-xs text-orange-600">Due: {payment.dueDate}</div>
                              )}
                            </div>
                            <button
                              onClick={() => removePayment(index)}
                              type="button"
                              className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="pt-3 border-t-2 border-slate-200 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-black">Total Amount:</span>
                          <span className="font-semibold text-black">KSh {calculateTotalAmount().toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-black">Total Payments:</span>
                          <span className="font-semibold text-green-600">KSh {calculateTotalPayments().toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span className="font-bold text-black">Remaining Balance:</span>
                          <span className={`font-bold text-lg ${getRemainingAmount() > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            KSh {getRemainingAmount().toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Due Date for Outstanding Balance */}
                  {getRemainingAmount() > 0 && (
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                      <label className="block text-sm font-semibold text-black mb-2">
                        Payment Due Date * <span className="text-red-600">(MANDATORY for outstanding balance)</span>
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-3 border-2 border-yellow-300 rounded-lg focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t-2 border-slate-200">
                <button
                  onClick={() => {
                    setShowQuickSale(false);
                    setSaleError(null);
                    setSaleSuccess(null);
                    setStockError(null);
                  }}
                  type="button"
                  disabled={creating}
                  className="flex-1 px-6 py-3 border-2 border-slate-300 text-black rounded-lg hover:bg-slate-50 font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSale}
                  type="button"
                  disabled={creating || !selectedCustomer || saleItems.length === 0}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                >
                  {creating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Creating Sale...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Create Sale
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {showRestockModal && restockingProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="w-8 h-8" />
                  <div>
                    <h2 className="text-2xl font-bold">Restock Product</h2>
                    <p className="text-orange-100 text-sm">{restockingProduct.name}</p>
                  </div>
                </div>
                <button
                  onClick={closeRestockModal}
                  disabled={restocking}
                  type="button"
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {restockError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{restockError}</span>
                  </div>
                  <button onClick={() => setRestockError(null)} type="button" className="text-red-700 hover:text-red-900">
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Current Stock Info */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-700 font-medium">Current Stock</p>
                    <p className="text-2xl font-bold text-orange-900">{getProductStock(restockingProduct)} units</p>
                  </div>
                  <Package className="w-12 h-12 text-orange-300" />
                </div>
              </div>

              {/* Restock Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-black mb-2">
                    Quantity to Add *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={restockForm.quantity}
                    onChange={(e) => setRestockForm({
                      ...restockForm,
                      quantity: Math.max(1, parseInt(e.target.value) || 1)
                    })}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all text-black"
                    disabled={restocking}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-2">
                    Cost Price (KSh) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={restockForm.costPrice}
                    onChange={(e) => setRestockForm({...restockForm, costPrice: e.target.value})}
                    placeholder="Enter cost price"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all text-black placeholder-gray-400"
                    disabled={restocking}
                  />
                  {restockForm.costPrice && restockForm.quantity > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      Total Cost: KSh {(parseFloat(restockForm.costPrice || "0") * restockForm.quantity).toLocaleString()}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-2">
                    Payment Source *
                  </label>
                  <select
                    value={restockForm.paymentSource}
                    onChange={(e) => setRestockForm({
                      ...restockForm,
                      paymentSource: e.target.value as "cash" | "credit",
                      creditorName: e.target.value === "cash" ? "" : restockForm.creditorName
                    })}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all text-black"
                    disabled={restocking}
                  >
                    <option value="cash">Cash Payment</option>
                    <option value="credit">Credit/Pay Later</option>
                  </select>
                </div>

                {restockForm.paymentSource === "credit" && (
                  <div>
                    <label className="block text-sm font-semibold text-black mb-2">
                      Creditor Name * <span className="text-red-600">(Required)</span>
                    </label>
                    <input
                      type="text"
                      value={restockForm.creditorName}
                      onChange={(e) => setRestockForm({...restockForm, creditorName: e.target.value})}
                      placeholder="Enter creditor/supplier name"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all text-black placeholder-gray-400"
                      disabled={restocking}
                    />
                  </div>
                )}

                {/* New Stock Preview */}
                {restockForm.quantity > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-700 font-medium mb-1">After Restock:</p>
                    <p className="text-2xl font-bold text-green-900">
                      {getProductStock(restockingProduct) + restockForm.quantity} units
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={closeRestockModal}
                  disabled={restocking}
                  type="button"
                  className="flex-1 px-6 py-3 border-2 border-slate-300 text-black rounded-lg hover:bg-slate-50 font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestockSubmit}
                  disabled={restocking}
                  type="button"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg hover:from-orange-700 hover:to-orange-800 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                >
                  {restocking ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Restocking...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Restock Product
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-4 sm:mb-6">
          Quick Overview
        </h2>
        
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 animate-pulse">
                <div className="h-12 bg-slate-200 rounded mb-3"></div>
                <div className="h-6 bg-slate-200 rounded mb-2"></div>
                <div className="h-4 bg-slate-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {quickStats.map((stat) => (
              <div
                key={stat.title}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div
                    className={`p-2 sm:p-3 rounded-lg ${
                      stat.positive ? "bg-emerald-100" : "bg-orange-100"
                    }`}
                  >
                    <stat.icon
                      className={`w-5 h-5 sm:w-6 sm:h-6 ${
                        stat.positive ? "text-emerald-600" : "text-orange-600"
                      }`}
                    />
                  </div>
                  <span
                    className={`text-xs sm:text-sm font-medium px-2 py-1 rounded-full whitespace-nowrap ${
                      stat.positive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {stat.change}
                  </span>
                </div>
                <div className="text-lg sm:text-2xl font-bold text-slate-900 mb-1 truncate">
                  {stat.value}
                </div>
                <div className="text-black text-xs sm:text-sm">{stat.title}</div>
              </div>
            ))}
          </div>
        )}

        {/* Admin Sections */}
        <div className="mt-8 sm:mt-12">
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-4 sm:mb-6">
            Management Sections
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {adminSections.map((section) => (
              <Link
                key={section.title}
                href={section.href}
                className="group bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 hover:shadow-lg hover:scale-105 transition-all"
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className={`p-2 sm:p-3 rounded-lg ${section.color}`}>
                    <section.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-slate-600 transition" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-2 group-hover:text-blue-600 truncate">
                  {section.title}
                </h3>
                <p className="text-xs sm:text-sm text-black mb-3 sm:mb-4 line-clamp-2">
                  {section.description}
                </p>
                <div className="text-xs font-medium text-black bg-slate-50 rounded-full px-2 sm:px-3 py-1 inline-block truncate max-w-full">
                  {section.stats}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}