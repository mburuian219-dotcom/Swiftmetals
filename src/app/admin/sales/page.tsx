"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Download, MessageSquare, Send, Clock, CreditCard, AlertTriangle, CheckCircle, Plus, X, Edit, Trash2, Calculator, Save, Menu, ChevronDown, ChevronUp } from "lucide-react";

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
}

interface NewSaleItem {
  productId: number;
  quantity: number;
  price: number;
  productName: string;
  originalPrice?: number;
}

const EnhancedSalesPage = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showAddSale, setShowAddSale] = useState(false);
  const [newSale, setNewSale] = useState({
    customerId: "",
    dueDate: new Date().toISOString().split('T')[0],
  });
  const [stockError, setStockError] = useState<string | null>(null);
  const [stockValidationTimeout, setStockValidationTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const [saleItems, setSaleItems] = useState<NewSaleItem[]>([]);
  const [currentItem, setCurrentItem] = useState<NewSaleItem>({
    productId: 0,
    quantity: 0,
    price: 0,
    productName: ""
  });
  
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const [payments, setPayments] = useState<NewPayment[]>([]);
  const [currentPayment, setCurrentPayment] = useState<NewPayment>({
    amount: "",
    method: "CASH",
    referenceId: "",
    checkDepositDate: "",
    dueDate: ""
  });
  
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editPayments, setEditPayments] = useState<NewPayment[]>([]);
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"messaging" | "overview" | "paid" | "partial" | "unpaid">("overview");
  const [selectedSales, setSelectedSales] = useState<number[]>([]);
  const [messagingLoading, setMessagingLoading] = useState(false);
  const [selectedMessageType, setSelectedMessageType] = useState("delivery");

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return phone;
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("07")) return "254" + cleanPhone.substring(1);
    if (cleanPhone.startsWith("7") && cleanPhone.length === 9) return "254" + cleanPhone;
    return cleanPhone;
  };

  const messageTypes = [
    { 
      value: "delivery", 
      label: "Delivery Confirmation",
      getTemplate: (sale: Sale) => 
        `Hello ${sale.customer.name}, we truly appreciate your trust in us. Your purchase of ${
          sale.saleitems?.map(item => `${item.product?.name || "Product"} (×${item.quantity})`).join(", ") || "our products"
        } has been confirmed for delivery. Thank you for choosing us!`
    },
    { 
      value: "payment", 
      label: "Payment Reminder",
      getTemplate: (sale: Sale) => 
        `Dear ${sale.customer.name}, thank you for being our valued customer. We'd like to remind you of your outstanding balance of Ksh ${sale.remainingAmount.toFixed(2)} for ${
          sale.saleitems?.map(item => item.product?.name || "your order").join(", ") || "your recent purchase"
        }. ${sale.dueDate && sale.status !== "PAID" ? `Kindly note, payment is due on ${new Date(sale.dueDate).toLocaleDateString()}. ` : ""}We truly appreciate your prompt attention to this matter.`
    },
    { 
      value: "check", 
      label: "Check Deposit Reminder",
      getTemplate: (sale: Sale) => 
        `Hello ${sale.customer.name}, we value your continued partnership. This is a friendly reminder that your check payment for ${
          sale.saleitems?.map(item => item.product?.name || "Product").join(", ") || "your recent order"
        } is scheduled for deposit soon. Please ensure sufficient funds are available. Thank you for your cooperation.`
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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
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

    fetchData();
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

  const handleAddItemToSale = () => {
    if (stockValidationTimeout) clearTimeout(stockValidationTimeout);
    
    if (!currentItem.productId || currentItem.quantity <= 0 || currentItem.price <= 0) {
      setError("Please fill in all item details");
      return;
    }
    
    const product = products.find(p => p.id === currentItem.productId);
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
    
    const existingItem = saleItems.find(item => item.productId === currentItem.productId);
    const existingQuantity = existingItem ? existingItem.quantity : 0;
    const totalQuantity = existingQuantity + currentItem.quantity;
    
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
    
    const existingItemIndex = saleItems.findIndex(item => item.productId === currentItem.productId);

    if (existingItemIndex >= 0) {
      const updatedItems = [...saleItems];
      updatedItems[existingItemIndex].quantity += currentItem.quantity;
      updatedItems[existingItemIndex].price = currentItem.price;
      setSaleItems(updatedItems);
    } else {
      setSaleItems([...saleItems, { 
        ...currentItem, 
        productName: product.name,
        originalPrice: product.price
      }]);
    }
    
    setCurrentItem({
      productId: 0,
      quantity: 0,
      price: 0,
      productName: ""
    });
    setProductSearch("");
    setError(null);
    setStockError(null);
  };

  const handleAddPayment = () => {
    const amount = parseFloat(currentPayment.amount);
    const remainingAmount = getRemainingAmount();
    
    if (currentPayment.method !== "CREDIT") {
      if (!amount || amount <= 0) {
        setError("Please enter a valid payment amount");
        return;
      }

      if (amount > remainingAmount) {
        setError(`Payment amount cannot exceed remaining balance of Ksh ${remainingAmount.toFixed(2)}`);
        return;
      }
    }

    if (currentPayment.method === "CHECK" && !currentPayment.checkDepositDate) {
      setError("Please specify check deposit date");
      return;
    }

    if (currentPayment.method === "CREDIT" && !currentPayment.dueDate) {
      setError("Due date is MANDATORY for credit/pay later payments");
      return;
    }

    if (["MPESA", "BANK", "CARD"].includes(currentPayment.method) && !currentPayment.referenceId) {
      setError("Please enter transaction reference");
      return;
    }

    setPayments([
      ...payments,
      {
        ...currentPayment,
        amount: currentPayment.method === "CREDIT" ? "0" : currentPayment.amount,
        referenceId: currentPayment.referenceId || "",
        checkDepositDate: currentPayment.checkDepositDate || "",
        dueDate: currentPayment.dueDate || "",
      },
    ]);

    setCurrentPayment({
      amount: "",
      method: "CASH",
      referenceId: "",
      checkDepositDate: "",
      dueDate: "",
    });
    setError(null);
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const calculateTotalAmount = () => {
    return saleItems.reduce((total, item) => total + (Number(item.quantity) * Number(item.price)), 0);
  };

  const calculateTotalPayments = () => {
    return payments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  };

  const getRemainingAmount = () => {
    return Math.max(0, calculateTotalAmount() - calculateTotalPayments());
  };

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
    setError(null);
    setSuccess("Creating sale, please wait...");
    
    try {
      const totalAmount = calculateTotalAmount();
      const totalPayments = calculateTotalPayments();
      const remainingAmount = totalAmount - totalPayments;

      if (remainingAmount > 0 && !newSale.dueDate) {
        setError("Due date is MANDATORY when there's an outstanding balance");
        setLoading(false);
        setSuccess(null);
        return;
      }

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

      setShowAddSale(false);
      setSaleItems([]);
      setPayments([]);
      setCustomerSearch("");
      setProductSearch("");
      setNewSale({
        customerId: "",
        dueDate: new Date().toISOString().split("T")[0],
      });
      setSuccess("Sale created successfully!");
      setTimeout(() => setSuccess(null), 3000);

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

  const handleUpdateSale = async () => {
    if (!editingSale) return;

    setLoading(true);
    setError(null);
    setSuccess("Updating sale, please wait...");
    
    try {
      const newPayment = editPayments[editPayments.length - 1];

      if (!newPayment || !newPayment.amount) {
        setError("Please enter a valid payment before updating.");
        setLoading(false);
        setSuccess(null);
        return;
      }

      const paymentAmount = Number(newPayment.amount);
      if (paymentAmount > editingSale.remainingAmount) {
        setError(`Payment amount cannot exceed remaining balance of Ksh ${editingSale.remainingAmount.toFixed(2)}`);
        setLoading(false);
        setSuccess(null);
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
        dueDate: editingSale.dueDate || null,
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

      setCurrentPayment({
        amount: "",
        method: "CASH",
        referenceId: "",
        checkDepositDate: "",
        dueDate: ""
      });

      setSuccess("Sale updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update sale");
      console.error("Error updating sale:", err);
    } finally {
      setLoading(false);
    }
  };

 const handleDeletePayment = async (paymentId: number, saleId: number) => {
  try {
    setDeletingPaymentId(paymentId); // ✅ show loader on that button

    const response = await fetch(`/api/payment/${paymentId}?saleId=${saleId}`, {
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
    setTimeout(() => setSuccess(null), 3000);

  } catch (error: any) {
    console.error("Error deleting payment:", error);
    setError(error.message || "Failed to delete payment");
  } finally {
    setDeletingPaymentId(null); // ✅ hide loader
  }
};



  const handleDeleteSale = async (saleId: number) => {
    if (!confirm("Are you sure you want to delete this sale? This action cannot be undone.")) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess("Deleting sale, please wait...");
    
    try {
      const response = await fetch(`/api/sales/${saleId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete sale");
      }

      setSales(prevSales => prevSales.filter(s => s.id !== saleId));
      
      setSuccess("Sale deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error("Error deleting sale:", error);
      setError(error.message || "Failed to delete sale");
    } finally {
      setLoading(false);
    }
  };

  const addEditPayment = () => {
    const amount = parseFloat(currentPayment.amount);
    if (!amount || amount <= 0) {
      setError("Please enter a valid payment amount");
      return;
    }

    if (editingSale && amount > editingSale.remainingAmount) {
      setError(`Payment amount cannot exceed remaining balance of Ksh ${editingSale.remainingAmount.toFixed(2)}`);
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
      ...currentPayment,
      amount: currentPayment.amount
    }]);

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
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-black">Sales Management Dashboard</h1>
         <button
                    onClick={() => {
                      // Generate CSV data
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
                        'Payment Methods': sale.payments?.map(p => p.method).join('; ') || '-'
                      }));
        
                      // Convert to CSV string
                      const headers = Object.keys(csvData[0] || {});
                      const csvContent = [
                        headers.join(','),
                        ...csvData.map(row => 
                          headers.map(header => {
                            const value = row[header as keyof typeof row];
                            // Escape commas and quotes
                            return `"${String(value).replace(/"/g, '""')}"`;
                          }).join(',')
                        )
                      ].join('\n');
        
                      // Download CSV
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
                    className="flex-1 md:flex-none bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 flex items-center justify-center gap-2 shadow-lg transition-all"
                  >
                    <Download size={20} />
                    Export CSV
                  </button>
           <button
          onClick={() => {
            setShowAddSale(!showAddSale);
            if (showAddSale) {
              setSaleItems([]);
              setPayments([]);
              setCustomerSearch("");
              setProductSearch("");
              setError(null);
              setStockError(null);
            }
          }}
          className="w-full md:w-auto bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg transition-all"
        >
          {showAddSale ? <ChevronUp size={20} /> : <Plus size={20} />}
          {showAddSale ? "Close" : "New Sale"}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex justify-between items-start">
          <div className="flex items-start gap-2">
            <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button onClick={clearMessages} className="font-bold text-red-700 text-xl leading-none hover:text-red-900">×</button>
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 flex justify-between items-start">
          <div className="flex items-start gap-2">
            <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
          <button onClick={clearMessages} className="font-bold text-green-700 text-xl leading-none hover:text-green-900">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-6 md:mb-8">
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg border-l-4 border-emerald-500">
          <div className="text-slate-500 text-xs md:text-sm font-medium">Total Sales</div>
          <div className="text-xl md:text-2xl font-bold text-emerald-600">Ksh {stats.totalSales.toFixed(2)}</div>
          <div className="text-xs md:text-sm text-black">{sales.length} orders</div>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
          <div className="text-slate-500 text-xs md:text-sm font-medium">Fully Paid</div>
          <div className="text-xl md:text-2xl font-bold text-blue-600">Ksh {stats.paidSales.toFixed(2)}</div>
          <div className="text-xs md:text-sm text-black">{stats.paidCount} orders</div>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg border-l-4 border-orange-500">
          <div className="text-slate-500 text-xs md:text-sm font-medium">Partially Paid</div>
          <div className="text-xl md:text-2xl font-bold text-orange-600">Ksh {stats.partialSales.toFixed(2)}</div>
          <div className="text-xs md:text-sm text-black">{stats.partialCount} orders</div>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg border-l-4 border-red-500">
          <div className="text-slate-500 text-xs md:text-sm font-medium">Unpaid</div>
          <div className="text-xl md:text-2xl font-bold text-red-600">Ksh {stats.unpaidSales.toFixed(2)}</div>
          <div className="text-xs md:text-sm text-black">{stats.unpaidCount} orders</div>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg border-l-4 border-purple-500">
          <div className="text-slate-500 text-xs md:text-sm font-medium">Outstanding Amount</div>
          <div className="text-xl md:text-2xl font-bold text-purple-600">Ksh {stats.totalOutstanding.toFixed(2)}</div>
          <div className="text-xs md:text-sm text-black">Total remaining</div>
        </div>
      </div>

      {showAddSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto my-4">
            <div className="p-4 md:p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex justify-between items-center">
                <h2 className="text-xl md:text-2xl font-bold text-black">Create New Sale</h2>
                <button
                  onClick={() => setShowAddSale(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-4 md:p-6 space-y-6">
              {/* Customer Selection with Search */}
              <div className="relative customer-dropdown-container">
                <label className="block text-sm font-medium text-black mb-2">Customer *</label>
                <input
                  type="text"
                  placeholder="Search customer by name or phone..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredCustomers.map(customer => (
                      <div
                        key={customer.id}
                        onClick={() => {
                          setNewSale({...newSale, customerId: customer.id.toString()});
                          setCustomerSearch(customer.name);
                          setShowCustomerDropdown(false);
                        }}
                        className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                      >
                        <div className="font-medium text-black">{customer.name}</div>
                        {customer.phone && (
                          <div className="text-sm text-gray-600">{customer.phone}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {showCustomerDropdown && customerSearch && filteredCustomers.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3">
                    <div className="text-gray-500 text-sm">No customers found</div>
                  </div>
                )}
                {newSale.customerId && (
                  <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle size={16} />
                    Customer selected
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Sale Date</label>
                <input
                  type="date"
                  value={newSale.dueDate}
                  onChange={(e) => setNewSale({...newSale, dueDate: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4 text-black">Sale Items</h3>
                
                <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-1 gap-3">
                    {/* Product Search with Dropdown */}
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
                                setCurrentItem({
                                  ...currentItem,
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
                      {currentItem.productId > 0 && (
                        <div className="mt-1 text-sm text-green-600 flex items-center gap-1">
                          <CheckCircle size={14} />
                          {currentItem.productName} selected
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-black mb-1">Quantity *</label>
                        <input
                          type="number"
                          min="0"
                          value={currentItem.quantity}
                          onChange={(e) => setCurrentItem({...currentItem, quantity: parseInt(e.target.value) || 1})}
                          className="w-full p-2 border border-gray-300 rounded text-black"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-black mb-1">Unit Price *</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={currentItem.price}
                          onChange={(e) => setCurrentItem({...currentItem, price: parseFloat(e.target.value) || 0})}
                          className="w-full p-2 border border-gray-300 rounded text-black"
                        />
                      </div>
                    </div>
                    
                    {currentItem.productId > 0 && (
                      <div className="bg-blue-50 p-3 rounded-lg text-sm">
                        <div className="font-medium text-black">
                          Total: Ksh {(currentItem.quantity * currentItem.price).toFixed(2)}
                        </div>
                      </div>
                    )}
                    
                   <button
  type="button"
  onClick={() => {
    console.log("currentItem:", currentItem);
    handleAddItemToSale();
  }}
  disabled={!currentItem.productId || currentItem.quantity <= 0 || currentItem.price <= 0}
  className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
>
  <Plus size={16} />
  Add Item to Sale
</button>

                  </div>
                </div>

                {saleItems.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <h4 className="font-medium text-black">Items in Sale:</h4>
                    {saleItems.map((item, index) => (
                      <div key={index} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-lg border gap-2">
                        <div className="flex-1 min-w-0 w-full sm:w-auto">
                          <span className="font-medium text-black block truncate">{item.productName}</span>
                          <span className="text-black text-sm">×{item.quantity} @ Ksh {item.price.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                          <span className="font-bold text-green-600 whitespace-nowrap">Ksh {(item.quantity * item.price).toFixed(2)}</span>
                          <button
                            onClick={() => setSaleItems(saleItems.filter((_, i) => i !== index))}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-black">Total Amount:</span>
                        <span className="font-bold text-blue-600 text-lg">Ksh {calculateTotalAmount().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-4 mb-4">
                <h3 className="text-lg font-semibold mb-4 text-black">Payments</h3>

                <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <select
                      value={currentPayment.method}
                      onChange={(e) =>
                        setCurrentPayment({
                          ...currentPayment,
                          method: e.target.value as any,
                          amount: e.target.value === "CREDIT" ? "0" : currentPayment.amount,
                        })
                      }
                      className="p-3 border rounded-lg text-black"
                    >
                      {paymentMethods.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>

                    {currentPayment.method !== "CREDIT" && (
                      <input
                        type="number"
                        placeholder="Amount"
                        min="0"
                        step="0.01"
                        max={getRemainingAmount()}
                        value={currentPayment.amount}
                        onChange={(e) =>
                          setCurrentPayment({
                            ...currentPayment,
                            amount: e.target.value,
                          })
                        }
                        className="p-3 border rounded-lg text-black"
                      />
                    )}

                    {["MPESA", "BANK", "CARD"].includes(currentPayment.method) && (
                      <input
                        type="text"
                        placeholder="Reference ID *"
                        value={currentPayment.referenceId}
                        onChange={(e) =>
                          setCurrentPayment({
                            ...currentPayment,
                            referenceId: e.target.value,
                          })
                        }
                        className="p-3 border rounded-lg text-black"
                      />
                    )}

                    {currentPayment.method === "CHECK" && (
                      <input
                        type="date"
                        placeholder="Check Deposit Date"
                        value={currentPayment.checkDepositDate}
                        onChange={(e) =>
                          setCurrentPayment({
                            ...currentPayment,
                            checkDepositDate: e.target.value,
                          })
                        }
                        className="p-3 border rounded-lg text-black"
                      />
                    )}

                    {(currentPayment.method === "CREDIT" ||
                      getRemainingAmount() > parseFloat(currentPayment.amount || "0")) && (
                      <input
                        type="date"
                        placeholder="Due Date *"
                        value={currentPayment.dueDate}
                        onChange={(e) =>
                          setCurrentPayment({
                            ...currentPayment,
                            dueDate: e.target.value,
                          })
                        }
                        className="p-3 border rounded-lg text-black col-span-2"
                        title="MANDATORY for credit/partial payments"
                        min={new Date().toISOString().split("T")[0]}
                      />
                    )}

                    <button
                      type="button"
                      onClick={handleAddPayment}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 col-span-1"
                    >
                      <Plus size={20} /> Add Payment
                    </button>
                  </div>
                </div>

                {payments.length > 0 && (
                  <div className="border rounded-lg p-3 bg-gray-50">
                    <h4 className="font-semibold mb-2 text-black">Payments:</h4>
                    {payments.map((payment, index) => (
                      <div
                        key={index}
                        className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-2 bg-white rounded mb-2 gap-2"
                      >
                        <div className="flex-1">
                          <span className="text-black font-medium">
                            {payment.method}
                          </span>
                          {payment.referenceId && (
                            <span className="text-gray-600 text-sm ml-2">
                              Ref: {payment.referenceId}
                            </span>
                          )}
                          {payment.dueDate && (
                            <span className="text-orange-600 text-sm ml-2">
                              Due: {payment.dueDate}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-black">
                            Ksh {Number(payment.amount).toFixed(2)}
                          </span>
                          <button
                            onClick={() => removePayment(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between text-black">
                        <span>Total Paid:</span>
                        <span>Ksh {calculateTotalPayments().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-black">
                        <span>Remaining:</span>
                        <span
                          className={
                            getRemainingAmount() > 0
                              ? "text-red-600"
                              : "text-green-600"
                          }
                        >
                          Ksh {getRemainingAmount().toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {getRemainingAmount() > 0 && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <label className="block text-sm font-medium text-black mb-2">
                      Payment Due Date *{" "}
                      <span className="text-red-600">
                        (MANDATORY for outstanding balance)
                      </span>
                    </label>
                    <input
                      type="date"
                      value={newSale.dueDate}
                      onChange={(e) =>
                        setNewSale({
                          ...newSale,
                          dueDate: e.target.value,
                        })
                      }
                      className="w-full p-3 border rounded-lg text-black"
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
                <button
                  onClick={() => setShowAddSale(false)}
                  disabled={loading}
                  className="flex-1 bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSale}
                  disabled={saleItems.length === 0 || !newSale.customerId || loading}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Creating Sale...
                    </>
                  ) : (
                    "Create Sale"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {editingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto my-4">
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
                    <span className="font-medium ml-2 text-black">Ksh {editingSale.amount.toFixed(2)}</span>
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
                <h3 className="text-lg font-semibold mb-3 text-black">Sale Items</h3>
                <div className="space-y-2">
                  {editingSale.saleitems?.map((item, index) => (
                    <div key={index} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 p-3 rounded-lg gap-2">
                      <div className="flex-1 min-w-0 w-full sm:w-auto">
                        <span className="font-medium text-black block truncate">{item.product.name}</span>
                        <span className="text-gray-600 text-sm">×{item.quantity} @ Ksh {item.price.toFixed(2)}</span>
                      </div>
                      <span className="font-bold text-green-600 whitespace-nowrap">Ksh {(item.quantity * item.price).toFixed(2)}</span>
                    </div>
                  ))}
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
                  <div className="grid grid-cols-1 gap-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  
                  {currentPayment.amount && Number(currentPayment.amount) > Math.max(0, editingSale.amount - editPayments.reduce((sum, p) => sum + Number(p.amount), 0)) && (
                    <div className="mt-3 bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
                      Warning: Payment amount exceeds remaining balance. Maximum allowed: Ksh {Math.max(0, editingSale.amount - editPayments.reduce((sum, p) => sum + Number(p.amount), 0)).toFixed(2)}
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

      <div className="bg-white rounded-xl shadow mb-6">
        <div className="flex overflow-x-auto">
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
              className={`flex-shrink-0 px-3 md:px-4 py-3 text-center transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-b-2 border-blue-500 text-blue-600 font-semibold"
                  : "text-black hover:text-gray-800"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                {tab.icon}
                <span className="text-sm md:text-base">{tab.label}</span>
                <span className="text-xs md:text-sm">({tab.count})</span>
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
          <div className="p-4 md:p-6">
            {/* Mobile View */}
            <div className="block lg:hidden space-y-4">
              {filteredSales.map((sale) => (
                <div key={sale.id} className="bg-white border rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-black">{sale.customer?.name || "-"}</h3>
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
                      <div className="text-sm">
                        {sale.saleitems.map((item, idx) => (
                          <div key={idx} className="text-black">
                            <span className="font-medium">{item.product.name}</span>
                            <span> (×{item.quantity})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
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
                      <span className="ml-1 text-black">{new Date(sale.date).toLocaleDateString()}</span>
                    </div>
                    {sale.dueDate && (
                      <div>
                        <span className="text-gray-600">Due:</span>
                        <span className="ml-1 text-black">{new Date(sale.dueDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <select
                      value={selectedMessageType}
                      onChange={(e) => setSelectedMessageType(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded text-black mb-2"
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
                      className="flex-1 px-3 py-2 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      <MessageSquare size={12} />
                      Manual
                    </button>
                    
                    <button
                      onClick={() => sendDeliveryConfirmation(sale.id)}
                      disabled={messagingLoading || !sale.customer?.phone}
                      className="flex-1 px-3 py-2 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <MessageSquare size={12} />
                      SMS
                    </button>
                    
                    <button
                      onClick={() => window.open(`/api/receipt/${sale.id}`, "_blank")}
                      className="flex-1 px-3 py-2 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center justify-center gap-1"
                    >
                      <Download size={12} />
                      Receipt
                    </button>
                    
                    <button
                      onClick={() => handleEditSale(sale)}
                      className="flex-1 px-3 py-2 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center gap-1"
                    >
                      <Edit size={12} />
                      Edit
                    </button>
                    
                    <button
                      onClick={() => handleDeleteSale(sale.id)}
                      disabled={loading}
                      className="flex-1 px-3 py-2 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {filteredSales.length === 0 && (
                <div className="text-center py-8 text-black">
                  No sales found for this category
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
                  {filteredSales.map((sale) => (
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
                      <td className="p-3 text-black">{new Date(sale.date).toLocaleDateString()}</td>
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
                            Manual
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
                            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1"
                            title="Edit sale"
                          >
                            <Edit size={14} />
                            Edit
                          </button>
                          
                          <button
                            onClick={() => handleDeleteSale(sale.id)}
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
                  {filteredSales.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-black">
                        No sales found for this category
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