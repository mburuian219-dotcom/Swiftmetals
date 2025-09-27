"use client";
import React, { useEffect, useState } from "react";
import { MessageSquare, Send, Clock, CreditCard, AlertTriangle, CheckCircle, Plus, X, Edit, Trash2, Calculator, Save } from "lucide-react";

interface Customer {
  id: number;
  name: string;
  phone?: string;
}

interface Product {
  id: number;
  name: string;
  price?: number;
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
  method: "CASH" | "MPESA" | "BANK" | "CHECK" | "CARD";
  date: string;
  referenceId?: string | null;
  checkDepositDate?: string | null;
  status?: "PENDING" | "COMPLETED" | "BOUNCED";
}

interface NewPayment {
  id?: number;
  amount: string;
  method: "CASH" | "MPESA" | "BANK" | "CHECK" | "CARD";
  referenceId?: string;
  checkDepositDate?: string;
  checkNumber?: string;
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
  paymentMethod?: "CASH" | "MPESA" | "BANK" | "CHECK" | "CARD" | "MULTIPLE";
  checkDepositDate?: string | null;
}

interface NewSaleItem {
  productId: number;
  quantity: number;
  price: number;
  productName: string;
}

const EnhancedSalesPage = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const fetchSales = async () => {
    const res = await fetch("/api/sales");
    const data = await res.json();
    setSales(data);
  };

  useEffect(() => {
    fetchSales();
  }, []);

  // New Sale State
  const [showAddSale, setShowAddSale] = useState(false);
  const [newSale, setNewSale] = useState({
    customerId: "",
    dueDate: new Date().toISOString().split('T')[0],
  });
  
  const [saleItems, setSaleItems] = useState<NewSaleItem[]>([]);
  const [currentItem, setCurrentItem] = useState<NewSaleItem>({
    productId: 0,
    quantity: 1,
    price: 0,
    productName: ""
  });
  
  // Payment State
  const [payments, setPayments] = useState<NewPayment[]>([]);
  const [currentPayment, setCurrentPayment] = useState<NewPayment>({
    amount: "",
    method: "CASH",
    referenceId: "",
    checkDepositDate: ""
  });
  
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editPayments, setEditPayments] = useState<NewPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"messaging" | "overview" | "paid" | "partial" | "unpaid">("messaging");
  
  // SMS messaging state
  const [messagingStats, setMessagingStats] = useState({
    overdue: { count: 0, totalAmount: 0, sales: [] },
    dueToday: { count: 0, totalAmount: 0, sales: [] },
    dueTomorrow: { count: 0, totalAmount: 0, sales: [] },
    depositsToday: { count: 0, totalAmount: 0, sales: [] },
    depositsTomorrow: { count: 0, totalAmount: 0, sales: [] },
    depositsThisWeek: { count: 0, totalAmount: 0, sales: [] }
  });
  const [selectedSales, setSelectedSales] = useState<number[]>([]);
  const [messagingLoading, setMessagingLoading] = useState(false);

  // Format phone number to international format
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return phone;
    
    const cleanPhone = phone.replace(/\D/g, "");
    
    // Convert 07XXXXXXXX to 2547XXXXXXXX
    if (cleanPhone.startsWith("07")) {
      return "254" + cleanPhone.substring(1);
    }
    
    // Convert 7XXXXXXXX to 2547XXXXXXXX
    if (cleanPhone.startsWith("7") && cleanPhone.length === 9) {
      return "254" + cleanPhone;
    }
    
    return cleanPhone;
  };

  // Message type options for manual messaging
  const messageTypes = [
    { 
      value: "delivery", 
      label: "Delivery Confirmation",
      getTemplate: (sale: Sale) => `Hi ${sale.customer.name}, thank you for your purchase of ${
        sale.saleitems?.map(item => `${item.product?.name || "Product"} (×${item.quantity})`).join(", ") || "your recent purchase"
      }. Your order has been confirmed for delivery.`
    },
    { 
      value: "payment", 
      label: "Payment Reminder",
      getTemplate: (sale: Sale) => `Hi ${sale.customer.name}, you have an outstanding balance of Ksh ${sale.remainingAmount.toFixed(2)} for ${
        sale.saleitems?.map(item => item.product?.name || "Product").join(", ") || "your order"
      }. ${sale.dueDate && sale.status !== "PAID" ? `Payment is due on ${new Date(sale.dueDate).toLocaleDateString()}.` : ""} Please clear your balance at your earliest convenience.`
    },
    { 
      value: "check", 
      label: "Check Deposit Reminder",
      getTemplate: (sale: Sale) => `Hi ${sale.customer.name}, this is a reminder that your check payment for ${
        sale.saleitems?.map(item => item.product?.name || "Product").join(", ") || "your order"
      } is scheduled for deposit. Please ensure sufficient funds are available in your account.`
    }
  ];

  const [selectedMessageType, setSelectedMessageType] = useState("delivery");

  // Fixed function to calculate status and remaining amount correctly
  const calculateSaleStatus = (sale: any): Sale => {
    const totalPayments = sale.payments && sale.payments.length > 0
      ? sale.payments.reduce((sum: number, p: Payment) => sum + Number(p.amount || 0), 0)
      : 0;
    
    const remainingAmount = Math.max(0, Number(sale.amount) - totalPayments);
    
    const hasPendingChecks = sale.payments?.some((p: Payment) => {
      if (p.method !== "CHECK") return false;
      
      const today = new Date().toISOString().split('T')[0];
      const hasDepositDate = p.checkDepositDate;
      const isDepositDateFuture = hasDepositDate && p.checkDepositDate! > today;
      const isPendingStatus = p.status === "PENDING";
      
      return !hasDepositDate || isDepositDateFuture || isPendingStatus;
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

    return {
      ...sale,
      remainingAmount,
      status,
      payments: sale.payments || []
    };
  };

  // Fetch all data from database
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [salesRes, customersRes, productsRes] = await Promise.all([
          fetch("/api/sales"),
          fetch("/api/customer"),
          fetch("/api/products")
        ]);

        if (!salesRes.ok || !customersRes.ok || !productsRes.ok) {
          throw new Error("Failed to fetch data");
        }

        const [salesData, customersData, productsData] = await Promise.all([
          salesRes.json(),
          customersRes.json(),
          productsRes.json()
        ]);

        const processedSales = salesData.map(calculateSaleStatus);

        setSales(processedSales);
        setCustomers(customersData);
        setProducts(productsData);
      } catch (err) {
        setError("Failed to load data from database");
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Payment method options
  const paymentMethods = [
    { value: "CASH", label: "Cash", color: "bg-green-100 text-green-800" },
    { value: "MPESA", label: "M-Pesa", color: "bg-blue-100 text-blue-800" },
    { value: "BANK", label: "Bank Transfer", color: "bg-purple-100 text-purple-800" },
    { value: "CHECK", label: "Check", color: "bg-orange-100 text-orange-800" },
    { value: "CARD", label: "Card Payment", color: "bg-pink-100 text-pink-800" }
  ];

  // Add item to sale
  const handleAddItemToSale = () => {
    if (!currentItem.productId || currentItem.quantity <= 0 || currentItem.price <= 0) {
      setError("Please fill in all item details");
      return;
    }

    const product = products.find(p => p.id === currentItem.productId);
    if (!product) {
      setError("Product not found");
      return;
    }

    const existingItemIndex = saleItems.findIndex(item => item.productId === currentItem.productId);
    
    if (existingItemIndex >= 0) {
      const updatedItems = [...saleItems];
      updatedItems[existingItemIndex].quantity += currentItem.quantity;
      setSaleItems(updatedItems);
    } else {
      setSaleItems([...saleItems, { ...currentItem, productName: product.name }]);
    }

    setCurrentItem({
      productId: 0,
      quantity: 1,
      price: 0,
      productName: ""
    });
    setProductSearch("");
    setError(null);
  };

  const handleAddPayment = () => {
    const amount = parseFloat(currentPayment.amount);
    const remainingAmount = getRemainingAmount();
    
    if (!amount || amount <= 0) {
      setError("Please enter a valid payment amount");
      return;
    }

    // Check if payment exceeds remaining amount
    if (amount > remainingAmount) {
      setError(`Payment amount cannot exceed remaining balance of Ksh ${remainingAmount.toFixed(2)}`);
      return;
    }

    if (currentPayment.method === "CHECK" && !currentPayment.checkDepositDate) {
      setError("Please specify check deposit date");
      return;
    }

    if (
      ["MPESA", "BANK", "CARD"].includes(currentPayment.method) &&
      !currentPayment.referenceId
    ) {
      setError("Please enter transaction reference");
      return;
    }

    setPayments([
      ...payments,
      {
        ...currentPayment,
        amount: currentPayment.amount,
        referenceId: currentPayment.referenceId || "",
        checkDepositDate: currentPayment.checkDepositDate || "",
      },
    ]);

    setCurrentPayment({
      amount: "",
      method: "CASH",
      referenceId: "",
      checkDepositDate: "",
    });
    setError(null);
  };

  // Remove payment
  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  // Calculate totals with proper number handling
  const calculateTotalAmount = () => {
    return saleItems.reduce((total, item) => total + (Number(item.quantity) * Number(item.price)), 0);
  };

  const calculateTotalPayments = () => {
    return payments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  };

  const getRemainingAmount = () => {
    return Math.max(0, calculateTotalAmount() - calculateTotalPayments());
  };

  // Handle new sale submission
  const handleCreateSale = async () => {
    if (saleItems.length === 0) {
      setError("Please add at least one item to the sale");
      return;
    }

    if (!newSale.customerId) {
      setError("Please select a customer");
      return;
    }

    setLoading(true);
    try {
      const totalAmount = calculateTotalAmount();
      const totalPayments = calculateTotalPayments();
      const remainingAmount = totalAmount - totalPayments;

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
              checkNumber: p.checkNumber?.trim() || null,
              bankName: p.bankName?.trim() || null,
              checkDate: p.checkDate || null,
              date: new Date().toISOString(),
              status: isCheck ? "PENDING" : "COMPLETED",
            };
          })
        : [];

      const saleData = {
        customerId: parseInt(newSale.customerId),
        amount: totalAmount,
        status,
        dueDate: newSale.dueDate || null,
        saleItems: saleItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
        payments: paymentsData,
      };

      const response = await fetch("/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(saleData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create sale");
      }

      const createdSale = await response.json();
      const processedSale = calculateSaleStatus(createdSale);
      setSales([processedSale, ...sales]);

      // Reset form
      setShowAddSale(false);
      setSaleItems([]);
      setPayments([]);
      setNewSale({
        customerId: "",
        dueDate: new Date().toISOString().split("T")[0],
      });
      setSuccess("Sale created successfully!");

      // Refresh data from database
      const salesRes = await fetch("/api/sales");
      if (salesRes.ok) {
        const updatedSales = await salesRes.json();
        const processedSales = updatedSales.map(calculateSaleStatus);
        setSales(processedSales);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create sale");
      console.error("Error creating sale:", err);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle edit sale
  const handleEditSale = (sale: Sale) => {
    setEditingSale(sale);
    setEditPayments(sale.payments.map(p => ({
      id: p.id,
      amount: p.amount.toString(),
      method: p.method,
      referenceId: p.referenceId || "",
      checkDepositDate: p.checkDepositDate || ""
    })));
  };

  // Fixed handleUpdateSale function
  const handleUpdateSale = async () => {
    if (!editingSale) return;

    setLoading(true);
    try {
      const newPayment = editPayments[editPayments.length - 1];

      if (!newPayment || !newPayment.amount) {
        setError("Please enter a valid payment before updating.");
        setLoading(false);
        return;
      }

      // Check if payment exceeds remaining amount
      const paymentAmount = Number(newPayment.amount);
      if (paymentAmount > editingSale.remainingAmount) {
        setError(`Payment amount cannot exceed remaining balance of Ksh ${editingSale.remainingAmount.toFixed(2)}`);
        setLoading(false);
        return;
      }

      const updateData = {
        payment: {
          amount: paymentAmount,
          method: newPayment.method,
          referenceId: newPayment.referenceId?.trim() || null,
          checkDepositDate: newPayment.checkDepositDate || null,
          date: new Date().toISOString(),
        },
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

      // Update the sales list immediately
      setSales(prevSales => 
        prevSales.map(s => s.id === processedSale.id ? processedSale : s)
      );

      // Update the editing modal with fresh data
      setEditingSale(processedSale);
      
      // Update editPayments to show all payments
      setEditPayments(
        processedSale.payments.map((p: Payment) => ({
          id: p.id,
          amount: p.amount.toString(),
          method: p.method,
          referenceId: p.referenceId || "",
          checkDepositDate: p.checkDepositDate || ""
        }))
      );

      // Reset current payment input
      setCurrentPayment({
        amount: "",
        method: "CASH",
        referenceId: "",
        checkDepositDate: ""
      });

      setSuccess("Sale updated successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to update sale");
      console.error("Error updating sale:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayment = async (paymentId: number, saleId: number) => {
    try {
      const response = await fetch(`/api/payments/${paymentId}?saleId=${saleId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to delete payment");
      }

      const updatedSale = await response.json();
      const processedSale = calculateSaleStatus(updatedSale);

      setSales(sales.map(s => s.id === processedSale.id ? processedSale : s));
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

      setSuccess("Payment deleted successfully!");
    } catch (error: any) {
      console.error("Error deleting payment:", error);
      setError(error.message || "Failed to delete payment");
    }
  };

  const addEditPayment = () => {
    const amount = parseFloat(currentPayment.amount);
    if (!amount || amount <= 0) {
      setError("Please enter a valid payment amount");
      return;
    }

    // Check if payment exceeds remaining amount for edit mode
    if (editingSale && amount > editingSale.remainingAmount) {
      setError(`Payment amount cannot exceed remaining balance of Ksh ${editingSale.remainingAmount.toFixed(2)}`);
      return;
    }

    setEditPayments([...editPayments, {
      ...currentPayment,
      amount: currentPayment.amount
    }]);

    setCurrentPayment({
      amount: "",
      method: "CASH",
      referenceId: "",
      checkDepositDate: ""
    });
    setError(null);
  };

  // Clear messages
  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // Calculate dashboard totals
  const totalSales = sales.reduce((acc, s) => acc + Number(s.amount), 0);
  const paidSales = sales.filter((s) => s.status === "PAID").reduce((acc, s) => acc + Number(s.amount), 0);
  const partialSales = sales.filter((s) => s.status === "PARTIAL").reduce((acc, s) => acc + Number(s.amount), 0);
  const unpaidSales = sales.filter((s) => s.status === "UNPAID").reduce((acc, s) => acc + Number(s.amount), 0);
  const totalOutstanding = sales.reduce((acc, s) => acc + Number(s.remainingAmount), 0);

  // Filter sales based on active tab
  const getFilteredSales = () => {
    switch (activeTab) {
      case "paid":
        return sales.filter(s => s.status === "PAID");
      case "partial":
        return sales.filter(s => s.status === "PARTIAL");
      case "unpaid":
        return sales.filter(s => s.status === "UNPAID");
      case "overview":
        return sales;
      default:
        return sales;
    }
  };

  // SMS messaging functions
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
        setSuccess(`✅ Delivery confirmation SMS sent to ${data.customer}`);
      } else if (data.blacklist) {
        alert("⚠️ Customer is in blacklist. Opening manual messaging…");
        const phoneDigits = formatPhoneNumber(data.phone);
        const manualMsg = encodeURIComponent(
          `Hi ${data.customer}, your delivery for ${data.product || "your order"} has been confirmed.`
        );

        if (confirm("Send via WhatsApp instead?")) {
          window.open(`https://wa.me/${phoneDigits}?text=${manualMsg}`, "_blank");
        } else {
          window.open(`sms:${phoneDigits}?body=${manualMsg}`, "_blank");
        }
      } else {
        setError(data.error || "❌ Failed to send delivery confirmation SMS");
      }
    } catch (err) {
      setError("❌ Failed to send delivery confirmation SMS");
    } finally {
      setMessagingLoading(false);
    }
  };

  const sendPaymentReminder = async () => {
    setMessagingLoading(true);
    try {
      const res = await fetch("/api/sms/get-overdue-payments", {
        method: "GET",
      });

      const data = await res.json();

      if (res.ok && !data.blacklist) {
        setSuccess(data.message || "✅ Payment reminders sent");
        setSelectedSales([]);
        return data;
      } else if (data.blacklist) {
        alert("⚠️ Customer is in blacklist. Opening manual messaging…");
        const phoneDigits = formatPhoneNumber(data.phone);
        const manualMsg = encodeURIComponent(
          `Hi ${data.customer}, you have an overdue payment of Ksh ${data.amount}. Please clear your balance for ${data.product || "your order"}.`
        );

        if (confirm("Send via WhatsApp instead?")) {
          window.open(`https://wa.me/${phoneDigits}?text=${manualMsg}`, "_blank");
        } else {
          window.open(`sms:${phoneDigits}?body=${manualMsg}`, "_blank");
        }
      } else {
        setError(data.error || "❌ Failed to send payment reminders");
        throw new Error(data.error || "Failed to send payment reminders");
      }
    } catch (err) {
      setError("❌ Failed to send payment reminders");
      throw err;
    } finally {
      setMessagingLoading(false);
    }
  };

  const sendCheckDepositNotification = async (saleIds: number | number[]) => {
    setMessagingLoading(true);
    try {
      const body = Array.isArray(saleIds) 
        ? { saleIds } 
        : { saleId: saleIds };

      const res = await fetch("/api/sms/get-check-deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        if (Array.isArray(saleIds)) {
          setSuccess(`Check deposit notification SMS sent: ${data.summary.success} successful, ${data.summary.failed} failed`);
        } else {
          setSuccess(`Check deposit notification SMS sent to ${data.customer}`);
        }
        setSelectedSales([]);
      } else {
        setError(data.error || "Failed to send check deposit notification SMS");
      }
    } catch (err) {
      setError("Failed to send check deposit notification SMS");
    } finally {
      setMessagingLoading(false);
    }
  };

  if (loading && sales.length === 0) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="text-center text-black">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-black">Sales Management Dashboard</h1>
        <button
          onClick={() => setShowAddSale(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 flex items-center gap-2 shadow-lg"
        >
          <Plus size={20} />
          New Sale
        </button>
      </div>

      {/* Success/Error Messages */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
          <button onClick={clearMessages} className="float-right font-bold text-red-700">×</button>
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
          <button onClick={clearMessages} className="float-right font-bold text-green-700">×</button>
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-emerald-500">
          <div className="text-slate-500 text-sm font-medium">Total Sales</div>
          <div className="text-2xl font-bold text-emerald-600">Ksh {totalSales.toFixed(2)}</div>
          <div className="text-sm text-black">{sales.length} orders</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
          <div className="text-slate-500 text-sm font-medium">Fully Paid</div>
          <div className="text-2xl font-bold text-blue-600">Ksh {paidSales.toFixed(2)}</div>
          <div className="text-sm text-black">{sales.filter(s => s.status === "PAID").length} orders</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-orange-500">
          <div className="text-slate-500 text-sm font-medium">Partially Paid</div>
          <div className="text-2xl font-bold text-orange-600">Ksh {partialSales.toFixed(2)}</div>
          <div className="text-sm text-black">{sales.filter(s => s.status === "PARTIAL").length} orders</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-red-500">
          <div className="text-slate-500 text-sm font-medium">Unpaid</div>
          <div className="text-2xl font-bold text-red-600">Ksh {unpaidSales.toFixed(2)}</div>
          <div className="text-sm text-black">{sales.filter(s => s.status === "UNPAID").length} orders</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-purple-500">
          <div className="text-slate-500 text-sm font-medium">Outstanding Amount</div>
          <div className="text-2xl font-bold text-purple-600">Ksh {totalOutstanding.toFixed(2)}</div>
          <div className="text-sm text-black">Total remaining</div>
        </div>
      </div>

      {/* Add Sale Modal */}
      {showAddSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-black">Create New Sale</h2>
                <button
                  onClick={() => setShowAddSale(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer Selection */}
              <div>
                <label className="block text-sm font-medium text-black mb-2">Customer</label>
                <select
                  value={newSale.customerId}
                  onChange={(e) => setNewSale({...newSale, customerId: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                >
                  <option value="">Select a customer</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} {customer.phone && `(${customer.phone})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-black mb-2">Date</label>
                <input
                  type="date"
                  value={newSale.dueDate}
                  onChange={(e) => setNewSale({...newSale, dueDate: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>

              {/* Sale Items */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-black">Sale Items</h3>
                
                {/* Add Item Form */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">Product</label>
                    <select
                      value={currentItem.productId}
                      onChange={(e) => {
                        const productId = parseInt(e.target.value);
                        const product = products.find(p => p.id === productId);
                        setCurrentItem({
                          ...currentItem,
                          productId,
                          price: product?.price || 0,
                          productName: product?.name || ""
                        });
                      }}
                      className="w-full p-2 border border-gray-300 rounded text-black"
                    >
                      <option value={0}>Select product</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} (Ksh {product.price})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={currentItem.quantity}
                      onChange={(e) => setCurrentItem({...currentItem, quantity: parseInt(e.target.value) || 1})}
                      className="w-full p-2 border border-gray-300 rounded text-black"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">Unit Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={currentItem.price}
                      onChange={(e) => setCurrentItem({...currentItem, price: parseFloat(e.target.value) || 0})}
                      className="w-full p-2 border border-gray-300 rounded text-black"
                    />
                  </div>
                  
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddItemToSale}
                      className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center justify-center gap-2"
                    >
                      <Plus size={16} />
                      Add Item
                    </button>
                  </div>
                </div>

                {/* Items List */}
                {saleItems.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {saleItems.map((item, index) => (
                      <div key={index} className="flex justify-between items-center bg-white p-3 rounded-lg border">
                        <div>
                          <span className="font-medium text-black">{item.productName}</span>
                          <span className="text-black ml-2">×{item.quantity} @ Ksh {item.price}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-green-600">Ksh {(item.quantity * item.price).toFixed(2)}</span>
                          <button
                            onClick={() => setSaleItems(saleItems.filter((_, i) => i !== index))}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payments Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-black">Payments</h3>
                
                {/* Add Payment Form */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      max={getRemainingAmount()}
                      value={currentPayment.amount}
                      onChange={(e) => setCurrentPayment({...currentPayment, amount: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded text-black"
                      placeholder="0.00"
                    />
                    <div className="text-xs text-gray-600 mt-1">
                      Max: Ksh {getRemainingAmount().toFixed(2)}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">Method</label>
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
                    <label className="block text-sm font-medium text-black mb-1">Reference</label>
                    <input
                      type="text"
                      value={currentPayment.referenceId}
                      onChange={(e) => setCurrentPayment({...currentPayment, referenceId: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded text-black"
                      placeholder="Transaction ID"
                    />
                  </div>
                  
                  {currentPayment.method === "CHECK" && (
                    <div>
                      <label className="block text-sm font-medium text-black mb-1">Deposit Date</label>
                      <input
                        type="date"
                        value={currentPayment.checkDepositDate}
                        onChange={(e) => setCurrentPayment({...currentPayment, checkDepositDate: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded text-black"
                      />
                    </div>
                  )}
                  
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddPayment}
                      className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center justify-center gap-2"
                    >
                      <Plus size={16} />
                      Add Payment
                    </button>
                  </div>
                </div>

                {/* Payments List */}
                {payments.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {payments.map((payment, index) => (
                      <div key={index} className="flex justify-between items-center bg-white p-3 rounded-lg border">
                        <div className="flex items-center gap-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            paymentMethods.find(m => m.value === payment.method)?.color
                          }`}>
                            {payment.method}
                          </span>
                          <span className="font-medium text-black">Ksh {parseFloat(payment.amount).toFixed(2)}</span>
                          {payment.referenceId && (
                            <span className="text-black text-sm">Ref: {payment.referenceId}</span>
                          )}
                        </div>
                        <button
                          onClick={() => removePayment(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Payment Summary */}
                {saleItems.length > 0 && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-black">Total Sale Amount:</span>
                      <span className="font-bold text-blue-600">Ksh {calculateTotalAmount().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-black">Total Payments:</span>
                      <span className="font-bold text-green-600">Ksh {calculateTotalPayments().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="font-medium text-black">Remaining Amount:</span>
                      <span className={`font-bold ${getRemainingAmount() > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        Ksh {getRemainingAmount().toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6 border-t">
                <button
                  onClick={() => setShowAddSale(false)}
                  className="flex-1 bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSale}
                  disabled={saleItems.length === 0 || !newSale.customerId}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
  
      {/* Edit Sale Modal */}
      {editingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-black">Edit Sale #{editingSale.id}</h2>
                <button
                  onClick={() => setEditingSale(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Sale Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2 text-black">Sale Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-black">Customer:</span>
                    <span className="font-medium ml-2 text-black">{editingSale.customer.name}</span>
                  </div>
                  <div>
                    <span className="text-black">Total Amount:</span>
                    <span className="font-medium ml-2 text-black">Ksh {editingSale.amount.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-black">Date:</span>
                    <span className="font-medium ml-2 text-black">{new Date(editingSale.date).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-black">Status:</span>
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

              {/* Sale Items */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-black">Sale Items</h3>
                <div className="space-y-2">
                  {editingSale.saleitems?.map((item, index) => (
                    <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                      <div>
                        <span className="font-medium text-black">{item.product.name}</span>
                        <span className="text-black ml-2">×{item.quantity} @ Ksh {item.price}</span>
                      </div>
                      <span className="font-bold text-green-600">Ksh {(item.quantity * item.price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Edit Payments */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-black">Payments</h3>
                
                {/* Current Payments */}
                {editPayments.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <h4 className="font-medium text-black">Current Payments:</h4>
                    {editPayments.map((payment, index) => (
                      <div key={index} className="flex justify-between items-center bg-white p-3 rounded-lg border">
                        <div className="flex items-center gap-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            paymentMethods.find(m => m.value === payment.method)?.color
                          }`}>
                            {payment.method}
                          </span>
                          <span className="font-medium text-black">Ksh {parseFloat(payment.amount).toFixed(2)}</span>
                          {payment.referenceId && (
                            <span className="text-black text-sm">Ref: {payment.referenceId}</span>
                          )}
                        </div>
                        {payment.id !== undefined && (
                          <button
                            onClick={() => handleDeletePayment(payment.id as number, editingSale.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Payment */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      max={editingSale.remainingAmount}
                      value={currentPayment.amount}
                      onChange={(e) => setCurrentPayment({...currentPayment, amount: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded text-black"
                      placeholder="0.00"
                    />
                    <div className="text-xs text-gray-600 mt-1">
                      Max: Ksh {editingSale.remainingAmount.toFixed(2)}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">Method</label>
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
                    <label className="block text-sm font-medium text-black mb-1">Reference</label>
                    <input
                      type="text"
                      value={currentPayment.referenceId}
                      onChange={(e) => setCurrentPayment({...currentPayment, referenceId: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded text-black"
                      placeholder="Transaction ID"
                    />
                  </div>
                  
                  {currentPayment.method === "CHECK" && (
                    <div>
                      <label className="block text-sm font-medium text-black mb-1">Deposit Date</label>
                      <input
                        type="date"
                        value={currentPayment.checkDepositDate}
                        onChange={(e) => setCurrentPayment({...currentPayment, checkDepositDate: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded text-black"
                      />
                    </div>
                  )}
                  
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={addEditPayment}
                      className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center justify-center gap-2"
                    >
                      <Plus size={16} />
                      Add Payment
                    </button>
                  </div>
                </div>

                {/* Payment Summary for Edit */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-black">Total Sale Amount:</span>
                    <span className="font-bold text-blue-600">Ksh {editingSale.amount.toFixed(2)}</span>
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
                      (editingSale.amount - editPayments.reduce((sum, p) => sum + Number(p.amount), 0)) > 0 
                        ? 'text-red-600' : 'text-green-600'
                    }`}>
                      Ksh {Math.max(0, editingSale.amount - editPayments.reduce((sum, p) => sum + Number(p.amount), 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6 border-t">
                <button
                  onClick={() => setEditingSale(null)}
                  className="flex-1 bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateSale}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  Update Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white rounded-xl shadow mb-6">
        <div className="flex border-b">
          {[
            { key: "messaging", label: "SMS Messaging", count: 0 },
            { key: "overview", label: "All Sales", count: sales.length },
            { key: "paid", label: "Fully Paid", count: sales.filter(s => s.status === "PAID").length },
            { key: "partial", label: "Partially Paid", count: sales.filter(s => s.status === "PARTIAL").length },
            { key: "unpaid", label: "Unpaid", count: sales.filter(s => s.status === "UNPAID").length }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 px-4 py-3 text-center transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-blue-500 text-blue-600 font-semibold"
                  : "text-black hover:text-gray-800"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                {tab.key === "messaging" && <MessageSquare size={16} />}
                {tab.key === "partial" && <Calculator size={16} />}
                {tab.label} ({tab.count})
              </div>
            </button>
          ))}
        </div>

        {/* SMS Messaging Tab Content */}
        {activeTab === "messaging" && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Payment Reminders Section */}
              <div className="bg-red-50 p-6 rounded-xl border border-red-200">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="text-red-600" size={20} />
                  <h3 className="text-lg font-semibold text-red-800">SMS Payment Reminders</h3>
                </div>
                
                <div className="space-y-3 mb-4">
                  <div className="bg-white p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-black">Overdue Payments</span>
                      <span className="font-bold text-red-600">
                        {sales.filter(s => s.status !== "PAID" && s.dueDate && new Date(s.dueDate) < new Date()).length}
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-black">Partial Payments</span>
                      <span className="font-bold text-orange-600">
                        {sales.filter(s => s.status === "PARTIAL").length}
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-black">Unpaid Orders</span>
                      <span className="font-bold text-red-600">
                        {sales.filter(s => s.status === "UNPAID").length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={sendPaymentReminder}
                    disabled={messagingLoading}
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Send size={16} />
                    Send SMS Payment Reminders
                  </button>
                </div>
              </div>
                
              {/* Check Deposits */}
              <div className="bg-orange-50 p-6 rounded-xl border border-orange-200">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="text-orange-600" size={20} />
                  <h3 className="text-lg font-semibold text-orange-800">Check Deposit SMS</h3>
                </div>
                
                <div className="space-y-3 mb-4">
                  <div className="bg-white p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-black">Pending Check Deposits</span>
                      <span className="font-bold text-orange-600">
                        {sales.filter(s => s.paymentMethod === "CHECK" || 
                          s.payments?.some(p => p.method === "CHECK")).length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => {
                      const checkSales = sales.filter(s => 
                        s.paymentMethod === "CHECK" || s.payments?.some(p => p.method === "CHECK")
                      ).map(s => s.id);
                      if (checkSales.length > 0) {
                        sendCheckDepositNotification(checkSales);
                      }
                    }}
                    disabled={messagingLoading || sales.filter(s => 
                      s.paymentMethod === "CHECK" || s.payments?.some(p => p.method === "CHECK")
                    ).length === 0}
                    className="w-full bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Send size={16} />
                    Send Check Deposit SMS
                  </button>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-green-50 p-6 rounded-xl border border-green-200">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="text-green-600" size={20} />
                  <h3 className="text-lg font-semibold text-green-800">SMS Quick Stats</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="bg-white p-3 rounded-lg">
                    <div className="text-sm text-black mb-2">Total Outstanding</div>
                    <div className="font-bold text-red-600">Ksh {totalOutstanding.toFixed(2)}</div>
                  </div>
                  
                  <div className="bg-white p-3 rounded-lg">
                    <div className="text-sm text-black mb-2">This Month's Sales</div>
                    <div className="font-bold text-green-600">Ksh {totalSales.toFixed(2)}</div>
                  </div>

                  <div className="bg-white p-3 rounded-lg">
                    <div className="text-sm text-black mb-2">Customers with Phone Numbers</div>
                    <div className="font-bold text-blue-600">
                      {customers.filter(c => c.phone).length}/{customers.length}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SMS Status */}
            {messagingLoading && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-4">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  Sending SMS messages via Africa's Talking... Please wait.
                </div>
              </div>
            )}

            {/* Africa's Talking Integration Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-blue-800 mb-2">Africa's Talking SMS Integration</h4>
            </div>
          </div>
        )}

        {/* Sales Table */}
        {activeTab !== "messaging" && (
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="p-3 text-left text-black">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSales(getFilteredSales().map(s => s.id));
                          } else {
                            setSelectedSales([]);
                          }
                        }}
                        checked={selectedSales.length === getFilteredSales().length && getFilteredSales().length > 0}
                      />
                    </th>
                    <th className="p-3 text-left text-black">Product(s)</th>
                    <th className="p-3 text-left text-black">Customer</th>
                    <th className="p-3 text-left text-black">Amount</th>
                    <th className="p-3 text-left text-black">Payment Method(s)</th>
                    <th className="p-3 text-left text-black">Status</th>
                    <th className="p-3 text-left text-black">Payments</th>
                    <th className="p-3 text-left text-black">Remaining</th>
                    <th className="p-3 text-left text-black">Due Date</th>
                    <th className="p-3 text-left text-black">Date</th>
                    <th className="p-3 text-left text-black">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredSales().map((sale) => (
                    <tr key={sale.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedSales.includes(sale.id)}
                          onChange={() => {
                            if (selectedSales.includes(sale.id)) {
                              setSelectedSales(selectedSales.filter(id => id !== sale.id));
                            } else {
                              setSelectedSales([...selectedSales, sale.id]);
                            }
                          }}
                        />
                      </td>
                      <td className="p-3">
                        <div className="max-w-xs">
                          {sale.saleitems && sale.saleitems.length > 0
                            ? sale.saleitems.map((item, idx) => (
                                <div key={idx} className="text-sm">
                                  <span className="font-medium text-black">{item.product.name}</span>
                                  <span className="text-black"> (×{item.quantity})</span>
                                  <span className="text-green-600 ml-1">Ksh {(item.quantity * item.price).toFixed(2)}</span>
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
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-emerald-600">
                        Ksh {sale.amount.toFixed(2)}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {sale.payments && sale.payments.length > 0 ? (
                            sale.payments.map((payment, idx) => (
                              <span key={idx} className={`px-2 py-1 rounded-full text-xs font-medium ${
                                paymentMethods.find(m => m.value === payment.method)?.color || "bg-gray-100 text-gray-800"
                              }`}>
                                {payment.method}
                              </span>
                            ))
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              No Payment
                            </span>
                          )}
                        </div>
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
                        <div className="text-sm">
                          {sale.payments && sale.payments.length > 0 ? (
                            <div>
                              <div className="font-medium text-green-600">
                                Ksh {sale.payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                              </div>
                              <div className="text-xs text-black">
                                {sale.payments.length} payment{sale.payments.length > 1 ? 's' : ''}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">No payments</span>
                          )}
                        </div>
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
                      <td className="p-3">
                        {sale.dueDate ? (
                          <span className={`${
                            new Date(sale.dueDate) < new Date() && sale.status !== "PAID"
                              ? "text-red-600 font-semibold"
                              : "text-black"
                          }`}>
                            {new Date(sale.dueDate).toLocaleDateString()}
                          </span>
                        ) : <span className="text-black">-</span>}
                      </td>
                      <td className="p-3 text-black">{new Date(sale.date).toLocaleDateString()}</td>
                      <td className="p-3">
                        {/* Message Type Selector */}
                        <select
                          value={selectedMessageType}
                          onChange={(e) => setSelectedMessageType(e.target.value)}
                          className="px-2 py-1 text-xs border border-gray-300 rounded text-black mb-2"
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
                              alert("Customer phone number required");
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
                          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1 mb-2"
                          title="Open WhatsApp or SMS to send manually"
                        >
                          <MessageSquare size={14} />
                          Manual Message
                        </button>

                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => sendDeliveryConfirmation(sale.id)}
                            disabled={messagingLoading || !sale.customer?.phone}
                            className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex items-center gap-1"
                            title={!sale.customer?.phone ? "Customer phone number required" : "Send delivery confirmation SMS"}
                          >
                            <MessageSquare size={14} />
                            SMS Purchase 
                          </button>
                          
                          {sale.status !== "PAID" && (
                            <button
                              onClick={async () => {
                                try {
                                  setMessagingLoading(true);
                                  const res = await fetch("/api/sms/get-overdue-payments", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ saleId: sale.id }),
                                  });
                                  const data = await res.json();
                                  if (res.ok) {
                                    alert(data.message);
                                  } else {
                                    alert(data.error || "Failed to send reminder");
                                  }
                                } catch (err) {
                                  alert("Failed to send reminder");
                                } finally {
                                  setMessagingLoading(false);
                                }
                              }}
                              disabled={messagingLoading || !sale.customer?.phone}
                              className="px-3 py-1 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1"
                              title={!sale.customer?.phone ? "Customer phone number required" : "Send payment reminder SMS"}
                            >
                              <Clock size={14} />
                              SMS Remind
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleEditSale(sale)}
                            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1"
                            title="Edit sale"
                          >
                            <Edit size={14} />
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {getFilteredSales().length === 0 && (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-black">
                        No sales found for this category
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bulk Actions */}
            {selectedSales.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-blue-800">
                    {selectedSales.length} sale{selectedSales.length > 1 ? 's' : ''} selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        try {
                          setMessagingLoading(true);
                          const result = await sendPaymentReminder();
                          alert(result.message);
                        } catch (err) {
                          alert("Failed to send reminders");
                        } finally {
                          setMessagingLoading(false);
                        }
                      }}
                      disabled={messagingLoading}
                      className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
                    >
                      <Send size={16} />
                      Send SMS Payment Reminders
                    </button>
                    <button
                      onClick={() => setSelectedSales([])}
                      className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedSalesPage;