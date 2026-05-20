"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Download, MessageSquare, Send, Clock, CreditCard, AlertTriangle, CheckCircle, Plus, X, Edit, Trash2, Calculator, Save, Menu, ChevronDown, ChevronUp, Filter, Calendar, Search, XCircle, User, DollarSign, Banknote, Smartphone, Landmark, CreditCard as CardIcon, Archive, RotateCcw, Info, History, FileSpreadsheet, Moon, Sun } from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

// ==================== INTERFACES ====================

interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
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
  method: "CASH" | "TILL" | "BANK" | "CHECK" | "CARD" | "CREDIT";
  date: string;
  referenceId?: string | null;
  checkDepositDate?: string | null;
  dueDate?: string | null;
  status?: "PENDING" | "COMPLETED" | "BOUNCED" | "CLEARED";
}

interface NewPayment {
  id?: number;
  amount: string;
  method: "CASH" | "TILL" | "BANK" | "CHECK" | "CARD" | "CREDIT";
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
  totalAmount?: number;
  amountPaid?: number;
  balance?: number;
  date: string;
  status: "PAID" | "PARTIAL" | "UNPAID";
  dueDate?: string | null;
  customer: Customer;
  payments: Payment[];
  remainingAmount: number;
  paymentMethod?: "CASH" | "TILL" | "BANK" | "CHECK" | "CARD" | "CREDIT" | "MULTIPLE";
  checkDepositDate?: string | null;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  paymentHistory?: Payment[];
  hasProducts?: boolean;
  warning?: string;
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

interface AuditLog {
  id: number;
  saleId: number;
  action: "CREATE" | "UPDATE" | "DELETE" | "RESTORE";
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  difference?: string;
  changedBy: string;
  changedByEmail?: string;
  changedAt: string;
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
  snapshot?: any;
}

interface DeletedSale {
  id: number;
  originalSaleId: number;
  saleData: any;
  customerName: string;
  customerPhone: string | null;
  totalAmount: number;
  saleDate: string;
  deletedAt: string;
  deletedBy: string;
  deletedByEmail: string;
  restockedItems: boolean;
  deletionReason: string | null;
  saleItemsSummary: string;
  paymentsSummary: string;
  statusAtDeletion: string;
  expiresAt: string;
  restoredAt?: string;
  restoredBy?: string;
}

interface StaffMember {
  id: number;
  name: string;
  email: string;
}

// ==================== THEME CONTEXT ====================
const ThemeContext = React.createContext({ theme: 'light', toggleTheme: () => {} });

function useTheme() {
  return React.useContext(ThemeContext);
}

// ==================== MAIN COMPONENT ====================

export default function EnhancedSalesPage() {
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // Load theme from localStorage on mount
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

  // Existing state
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
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
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "paid" | "partial" | "unpaid" | "recentlyUpdated">("overview");
  const [selectedSales, setSelectedSales] = useState<number[]>([]);

  // NEW FILTERS: Created By and Updated By
  const [createdByFilter, setCreatedByFilter] = useState("");
  const [updatedByFilter, setUpdatedByFilter] = useState("");
  
  // Filter state variables
  const [customerFilter, setCustomerFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month" | "custom">("today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  
  // Product search filter
  const [productNameFilter, setProductNameFilter] = useState("");
  
  // Create sale modal state
  const [showCreateSaleModal, setShowCreateSaleModal] = useState(false);
  const [newSaleDate, setNewSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [newSaleCustomerId, setNewSaleCustomerId] = useState<number | null>(null);
  const [newSaleCustomerSearch, setNewSaleCustomerSearch] = useState("");
  const [newSaleShowCustomerDropdown, setNewSaleShowCustomerDropdown] = useState(false);
  const [newSaleItems, setNewSaleItems] = useState<NewSaleItem[]>([]);
  const [newSaleCurrentItem, setNewSaleCurrentItem] = useState<NewSaleItem>({
    productId: 0,
    quantity: 0,
    price: 0,
    productName: ""
  });
  const [newSaleProductSearch, setNewSaleProductSearch] = useState("");
  const [newSaleShowProductDropdown, setNewSaleShowProductDropdown] = useState(false);
  const [newSalePayments, setNewSalePayments] = useState<NewPayment[]>([]);
  const [newSaleCurrentPayment, setNewSaleCurrentPayment] = useState<NewPayment>({
    amount: "",
    method: "CASH",
    referenceId: "",
    checkDepositDate: "",
    dueDate: ""
  });
  
  // Deleted sales tracking state
  const [deletedSales, setDeletedSales] = useState<DeletedSale[]>([]);
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [deletedSalesLoading, setDeletedSalesLoading] = useState(false);
  const [deletedSalesPage, setDeletedSalesPage] = useState(1);
  const [deletedSalesTotal, setDeletedSalesTotal] = useState(0);
  const [deletedSearchTerm, setDeletedSearchTerm] = useState("");
  const [deletedDateFilter, setDeletedDateFilter] = useState<"all" | "today" | "week" | "month" | "custom">("week");
  const [deletedCustomStartDate, setDeletedCustomStartDate] = useState("");
  const [deletedCustomEndDate, setDeletedCustomEndDate] = useState("");
  const [restoringSaleId, setRestoringSaleId] = useState<number | null>(null);
  const [showDeleteDetailsModal, setShowDeleteDetailsModal] = useState<DeletedSale | null>(null);
  const [deletionReason, setDeletionReason] = useState("");
  const [showDeletionReasonModal, setShowDeletionReasonModal] = useState<number | null>(null);
  
  // Audit log state
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [selectedSaleForAudit, setSelectedSaleForAudit] = useState<Sale | null>(null);
  
  // Restock confirmation state
  const [showRestockConfirm, setShowRestockConfirm] = useState<number | null>(null);
  
  // User details state
  const [userDetails, setUserDetails] = useState<Map<string, UserDetail>>(new Map());
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Mobile states
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);

  // Debug state
  const [debugInfo, setDebugInfo] = useState<string>("");

  // ==================== ACCOUNTING REPORT STATE ====================
  const [showAccountingModal, setShowAccountingModal] = useState(false);
  const [accountingReportType, setAccountingReportType] = useState<"daily" | "outstanding" | "customer" | "weekly" | "monthly" | "payment-activity">("daily");
  const [accountingDate, setAccountingDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountingStartDate, setAccountingStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [accountingEndDate, setAccountingEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountingCustomerId, setAccountingCustomerId] = useState("");
  const [accountingCustomerSearch, setAccountingCustomerSearch] = useState("");
  const [accountingShowCustomerDropdown, setAccountingShowCustomerDropdown] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [accountingPeriod, setAccountingPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  // ==================== HELPER FUNCTIONS ====================

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return phone;
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("07")) return "254" + cleanPhone.substring(1);
    if (cleanPhone.startsWith("7") && cleanPhone.length === 9) return "254" + cleanPhone;
    return cleanPhone;
  };

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

  const formatDateTime = (dateString: string | null | undefined): string => {
    if (!dateString) return "";
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
      return "";
    }
  };

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

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const isRecentlyUpdated = useCallback((sale: Sale): boolean => {
    if (!sale.updatedAt) return false;
    try {
      const updatedDate = new Date(sale.updatedAt);
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      return updatedDate >= sevenDaysAgo;
    } catch (error) {
      console.error("Error parsing updatedAt date:", error);
      return false;
    }
  }, []);

  const isSaleModified = useCallback((sale: Sale): boolean => {
    if (!sale.updatedAt || !sale.createdAt) return false;
    try {
      const updatedDate = new Date(sale.updatedAt);
      const createdDate = new Date(sale.createdAt);
      const oneMinute = 60 * 1000;
      return (updatedDate.getTime() - createdDate.getTime()) > oneMinute;
    } catch (error) {
      return false;
    }
  }, []);

  // Updated calculateSaleStatus to handle missing products
  const calculateSaleStatus = useCallback((sale: any): Sale => {
    // Get total paid from payments array
    const totalPaid = sale.payments?.reduce((sum: number, p: Payment) => 
      sum + Number(p.amount || 0), 0) || 0;
    
    // Use sale.amount as the source of truth (never recalculate from products)
    const totalAmount = Number(sale.amount) || 0;
    const remainingAmount = Math.max(0, totalAmount - totalPaid);
    
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
    } else if (totalPaid > 0) {
      status = "PARTIAL";
    } else {
      status = "UNPAID";
    }

    // Check if products exist
    const hasProducts = sale.saleitems && sale.saleitems.length > 0;
    
    // Add warning for debt records without products
    const warning = (!hasProducts && totalAmount > 0) 
      ? "This is a debt record with no product details. Financial data is preserved."
      : undefined;

    return { 
      ...sale, 
      totalAmount,
      amountPaid: totalPaid,
      balance: remainingAmount,
      remainingAmount, 
      status, 
      payments: sale.payments || [],
      hasProducts,
      warning
    };
  }, []);

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

  // Get client IP (for audit logging)
  const getClientIP = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  };

  // Fetch staff members for filters
  const fetchStaffMembers = async () => {
    try {
      const response = await fetch('/api/staff');
      if (response.ok) {
        const data = await response.json();
        setStaffMembers(data);
      }
    } catch (error) {
      console.error("Error fetching staff:", error);
    }
  };

  // ==================== ACCOUNTING REPORT FUNCTIONS ====================

  const downloadAccountingReport = async (type: "daily" | "outstanding" | "customer" | "weekly" | "monthly" | "payment-activity") => {
    setDownloadingReport(true);
    setError(null);
    
    try {
      let url = "";
      let filename = "";
      
      switch (type) {
        case "daily":
          url = `/api/paymentReports?type=daily&date=${accountingDate}`;
          filename = `daily-payments-${accountingDate}.csv`;
          break;
        case "weekly":
          url = `/api/paymentReports?type=weekly&date=${accountingDate}`;
          filename = `weekly-report-${accountingDate}.csv`;
          break;
        case "monthly":
          url = `/api/paymentReports?type=monthly&date=${accountingDate}`;
          filename = `monthly-report-${accountingDate}.csv`;
          break;
        case "outstanding":
          url = `/api/paymentReports?type=outstanding&asOf=${accountingDate}`;
          filename = `outstanding-debts-${accountingDate}.csv`;
          break;
        case "customer":
          if (!accountingCustomerId) {
            setError("Please select a customer");
            setDownloadingReport(false);
            return;
          }
          url = `/api/paymentReports?type=customer&customerId=${accountingCustomerId}&startDate=${accountingStartDate}&endDate=${accountingEndDate}`;
          const customer = customers.find(c => c.id === Number(accountingCustomerId));
          filename = `${customer?.name || 'customer'}-payment-history-${accountingStartDate}-to-${accountingEndDate}.csv`;
          break;
        case "payment-activity":
          url = `/api/paymentReports?type=payment-activity&period=${accountingPeriod}&startDate=${accountingStartDate}&endDate=${accountingEndDate}`;
          filename = `payment-activity-${accountingPeriod}-${accountingStartDate}.csv`;
          break;
      }
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'text/csv'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to download report");
      }
      
      const blob = await response.blob();
      const link = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      
      link.href = objectUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      
      let successMessage = '';
      switch (type) {
        case 'daily': successMessage = 'Daily report'; break;
        case 'weekly': successMessage = 'Weekly report'; break;
        case 'monthly': successMessage = 'Monthly report'; break;
        case 'outstanding': successMessage = 'Outstanding debts report'; break;
        case 'customer': successMessage = 'Customer history'; break;
        case 'payment-activity': successMessage = 'Payment activity report'; break;
      }
      
      setSuccess(`${successMessage} downloaded successfully!`);
      setTimeout(() => setSuccess(null), 3000);
      setShowAccountingModal(false);
      
    } catch (err: any) {
      console.error("Error downloading report:", err);
      setError(err.message || "Failed to download report");
    } finally {
      setDownloadingReport(false);
    }
  };

  // ==================== AUDIT LOG FUNCTIONS ====================

  const fetchAuditLogs = async (saleId: number) => {
    setAuditLogsLoading(true);
    try {
      const response = await fetch(`/api/sales/${saleId}/audit`);
      const data = await response.json();
      
      if (response.ok) {
        setAuditLogs(data.logs || []);
      } else {
        console.error("Failed to fetch audit logs:", data.error);
        setAuditLogs([]);
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      setAuditLogs([]);
    } finally {
      setAuditLogsLoading(false);
    }
  };

  const handleViewAuditLog = async (sale: Sale) => {
    setSelectedSaleForAudit(sale);
    setShowAuditModal(true);
    await fetchAuditLogs(sale.id);
  };

  // ==================== DELETED SALES FUNCTIONS ====================

  const fetchDeletedSales = async () => {
    setDeletedSalesLoading(true);
    try {
      let url = `/api/deleted-sales?page=${deletedSalesPage}&limit=50`;
      
      if (deletedSearchTerm) {
        url += `&search=${encodeURIComponent(deletedSearchTerm)}`;
      }
      
      if (deletedDateFilter !== "all") {
        if (deletedDateFilter === "custom" && deletedCustomStartDate && deletedCustomEndDate) {
          url += `&startDate=${deletedCustomStartDate}&endDate=${deletedCustomEndDate}`;
        } else if (deletedDateFilter !== "custom") {
          url += `&filter=${deletedDateFilter}`;
        }
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (response.ok) {
        setDeletedSales(data.deletedSales || []);
        setDeletedSalesTotal(data.total || 0);
      } else {
        console.error("Failed to fetch deleted sales:", data.error);
      }
    } catch (error) {
      console.error("Error fetching deleted sales:", error);
    } finally {
      setDeletedSalesLoading(false);
    }
  };

  const handleRestoreSale = async (deletedSaleId: number) => {
    if (!confirm("Are you sure you want to restore this sale? This will recreate the sale with all its original items and payments.")) {
      return;
    }
    
    setRestoringSaleId(deletedSaleId);
    setError(null);
    
    try {
      const ipAddress = await getClientIP();
      const response = await fetch(`/api/deleted-sales/${deletedSaleId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restoredBy: currentUser,
          restoredByEmail: currentUserEmail,
          ipAddress
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess("Sale restored successfully!");
        setTimeout(() => setSuccess(null), 3000);
        fetchDeletedSales();
        
        const salesRes = await fetch("/api/sales");
        if (salesRes.ok) {
          const refreshedSales = await salesRes.json();
          const processedSales = refreshedSales.map(calculateSaleStatus);
          setSales(processedSales);
        }
      } else {
        throw new Error(data.error || "Failed to restore sale");
      }
    } catch (err: any) {
      setError(err.message || "Failed to restore sale");
      console.error("Error restoring sale:", err);
    } finally {
      setRestoringSaleId(null);
    }
  };

  // ==================== SALE CRUD OPERATIONS ====================

  const handleDeleteSaleWithReason = async (saleId: number, restockItems: boolean = false) => {
    if (!deletionReason.trim()) {
      setError("Please provide a reason for deletion");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess("Deleting sale, please wait...");
    
    try {
      const ipAddress = await getClientIP();
      const userAgent = navigator.userAgent;
      
      const response = await fetch(`/api/sales/${saleId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          restockItems,
          deletedBy: currentUser,
          deletedByEmail: currentUserEmail,
          deletionReason: deletionReason,
          ipAddress,
          userAgent
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete sale");
      }

      setSales(prevSales => prevSales.filter(s => s.id !== saleId));
      setShowRestockConfirm(null);
      setShowDeletionReasonModal(null);
      setDeletionReason("");
      
      setSuccess(`Sale deleted successfully${restockItems ? ' with items restocked' : ''}!`);
      setTimeout(() => setSuccess(null), 3000);
      
      if (showDeletedModal) {
        fetchDeletedSales();
      }
    } catch (error: any) {
      console.error("Error deleting sale:", error);
      setError(error.message || "Failed to delete sale");
    } finally {
      setLoading(false);
    }
  };

  // UPDATED: Handle update sale with payment-only focus
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
      const ipAddress = await getClientIP();
      const userAgent = navigator.userAgent;
      
      // Calculate new payments (only payments that are being added)
      const existingPaymentIds = (editingSale.payments || []).map(p => p.id);
      const newPaymentsList = editPayments.filter(p => !p.id);
      
      // IMPORTANT: For debt records, we ONLY send payment updates
      const updateData: any = {
        updatedBy: currentUser,
        updatedByEmail: currentUserEmail,
        ipAddress,
        userAgent,
      };
      
      // Only add payment if there are new payments
      if (newPaymentsList.length > 0) {
        // For debt records, we need to use the addPayment format
        // The API expects a single payment to add, not an array
        const firstNewPayment = newPaymentsList[0];
        
        updateData.addPayment = {
          amount: Number(firstNewPayment.amount),
          method: firstNewPayment.method,
          note: firstNewPayment.referenceId ? `Ref: ${firstNewPayment.referenceId}` : null,
          referenceId: firstNewPayment.referenceId || null,
          checkDate: firstNewPayment.checkDepositDate || null,
          bankName: firstNewPayment.bankName || null,
          checkNumber: firstNewPayment.checkNumber || null,
        };
        
        console.log("Sending payment:", updateData.addPayment);
      }
      
      // Only update due date if changed
      if (editingSale.dueDate !== undefined) {
        updateData.dueDate = editingSale.dueDate || null;
      }
      
      // Only update sale items if the sale has products AND items were changed
      if (editingSale.hasProducts && editSaleItems.length > 0) {
        // Check if items actually changed
        const itemsChanged = JSON.stringify(editSaleItems) !== JSON.stringify(
          editingSale.saleitems.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            price: item.price,
            productName: item.product.name
          }))
        );
        
        if (itemsChanged) {
          updateData.saleItems = editSaleItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          }));
          updateData.replaceItems = true;
          updateData.updateTotalAmount = true;
        }
      }
      
      // If no changes, show message and return
      if (Object.keys(updateData).length <= 4) { // only has updatedBy, updatedByEmail, ipAddress, userAgent
        setError("No changes to save");
        setLoading(false);
        return;
      }
      
      console.log("Sending update data:", updateData);
      
      const response = await fetch(`/api/sales/${editingSale.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      const responseData = await response.json();
      console.log("Response from API:", responseData);

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to update sale");
      }

      // Refresh the sale data to get updated amounts
      const refreshedSale = await fetch(`/api/sales/${editingSale.id}`).then(res => res.json());
      const processedSale = calculateSaleStatus(refreshedSale);

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
      
      setSuccess(newPaymentsList.length > 0 
        ? `Payment of Ksh ${newPaymentsList[0].amount} added successfully! Remaining balance: Ksh ${formatCurrency(processedSale.balance || processedSale.remainingAmount)}`
        : "Sale updated successfully!"
      );
      setTimeout(() => setSuccess(null), 3000);

      // Refresh all sales data
      const salesRes = await fetch("/api/sales");
      if (salesRes.ok) {
        const refreshedSales = await salesRes.json();
        const processedSales = refreshedSales.map(calculateSaleStatus);
        setSales(processedSales);
      }
    } catch (err: any) {
      console.error("Error updating sale:", err);
      setError(err.message || "Failed to update sale");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSale = async () => {
    if (!newSaleCustomerId) {
      setError("Please select a customer");
      return;
    }
    if (newSaleItems.length === 0) {
      setError("Please add at least one item to the sale");
      return;
    }
    if (!currentUser) {
      setError("Please log in to create a sale");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess("Creating sale...");

    try {
      const ipAddress = await getClientIP();
      const userAgent = navigator.userAgent;
      
      const totalAmount = newSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      const totalPayments = newSalePayments.reduce((sum, p) => sum + Number(p.amount), 0);
      
      let status = "UNPAID";
      if (totalPayments >= totalAmount - 0.01) {
        status = "PAID";
      } else if (totalPayments > 0) {
        status = "PARTIAL";
      }

      const saleData = {
        customerId: newSaleCustomerId,
        date: newSaleDate,
        amount: totalAmount,
        status: status,
        saleItems: newSaleItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
        payments: newSalePayments.map(p => ({
          amount: Number(p.amount),
          method: p.method,
          referenceId: p.referenceId?.trim() || null,
          checkDepositDate: p.checkDepositDate || null,
          dueDate: p.dueDate || null,
          date: newSaleDate,
          status: p.method === "CHECK" ? "PENDING" : "COMPLETED",
        })),
        createdBy: currentUser,
        createdByEmail: currentUserEmail,
        updatedBy: currentUser,
        updatedByEmail: currentUserEmail,
        ipAddress,
        userAgent,
      };

      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saleData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create sale");
      }

      const newSale = await response.json();
      const processedSale = calculateSaleStatus(newSale);
      
      setSales(prev => [processedSale, ...prev]);
      
      setShowCreateSaleModal(false);
      setNewSaleDate(new Date().toISOString().split('T')[0]);
      setNewSaleCustomerId(null);
      setNewSaleCustomerSearch("");
      setNewSaleItems([]);
      setNewSalePayments([]);
      setNewSaleCurrentItem({
        productId: 0,
        quantity: 0,
        price: 0,
        productName: ""
      });
      setNewSaleCurrentPayment({
        amount: "",
        method: "CASH",
        referenceId: "",
        checkDepositDate: "",
        dueDate: ""
      });
      
      setSuccess("Sale created successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to create sale");
      console.error("Error creating sale:", err);
    } finally {
      setLoading(false);
    }
  };

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

  // UPDATED: Handle edit sale to work with or without products
  const handleEditSale = (sale: Sale) => {
    setEditingSale(sale);
    
    // Always set payments regardless of products
    setEditPayments(sale.payments.map(p => ({
      id: p.id,
      amount: p.amount.toString(),
      method: p.method,
      referenceId: p.referenceId || "",
      checkDepositDate: p.checkDepositDate || ""
    })));
    
    // Only set sale items if they exist
    if (sale.saleitems && sale.saleitems.length > 0) {
      setEditSaleItems(sale.saleitems.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.price,
        productName: item.product.name,
        originalPrice: item.product.price
      })));
    } else {
      // For debt records without products, keep items array empty
      setEditSaleItems([]);
    }
  };

  const handleAddItemToNewSale = () => {
    if (!newSaleCurrentItem.productId || newSaleCurrentItem.quantity <= 0 || newSaleCurrentItem.price <= 0) {
      setError("Please fill in all item details");
      return;
    }
    
    const product = products.find(p => p.id === newSaleCurrentItem.productId);
    if (!product) {
      setError("Product not found");
      return;
    }
    
    const existingItemIndex = newSaleItems.findIndex(item => item.productId === newSaleCurrentItem.productId);

    if (existingItemIndex >= 0) {
      const updatedItems = [...newSaleItems];
      updatedItems[existingItemIndex].quantity += newSaleCurrentItem.quantity;
      updatedItems[existingItemIndex].price = newSaleCurrentItem.price;
      setNewSaleItems(updatedItems);
    } else {
      setNewSaleItems([...newSaleItems, { 
        ...newSaleCurrentItem, 
        productName: product.name,
        originalPrice: product.price
      }]);
    }
    
    setNewSaleCurrentItem({
      productId: 0,
      quantity: 0,
      price: 0,
      productName: ""
    });
    setNewSaleProductSearch("");
    setError(null);
  };

  const handleAddPaymentToNewSale = () => {
    if (newSaleCurrentPayment.method === "CREDIT") {
      if (!newSaleCurrentPayment.dueDate) {
        setError("Due date is required for credit/pay later");
        return;
      }
      
      setNewSalePayments([...newSalePayments, {
        amount: "0",
        method: newSaleCurrentPayment.method,
        referenceId: "",
        checkDepositDate: "",
        dueDate: newSaleCurrentPayment.dueDate
      }]);
    } else {
      const amount = parseFloat(newSaleCurrentPayment.amount);
      if (!amount || amount <= 0) {
        setError("Please enter a valid payment amount");
        return;
      }

      const currentTotal = newSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      const currentPayments = newSalePayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const remainingAmount = currentTotal - currentPayments;

      if (amount > remainingAmount) {
        setError(`Payment amount cannot exceed remaining balance of Ksh ${remainingAmount.toFixed(2)}`);
        return;
      }
      
      if (newSaleCurrentPayment.method === "CHECK" && !newSaleCurrentPayment.checkDepositDate) {
        setError("Please specify check deposit date");
        return;
      }

      if (["TILL", "BANK", "CARD"].includes(newSaleCurrentPayment.method) && !newSaleCurrentPayment.referenceId?.trim()) {
        setError("Please enter transaction reference");
        return;
      }
      
      setNewSalePayments([...newSalePayments, {
        amount: newSaleCurrentPayment.amount,
        method: newSaleCurrentPayment.method,
        referenceId: newSaleCurrentPayment.referenceId || "",
        checkDepositDate: newSaleCurrentPayment.checkDepositDate || "",
        dueDate: ""
      }]);
    }

    setNewSaleCurrentPayment({
      amount: "",
      method: "CASH",
      referenceId: "",
      checkDepositDate: "",
      dueDate: ""
    });
    setError(null);
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

  // UPDATED: Add payment to edit sale (works for both regular and debt sales)
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

      // Calculate remaining balance using sale.amount (not from items)
      const totalAmount = editingSale?.amount || 0;
      const currentPaymentsTotal = editPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const remainingAmount = totalAmount - currentPaymentsTotal;

      if (amount > remainingAmount) {
        setError(`Payment amount cannot exceed remaining balance of Ksh ${remainingAmount.toFixed(2)}`);
        return;
      }
      
      if (currentPayment.method === "CHECK" && !currentPayment.checkDepositDate) {
        setError("Please specify check deposit date");
        return;
      }

      if (["TILL", "BANK", "CARD"].includes(currentPayment.method) && !currentPayment.referenceId?.trim()) {
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
    setDateFilter("today");
    setCustomStartDate("");
    setCustomEndDate("");
    setProductNameFilter("");
    setCreatedByFilter("");
    setUpdatedByFilter("");
    setExpandedSaleId(null);
  };

  const showDeleteConfirmationWithReason = (saleId: number) => {
    setShowDeletionReasonModal(saleId);
  };

  // ==================== DATA FETCHING ====================

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const user = auth.currentUser;
        let idToken = "";
        
        if (user) {
          idToken = await user.getIdToken();
          setCurrentUser(user.displayName || user.email?.split('@')[0] || "");
          setCurrentUserEmail(user.email || "");
          
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
          { url: "/api/products", name: "Products" },
          { url: "/api/staff", name: "Staff" }
        ];

        const [salesRes, customersRes, productsRes, staffRes] = await Promise.all([
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
          }),
          fetch(endpoints[3].url).catch(err => {
            console.error(`❌ ${endpoints[3].name} fetch failed:`, err);
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
        
        let staffData = [];
        if (staffRes && staffRes.ok) {
          staffData = await staffRes.json();
          setStaffMembers(staffData);
        }

        const validCustomers = Array.isArray(customersData) 
          ? customersData 
          : (customersData?.customers || customersData?.data || []);
        
        const processedSales = Array.isArray(salesData) 
          ? salesData.filter((s: any) => !s.isDeleted).map(calculateSaleStatus) 
          : [];
        
        const validProducts = Array.isArray(productsData) ? productsData : [];
        
        setSales(processedSales);
        setCustomers(validCustomers);
        setProducts(validProducts);

        // Count sales without products for debugging
        const salesWithoutProducts = processedSales.filter(s => !s.hasProducts);
        console.log(`Total sales loaded: ${processedSales.length}, Sales without products: ${salesWithoutProducts.length}`);

        setDebugInfo(`Total sales: ${processedSales.length}, Without products: ${salesWithoutProducts.length}`);

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
        setCurrentUserEmail("");
        setError("Please log in to access sales data");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [calculateSaleStatus]);

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
      if (!target.closest('.new-sale-customer-dropdown')) {
        setNewSaleShowCustomerDropdown(false);
      }
      if (!target.closest('.new-sale-product-dropdown')) {
        setNewSaleShowProductDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ==================== MEMOIZED VALUES ====================

  const paymentMethods = [
    { value: "CASH", label: "Cash", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: Banknote },
    { value: "TILL", label: "Till", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Smartphone },
    { value: "BANK", label: "Bank", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: Landmark },
    { value: "CHECK", label: "Check", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: DollarSign },
    { value: "CARD", label: "Card", color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200", icon: CardIcon },
    { value: "CREDIT", label: "Credit", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: CreditCard }
  ];

  const stats = useMemo(() => {
    const recentlyUpdatedSales = sales.filter(sale => {
      return isRecentlyUpdated(sale) && isSaleModified(sale);
    });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todaySales = sales.filter(sale => {
      const saleDate = new Date(sale.date);
      return saleDate >= today && saleDate < tomorrow;
    });
    
    let cashAmount = 0, tillAmount = 0, bankAmount = 0, checkAmount = 0, cardAmount = 0, creditAmount = 0;
    
    sales.forEach(sale => {
      sale.payments?.forEach(payment => {
        const amount = Number(payment.amount) || 0;
        switch(payment.method) {
          case "CASH": cashAmount += amount; break;
          case "TILL": tillAmount += amount; break;
          case "BANK": bankAmount += amount; break;
          case "CHECK": checkAmount += amount; break;
          case "CARD": cardAmount += amount; break;
          case "CREDIT": creditAmount += amount; break;
        }
      });
    });
    
    const todayPaid = todaySales.filter(s => s.status === "PAID").reduce((acc, s) => acc + Number(s.amount), 0);
    const todayPartial = todaySales.filter(s => s.status === "PARTIAL").reduce((acc, s) => acc + Number(s.amount), 0);
    const todayUnpaid = todaySales.filter(s => s.status === "UNPAID").reduce((acc, s) => acc + Number(s.amount), 0);
    const todayOutstanding = todaySales.reduce((acc, s) => acc + Number(s.balance || s.remainingAmount), 0);
    
    let todayCash = 0, todayTill = 0, todayBank = 0, todayCheck = 0, todayCard = 0, todayCredit = 0;
    
    todaySales.forEach(sale => {
      sale.payments?.forEach(payment => {
        const amount = Number(payment.amount) || 0;
        switch(payment.method) {
          case "CASH": todayCash += amount; break;
          case "TILL": todayTill += amount; break;
          case "BANK": todayBank += amount; break;
          case "CHECK": todayCheck += amount; break;
          case "CARD": todayCard += amount; break;
          case "CREDIT": todayCredit += amount; break;
        }
      });
    });
    
    return {
      totalSales: sales.reduce((acc, s) => acc + Number(s.amount), 0),
      paidSales: sales.filter(s => s.status === "PAID").reduce((acc, s) => acc + Number(s.amount), 0),
      partialSales: sales.filter(s => s.status === "PARTIAL").reduce((acc, s) => acc + Number(s.amount), 0),
      unpaidSales: sales.filter(s => s.status === "UNPAID").reduce((acc, s) => acc + Number(s.amount), 0),
      totalOutstanding: sales.reduce((acc, s) => acc + Number(s.balance || s.remainingAmount), 0),
      paidCount: sales.filter(s => s.status === "PAID").length,
      partialCount: sales.filter(s => s.status === "PARTIAL").length,
      unpaidCount: sales.filter(s => s.status === "UNPAID").length,
      recentlyUpdatedCount: recentlyUpdatedSales.length,
      recentlyUpdatedAmount: recentlyUpdatedSales.reduce((acc, s) => acc + Number(s.amount), 0),
      cashAmount, tillAmount, bankAmount, checkAmount, cardAmount, creditAmount,
      todaySales: todaySales.reduce((acc, s) => acc + Number(s.amount), 0),
      todayPaid, todayPartial, todayUnpaid, todayOutstanding,
      todayCount: todaySales.length,
      todayPaidCount: todaySales.filter(s => s.status === "PAID").length,
      todayPartialCount: todaySales.filter(s => s.status === "PARTIAL").length,
      todayUnpaidCount: todaySales.filter(s => s.status === "UNPAID").length,
      todayCash, todayTill, todayBank, todayCheck, todayCard, todayCredit,
      salesWithoutProducts: sales.filter(s => !s.hasProducts).length,
    };
  }, [sales, isRecentlyUpdated, isSaleModified]);

  const filteredSales = useMemo(() => {
    switch (activeTab) {
      case "paid": return sales.filter(s => s.status === "PAID");
      case "partial": return sales.filter(s => s.status === "PARTIAL");
      case "unpaid": return sales.filter(s => s.status === "UNPAID");
      case "recentlyUpdated": return sales.filter(sale => isRecentlyUpdated(sale) && isSaleModified(sale));
      default: return sales;
    }
  }, [sales, activeTab, isRecentlyUpdated, isSaleModified]);

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

    // NEW: Filter by Created By
    if (createdByFilter) {
      filtered = filtered.filter(sale => sale.createdBy === createdByFilter);
    }

    // NEW: Filter by Updated By
    if (updatedByFilter) {
      filtered = filtered.filter(sale => sale.updatedBy === updatedByFilter);
    }

    if (productNameFilter.trim()) {
      const searchProduct = productNameFilter.toLowerCase().trim();
      filtered = filtered.filter(sale => {
        if (!sale.saleitems || sale.saleitems.length === 0) return false;
        return sale.saleitems.some(item => 
          item.product.name.toLowerCase().includes(searchProduct)
        );
      });
    }

    if (dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.date);
        
        switch (dateFilter) {
          case "today": return saleDate >= today && saleDate < tomorrow;
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
          default: return true;
        }
      });
    }

    return filtered;
  }, [filteredSales, customerFilter, dateFilter, customStartDate, customEndDate, productNameFilter, createdByFilter, updatedByFilter]);

  const getSortedSales = (salesList: Sale[]) => {
    if (activeTab === "recentlyUpdated") {
      return [...salesList].sort((a, b) => {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dateB - dateA;
      });
    }
    return salesList;
  };

  const sortedFilteredSales = useMemo(() => {
    return getSortedSales(fullyFilteredSales);
  }, [fullyFilteredSales, activeTab]);

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

  const newSaleFilteredCustomers = useMemo(() => {
    if (!newSaleCustomerSearch.trim()) return customers;
    const searchLower = newSaleCustomerSearch.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchLower) ||
      (c.phone && c.phone.includes(searchLower))
    );
  }, [customers, newSaleCustomerSearch]);

  const newSaleFilteredProducts = useMemo(() => {
    if (!newSaleProductSearch.trim()) return products;
    const searchLower = newSaleProductSearch.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(searchLower)
    );
  }, [products, newSaleProductSearch]);

  const accountingFilteredCustomers = useMemo(() => {
    if (!accountingCustomerSearch.trim()) return customers;
    const searchLower = accountingCustomerSearch.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchLower) ||
      (c.phone && c.phone.includes(searchLower))
    );
  }, [customers, accountingCustomerSearch]);

  const isFilterActive = useMemo(() => {
    return customerFilter.trim() !== "" || dateFilter !== "today" || productNameFilter.trim() !== "" || createdByFilter !== "" || updatedByFilter !== "";
  }, [customerFilter, dateFilter, productNameFilter, createdByFilter, updatedByFilter]);

  // Get unique staff emails for filters
  const uniqueCreatedBy = useMemo(() => {
    const emails = new Set<string>();
    sales.forEach(sale => {
      if (sale.createdBy) emails.add(sale.createdBy);
    });
    return Array.from(emails);
  }, [sales]);

  const uniqueUpdatedBy = useMemo(() => {
    const emails = new Set<string>();
    sales.forEach(sale => {
      if (sale.updatedBy) emails.add(sale.updatedBy);
    });
    return Array.from(emails);
  }, [sales]);

  // ==================== RENDER ====================

  if (loading && sales.length === 0) {
    return (
      <div className="p-3 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="text-center text-black dark:text-white">Loading...</div>
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={`p-2 sm:p-4 min-h-screen transition-colors duration-200 ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="fixed bottom-4 right-4 z-50 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon size={20} className="text-gray-700" /> : <Sun size={20} className="text-yellow-500" />}
        </button>

        {/* Warning banner for sales without products */}
        {stats.salesWithoutProducts > 0 && (
          <div className="mb-3 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 p-3 rounded">
            <div className="flex items-start gap-2">
              <AlertTriangle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={16} />
              <div className="text-sm text-yellow-800 dark:text-yellow-300">
                <span className="font-semibold">Note:</span> {stats.salesWithoutProducts} debt record(s) without product details. 
                These sales can still be updated with payments.
              </div>
            </div>
          </div>
        )}

        {/* Restock Confirmation Modal */}
        {showRestockConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-[60]">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-sm w-full p-4 mx-2">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="text-yellow-500" size={20} />
                <h3 className="text-lg font-bold text-black dark:text-white">Confirm Sale Deletion</h3>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Would you like to restock the items from this sale back to inventory?
              </p>
              
              <div className="space-y-2">
                <button
                  onClick={() => handleDeleteSaleWithReason(showRestockConfirm, true)}
                  disabled={loading}
                  className="w-full bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  <CheckCircle size={16} />
                  Yes, delete and restock
                </button>
                
                <button
                  onClick={() => handleDeleteSaleWithReason(showRestockConfirm, false)}
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

        {/* Deletion Reason Modal */}
        {showDeletionReasonModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-[60]">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-sm w-full p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="text-yellow-500" size={20} />
                <h3 className="text-lg font-bold text-black dark:text-white">Reason for Deletion</h3>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Please provide a reason for deleting this sale (for audit purposes):
              </p>
              
              <textarea
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                placeholder="e.g., Wrong customer, Duplicate entry, Incorrect items, etc."
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-sm text-black dark:text-white bg-white dark:bg-gray-700 mb-3"
                rows={3}
              />
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowDeletionReasonModal(null);
                    setDeletionReason("");
                  }}
                  className="flex-1 bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (deletionReason.trim()) {
                      setShowRestockConfirm(showDeletionReasonModal);
                      setShowDeletionReasonModal(null);
                    } else {
                      setError("Please provide a reason for deletion");
                    }
                  }}
                  className="flex-1 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm"
                >
                  Continue to Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-black dark:text-white">Sales Management</h1>
              <p className="text-xs text-gray-600 dark:text-gray-400">Dashboard</p>
              {debugInfo && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {debugInfo} | Recently Updated: {stats.recentlyUpdatedCount}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateSaleModal(true)}
                className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 text-sm shadow"
              >
                <Plus size={16} />
                <span className="hidden xs:inline">Create Sale</span>
              </button>
              
              {/* ACCOUNTING REPORTS BUTTON */}
              <button
                onClick={() => setShowAccountingModal(true)}
                className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-1.5 text-sm shadow"
              >
                <FileSpreadsheet size={16} />
                <span className="hidden xs:inline">Reports</span>
              </button>
              
              <button
                onClick={() => {
                  const csvData = sales.map(sale => ({
                    'Sale ID': sale.id,
                    'Date': new Date(sale.date).toLocaleDateString(),
                    'Customer': sale.customer?.name || '-',
                    'Customer Phone': sale.customer?.phone || '-',
                    'Products': sale.saleitems?.map(item => `${item.product.name} (x${item.quantity})`).join('; ') || 'Debt record (no products)',
                    'Total Amount': sale.amount.toFixed(2),
                    'Amount Paid': (sale.amount - (sale.balance || sale.remainingAmount)).toFixed(2),
                    'Remaining': (sale.balance || sale.remainingAmount).toFixed(2),
                    'Status': sale.status,
                    'Has Products': sale.hasProducts ? 'Yes' : 'No',
                    'Due Date': sale.dueDate ? new Date(sale.dueDate).toLocaleDateString() : '-',
                    'Created By': sale.createdBy || '-',
                    'Updated By': sale.updatedBy || '-',
                    'Last Updated': sale.updatedAt ? new Date(sale.updatedAt).toLocaleDateString() : '-'
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
          </div>

          {/* Mobile Filter Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-3 py-1.5 rounded-lg text-sm text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Filter size={16} />
              Filters
              {isFilterActive && <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded-full text-xs">•</span>}
            </button>
            
            {isFilterActive && (
              <button
                onClick={clearFilters}
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm flex items-center gap-1"
              >
                <XCircle size={16} />
                Clear
              </button>
            )}
          </div>

          {/* Mobile Filters Panel */}
          {showMobileFilters && (
            <div className="mobile-filter-container bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Search Customer</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="Customer name or phone..."
                    value={customerFilter}
                    onChange={(e) => setCustomerFilter(e.target.value)}
                    className="w-full pl-7 pr-7 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700"
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

              {/* NEW: Created By Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Created By</label>
                <select
                  value={createdByFilter}
                  onChange={(e) => setCreatedByFilter(e.target.value)}
                  className="w-full p-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">All Users</option>
                  {uniqueCreatedBy.map(email => {
                    const user = getUserDisplayName(email);
                    return (
                      <option key={email} value={email}>
                        {user.name} ({email})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* NEW: Updated By Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Updated By</label>
                <select
                  value={updatedByFilter}
                  onChange={(e) => setUpdatedByFilter(e.target.value)}
                  className="w-full p-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">All Users</option>
                  {uniqueUpdatedBy.map(email => {
                    const user = getUserDisplayName(email);
                    return (
                      <option key={email} value={email}>
                        {user.name} ({email})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Search Product</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="Product name..."
                    value={productNameFilter}
                    onChange={(e) => setProductNameFilter(e.target.value)}
                    className="w-full pl-7 pr-7 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700"
                  />
                  {productNameFilter && (
                    <button
                      onClick={() => setProductNameFilter("")}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date Range</label>
                <div className="space-y-2">
                  <div className="flex gap-1 flex-wrap">
                    {["today", "week", "month", "all", "custom"].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setDateFilter(filter as any)}
                        className={`px-2 py-1 text-xs rounded ${
                          dateFilter === filter 
                            ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700" 
                            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        }`}
                      >
                        {filter === "all" ? "All" : 
                         filter === "today" ? "Today" : 
                         filter === "week" ? "Week" : 
                         filter === "month" ? "Month" : "Custom"}
                      </button>
                    ))}
                  </div>
                  
                  {dateFilter === "custom" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="w-full p-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700"
                        />
                      </div>
                      <div>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="w-full p-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Active Filters Display */}
          {isFilterActive && (
            <div className="flex flex-wrap gap-1.5">
              {customerFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
                  Customer: {customerFilter.length > 12 ? customerFilter.substring(0, 12) + '...' : customerFilter}
                  <button onClick={() => setCustomerFilter("")} className="text-blue-600 hover:text-blue-800">
                    <X size={10} />
                  </button>
                </span>
              )}
              {createdByFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full text-xs">
                  Created By: {getUserDisplayName(createdByFilter).name}
                  <button onClick={() => setCreatedByFilter("")} className="text-indigo-600 hover:text-indigo-800">
                    <X size={10} />
                  </button>
                </span>
              )}
              {updatedByFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-xs">
                  Updated By: {getUserDisplayName(updatedByFilter).name}
                  <button onClick={() => setUpdatedByFilter("")} className="text-purple-600 hover:text-purple-800">
                    <X size={10} />
                  </button>
                </span>
              )}
              {productNameFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-xs">
                  Product: {productNameFilter.length > 12 ? productNameFilter.substring(0, 12) + '...' : productNameFilter}
                  <button onClick={() => setProductNameFilter("")} className="text-green-600 hover:text-green-800">
                    <X size={10} />
                  </button>
                </span>
              )}
              {dateFilter !== "today" && dateFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full text-xs">
                  {dateFilter === "week" ? "Week" :
                   dateFilter === "month" ? "Month" : 
                   dateFilter === "custom" ? "Custom" : "All"}
                  <button onClick={() => setDateFilter("today")} className="text-gray-600 hover:text-gray-800">
                    <X size={10} />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-3 py-2 rounded mb-3 flex justify-between items-start text-sm">
            <div className="flex items-start gap-1.5">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <button onClick={clearMessages} className="font-bold text-red-700 dark:text-red-300 text-lg leading-none hover:text-red-900">×</button>
          </div>
        )}
        
        {success && (
          <div className="bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 px-3 py-2 rounded mb-3 flex justify-between items-start text-sm">
            <div className="flex items-start gap-1.5">
              <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
            <button onClick={clearMessages} className="font-bold text-green-700 dark:text-green-300 text-lg leading-none hover:text-green-900">×</button>
          </div>
        )}

        {/* Payment Method Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-3 p-3">
          <h2 className="text-base font-bold text-black dark:text-white mb-2">Payment Method Breakdown</h2>
          <div className="space-y-2">
            {dateFilter === "today" ? (
              <>
                <h3 className="text-sm font-semibold text-green-600 dark:text-green-400">Today's Payments</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-1 mb-1">
                      <Banknote className="text-green-600 dark:text-green-400" size={12} />
                      <span className="text-xs font-medium text-green-800 dark:text-green-300">Cash</span>
                    </div>
                    <div className="text-sm font-bold text-green-700 dark:text-green-400">Ksh {formatCurrency(stats.todayCash)}</div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-1 mb-1">
                      <Smartphone className="text-blue-600 dark:text-blue-400" size={12} />
                      <span className="text-xs font-medium text-blue-800 dark:text-blue-300">Till</span>
                    </div>
                    <div className="text-sm font-bold text-blue-700 dark:text-blue-400">Ksh {formatCurrency(stats.todayTill)}</div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-1 mb-1">
                      <Landmark className="text-purple-600 dark:text-purple-400" size={12} />
                      <span className="text-xs font-medium text-purple-800 dark:text-purple-300">Bank</span>
                    </div>
                    <div className="text-sm font-bold text-purple-700 dark:text-purple-400">Ksh {formatCurrency(stats.todayBank)}</div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-1 mb-1">
                      <DollarSign className="text-orange-600 dark:text-orange-400" size={12} />
                      <span className="text-xs font-medium text-orange-800 dark:text-orange-300">Check</span>
                    </div>
                    <div className="text-sm font-bold text-orange-700 dark:text-orange-400">Ksh {formatCurrency(stats.todayCheck)}</div>
                  </div>
                  <div className="bg-pink-50 dark:bg-pink-900/20 p-2 rounded border border-pink-200 dark:border-pink-800">
                    <div className="flex items-center gap-1 mb-1">
                      <CardIcon className="text-pink-600 dark:text-pink-400" size={12} />
                      <span className="text-xs font-medium text-pink-800 dark:text-pink-300">Card</span>
                    </div>
                    <div className="text-sm font-bold text-pink-700 dark:text-pink-400">Ksh {formatCurrency(stats.todayCard)}</div>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-1 mb-1">
                      <CreditCard className="text-yellow-600 dark:text-yellow-400" size={12} />
                      <span className="text-xs font-medium text-yellow-800 dark:text-yellow-300">Credit</span>
                    </div>
                    <div className="text-sm font-bold text-yellow-700 dark:text-yellow-400">Ksh {formatCurrency(stats.todayCredit)}</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Overall Payments</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-1 mb-1">
                      <Banknote className="text-green-600 dark:text-green-400" size={12} />
                      <span className="text-xs font-medium text-green-800 dark:text-green-300">Cash</span>
                    </div>
                    <div className="text-sm font-bold text-green-700 dark:text-green-400">Ksh {formatCurrency(stats.cashAmount)}</div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-1 mb-1">
                      <Smartphone className="text-blue-600 dark:text-blue-400" size={12} />
                      <span className="text-xs font-medium text-blue-800 dark:text-blue-300">Till</span>
                    </div>
                    <div className="text-sm font-bold text-blue-700 dark:text-blue-400">Ksh {formatCurrency(stats.tillAmount)}</div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-1 mb-1">
                      <Landmark className="text-purple-600 dark:text-purple-400" size={12} />
                      <span className="text-xs font-medium text-purple-800 dark:text-purple-300">Bank</span>
                    </div>
                    <div className="text-sm font-bold text-purple-700 dark:text-purple-400">Ksh {formatCurrency(stats.bankAmount)}</div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-1 mb-1">
                      <DollarSign className="text-orange-600 dark:text-orange-400" size={12} />
                      <span className="text-xs font-medium text-orange-800 dark:text-orange-300">Check</span>
                    </div>
                    <div className="text-sm font-bold text-orange-700 dark:text-orange-400">Ksh {formatCurrency(stats.checkAmount)}</div>
                  </div>
                  <div className="bg-pink-50 dark:bg-pink-900/20 p-2 rounded border border-pink-200 dark:border-pink-800">
                    <div className="flex items-center gap-1 mb-1">
                      <CardIcon className="text-pink-600 dark:text-pink-400" size={12} />
                      <span className="text-xs font-medium text-pink-800 dark:text-pink-300">Card</span>
                    </div>
                    <div className="text-sm font-bold text-pink-700 dark:text-pink-400">Ksh {formatCurrency(stats.cardAmount)}</div>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-1 mb-1">
                      <CreditCard className="text-yellow-600 dark:text-yellow-400" size={12} />
                      <span className="text-xs font-medium text-yellow-800 dark:text-yellow-300">Credit</span>
                    </div>
                    <div className="text-sm font-bold text-yellow-700 dark:text-yellow-400">Ksh {formatCurrency(stats.creditAmount)}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow border-l-2 border-emerald-500">
            <div className="text-xs text-gray-600 dark:text-gray-400">Total Sales</div>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">Ksh {formatCurrency(stats.totalSales)}</div>
            <div className="text-xs text-black dark:text-gray-300">{sales.length} orders</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow border-l-2 border-blue-500">
            <div className="text-xs text-gray-600 dark:text-gray-400">Fully Paid</div>
            <div className="text-base font-bold text-blue-600 dark:text-blue-400">Ksh {formatCurrency(stats.paidSales)}</div>
            <div className="text-xs text-black dark:text-gray-300">{stats.paidCount} orders</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow border-l-2 border-orange-500">
            <div className="text-xs text-gray-600 dark:text-gray-400">Partial</div>
            <div className="text-base font-bold text-orange-600 dark:text-orange-400">Ksh {formatCurrency(stats.partialSales)}</div>
            <div className="text-xs text-black dark:text-gray-300">{stats.partialCount} orders</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow border-l-2 border-red-500">
            <div className="text-xs text-gray-600 dark:text-gray-400">Unpaid</div>
            <div className="text-base font-bold text-red-600 dark:text-red-400">Ksh {formatCurrency(stats.unpaidSales)}</div>
            <div className="text-xs text-black dark:text-gray-300">{stats.unpaidCount} orders</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow border-l-2 border-yellow-500">
            <div className="text-xs text-gray-600 dark:text-gray-400">Recently Updated</div>
            <div className="text-base font-bold text-yellow-600 dark:text-yellow-400">Ksh {formatCurrency(stats.recentlyUpdatedAmount)}</div>
            <div className="text-xs text-black dark:text-gray-300">{stats.recentlyUpdatedCount} orders</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow border-l-2 border-purple-500">
            <div className="text-xs text-gray-600 dark:text-gray-400">Outstanding Amount</div>
            <div className="text-base font-bold text-purple-600 dark:text-purple-400">Ksh {formatCurrency(stats.totalOutstanding)}</div>
            <div className="text-xs text-black dark:text-gray-300">Total remaining</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow border-l-2 border-green-500">
            <div className="text-xs text-gray-600 dark:text-gray-400">Today's Sales</div>
            <div className="text-base font-bold text-green-600 dark:text-green-400">Ksh {formatCurrency(stats.todaySales)}</div>
            <div className="text-xs text-black dark:text-gray-300">{stats.todayCount} orders</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow border-l-2 border-teal-500">
            <div className="text-xs text-gray-600 dark:text-gray-400">Today's Outstanding</div>
            <div className="text-base font-bold text-teal-600 dark:text-teal-400">Ksh {formatCurrency(stats.todayOutstanding)}</div>
            <div className="text-xs text-black dark:text-gray-300">Remaining today</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-3">
          <div className="flex overflow-x-auto scrollbar-thin border-b dark:border-gray-700">
            {[
              { key: "overview", label: "All", count: sales.length, icon: null },
              { key: "paid", label: "Paid", count: stats.paidCount, icon: null },
              { key: "partial", label: "Partial", count: stats.partialCount, icon: null },
              { key: "unpaid", label: "Unpaid", count: stats.unpaidCount, icon: null },
              { key: "recentlyUpdated", label: "Recent", count: stats.recentlyUpdatedCount, icon: null },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex-shrink-0 px-3 py-2.5 text-center transition-colors whitespace-nowrap min-w-[70px] ${
                  activeTab === tab.key
                    ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 font-semibold"
                    : "text-black dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                <div className="flex flex-col items-center">
                  <span className="text-xs">{tab.label}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">({tab.count})</span>
                </div>
              </button>
            ))}
            
            {/* Deleted Sales Tab */}
            <button
              onClick={() => {
                setShowDeletedModal(true);
                fetchDeletedSales();
              }}
              className="flex-shrink-0 px-3 py-2.5 text-center transition-colors whitespace-nowrap min-w-[70px] text-black dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-200"
            >
              <div className="flex flex-col items-center">
                <Archive size={16} />
                <span className="text-xs mt-1">Deleted</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">({deletedSalesTotal})</span>
              </div>
            </button>
          </div>

          <div className="p-2">
            {activeTab === "recentlyUpdated" && (
              <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="text-xs text-blue-800 dark:text-blue-300">
                  <div className="font-semibold">Recently Updated Sales Filter:</div>
                  <div className="mt-1">
                    • Shows sales updated in the last 7 days
                    <br />
                    • Excludes sales that were only created (not modified)
                    <br />
                    • Total matching: {sortedFilteredSales.length} sales
                  </div>
                </div>
              </div>
            )}

            <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <Calendar size={12} />
                <span className="font-semibold">Showing: </span>
                {dateFilter === "today" ? "Today's transactions" :
                 dateFilter === "week" ? "Last 7 days" :
                 dateFilter === "month" ? "Last 30 days" :
                 dateFilter === "custom" ? `Custom: ${customStartDate} to ${customEndDate}` :
                 "All transactions"}
                <span className="ml-2 text-gray-500 dark:text-gray-400">
                  ({sortedFilteredSales.length} sales, Ksh {formatCurrency(sortedFilteredSales.reduce((acc, s) => acc + Number(s.amount), 0))})
                </span>
              </div>
              {productNameFilter && (
                <div className="text-xs text-purple-600 dark:text-purple-400 mt-1 flex items-center gap-1">
                  <Search size={10} />
                  Filtering by product: "{productNameFilter}" 
                  ({sortedFilteredSales.length} sales containing this product)
                </div>
              )}
            </div>

            {/* Sales List */}
            <div className="space-y-2">
              {sortedFilteredSales.map((sale) => (
                <div key={sale.id} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-3 shadow-sm">
                  {/* Warning for sales without products */}
                  {!sale.hasProducts && sale.warning && (
                    <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded text-xs text-yellow-800 dark:text-yellow-300">
                      <div className="flex items-start gap-1">
                        <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                        <span>{sale.warning}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-2">
                    <div>
                      {/* Sale ID Display */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400">
                          #{sale.id}
                        </span>
                        <h3 className="font-semibold text-black dark:text-white text-sm truncate max-w-[150px]">
                          {sale.customer?.name || "-"}
                        </h3>
                      </div>
                      {sale.customer?.phone && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{sale.customer.phone}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        sale.status === "PAID" ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300" :
                        sale.status === "PARTIAL" ? "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-300" :
                        "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300"
                      }`}>
                        {sale.status}
                      </span>
                      
                      {isRecentlyUpdated(sale) && isSaleModified(sale) && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800 font-medium">
                          Updated
                        </span>
                      )}
                      
                      {!sale.hasProducts && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                          Debt Only
                        </span>
                      )}
                      
                      <button
                        onClick={() => setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id)}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        {expandedSaleId === sale.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 ml-1">Ksh {formatCurrency(sale.amount)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Remaining:</span>
                      <span className="font-semibold text-red-600 dark:text-red-400 ml-1">Ksh {formatCurrency(sale.balance || sale.remainingAmount)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Date:</span>
                      <span className="ml-1 text-black dark:text-gray-300">{formatDate(sale.date)}</span>
                    </div>
                    {sale.dueDate && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Due:</span>
                        <span className="ml-1 text-black dark:text-gray-300">{formatDate(sale.dueDate)}</span>
                      </div>
                    )}
                  </div>

                  {sale.payments && sale.payments.length > 0 && (
                    <div className="mb-2">
                      <div className="flex flex-wrap gap-1">
                        {sale.payments.slice(0, 3).map((payment, idx) => {
                          const IconComponent = paymentMethods.find(m => m.value === payment.method)?.icon || Banknote;
                          return (
                            <span key={idx} className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                              paymentMethods.find(m => m.value === payment.method)?.color || "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
                            }`}>
                              <IconComponent size={10} />
                              <span>{payment.method}</span>
                              {payment.amount > 0 && (
                                <span className="font-semibold">Ksh {formatCurrency(payment.amount)}</span>
                              )}
                            </span>
                          );
                        })}
                        {sale.payments.length > 3 && (
                          <span className="text-gray-500 dark:text-gray-400 text-xs px-2 py-1">+{sale.payments.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  {sale.updatedAt && sale.updatedBy && (
                    <div className="mt-1 mb-2">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Updated:</span>
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          {formatDate(sale.updatedAt)} at {formatTime(sale.updatedAt)}
                        </span>
                        <span className="text-blue-600 dark:text-blue-400">
                          by {getUserDisplayName(sale.updatedBy).name}
                        </span>
                      </div>
                    </div>
                  )}

                  {expandedSaleId === sale.id && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
                      {sale.saleitems && sale.saleitems.length > 0 ? (
                        <div className="text-xs">
                          <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">Products:</div>
                          <div className="space-y-1">
                            {sale.saleitems.map((item, idx) => (
                              <div key={idx} className="text-black dark:text-gray-300 flex justify-between">
                                <span className="truncate max-w-[120px]">{item.product.name}</span>
                                <span>×{item.quantity} @ Ksh {formatCurrency(item.price)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs bg-gray-50 dark:bg-gray-700/50 p-2 rounded text-center text-gray-500 dark:text-gray-400">
                          No product details available for this debt record.
                          <br />
                          Financial data is preserved separately.
                        </div>
                      )}

                      {(sale.createdBy || sale.updatedBy) && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {sale.createdBy && (
                            <div className="flex items-start gap-1 mb-1">
                              <User size={10} className="text-blue-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="font-medium">Created by: </span>
                                <span className="text-blue-600 dark:text-blue-400">{getUserDisplayName(sale.createdBy).name}</span>
                              </div>
                            </div>
                          )}
                          {sale.updatedBy && sale.updatedBy !== sale.createdBy && (
                            <div className="flex items-start gap-1">
                              <User size={10} className="text-green-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="font-medium">Updated by: </span>
                                <span className="text-green-600 dark:text-green-400">{getUserDisplayName(sale.updatedBy).name}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Audit Log Button */}
                      <button
                        onClick={() => handleViewAuditLog(sale)}
                        className="w-full mt-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1.5 rounded text-xs flex items-center justify-center gap-1 transition-colors"
                      >
                        <History size={12} />
                        View Audit History
                      </button>
                    </div>
                  )}

                  <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-4 gap-1">
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
                        onClick={() => showDeleteConfirmationWithReason(sale.id)}
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
              ))}
              
              {sortedFilteredSales.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                  {activeTab === "recentlyUpdated" ? (
                    <div>
                      <div className="mb-2">No recently updated sales found.</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        This filter shows sales that were:
                        <br />• Updated in the last 7 days
                        <br />• Actually modified (not just created)
                      </div>
                    </div>
                  ) : isFilterActive ? (
                    "No sales match your filters"
                  ) : (
                    "No sales found"
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Create Sale Modal - Updated payment methods */}
        {showCreateSaleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-2 z-50 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto mt-2">
              <div className="p-3 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-bold text-black dark:text-white">Create New Sale</h2>
                  <button
                    onClick={() => setShowCreateSaleModal(false)}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-3 space-y-4">
                {/* Sale Date */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <label className="block text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                    Sale Date {new Date(newSaleDate).toDateString() !== new Date().toDateString() && 
                      <span className="text-xs text-orange-600 dark:text-orange-400 ml-2">(Backdated Sale)</span>
                    }
                  </label>
                  <input
                    type="date"
                    value={newSaleDate}
                    onChange={(e) => setNewSaleDate(e.target.value)}
                    className="w-full p-2 border border-blue-300 dark:border-blue-700 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                    max={new Date().toISOString().split('T')[0]}
                  />
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {new Date(newSaleDate).toDateString() === new Date().toDateString() 
                      ? "Today's sale" 
                      : "Backdated sale - will be recorded on the selected date"}
                  </p>
                </div>

                {/* Customer Selection */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 text-black dark:text-white">Select Customer</h3>
                  <div className="relative new-sale-customer-dropdown">
                    <input
                      type="text"
                      placeholder="Search customer..."
                      value={newSaleCustomerSearch}
                      onChange={(e) => {
                        setNewSaleCustomerSearch(e.target.value);
                        setNewSaleShowCustomerDropdown(true);
                      }}
                      onFocus={() => setNewSaleShowCustomerDropdown(true)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                    />
                    {newSaleShowCustomerDropdown && newSaleFilteredCustomers.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {newSaleFilteredCustomers.map(customer => (
                          <div
                            key={customer.id}
                            onClick={() => {
                              setNewSaleCustomerId(customer.id);
                              setNewSaleCustomerSearch(customer.name);
                              setNewSaleShowCustomerDropdown(false);
                            }}
                            className="p-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0 text-sm"
                          >
                            <div className="font-medium text-black dark:text-white truncate">{customer.name}</div>
                            {customer.phone && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">{customer.phone}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {newSaleCustomerId && (
                    <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                      Selected: {customers.find(c => c.id === newSaleCustomerId)?.name}
                    </div>
                  )}
                </div>

                {/* Sale Items */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 text-black dark:text-white flex items-center gap-1">
                    <Calculator size={16} />
                    Sale Items
                  </h3>
                  
                  <div className="space-y-2 mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <h4 className="font-medium text-black dark:text-white text-xs">Add Item</h4>
                    <div className="space-y-2">
                      <div className="relative new-sale-product-dropdown">
                        <input
                          type="text"
                          placeholder="Search product..."
                          value={newSaleProductSearch}
                          onChange={(e) => {
                            setNewSaleProductSearch(e.target.value);
                            setNewSaleShowProductDropdown(true);
                          }}
                          onFocus={() => setNewSaleShowProductDropdown(true)}
                          className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                        />
                        {newSaleShowProductDropdown && newSaleFilteredProducts.length > 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                            {newSaleFilteredProducts.map(product => {
                              let productStock = 0;
                              if (Array.isArray(product.stock)) {
                                productStock = product.stock.reduce((total: number, s: any) => total + (s.quantity || 0), 0);
                              } else if (typeof product.stock === 'object' && product.stock !== null) {
                                productStock = (product.stock as any).quantity || 0;
                              } else {
                                productStock = Number(product.stock) || 0;
                              }
                              return (
                                <div
                                  key={product.id}
                                  onClick={() => {
                                    setNewSaleCurrentItem({
                                      ...newSaleCurrentItem,
                                      productId: product.id,
                                      price: product.price || 0,
                                      productName: product.name
                                    });
                                    setNewSaleProductSearch(product.name);
                                    setNewSaleShowProductDropdown(false);
                                  }}
                                  className="p-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0 text-sm"
                                >
                                  <div className="font-medium text-black dark:text-white truncate">{product.name}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">Price: Ksh {formatCurrency(product.price || 0)} | Stock: {productStock}</div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <input
                            type="number"
                            min="1"
                            value={newSaleCurrentItem.quantity || ''}
                            onChange={(e) => setNewSaleCurrentItem({...newSaleCurrentItem, quantity: parseInt(e.target.value) || 1})}
                            placeholder="Qty"
                            className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                          />
                        </div>
                        
                        <div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={newSaleCurrentItem.price || ''}
                            onChange={(e) => setNewSaleCurrentItem({...newSaleCurrentItem, price: parseFloat(e.target.value) || 0})}
                            placeholder="Price"
                            className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                          />
                        </div>
                      </div>
                      
                      <button
                        onClick={handleAddItemToNewSale}
                        disabled={!newSaleCurrentItem.productId || newSaleCurrentItem.quantity <= 0 || newSaleCurrentItem.price <= 0}
                        className="w-full bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600 disabled:opacity-50 text-sm flex items-center justify-center gap-1"
                      >
                        <Plus size={14} />
                        Add Item
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {newSaleItems.map((item, index) => (
                      <div key={index} className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded border text-sm">
                        <div className="flex justify-between items-center mb-1">
                          <div className="font-medium text-black dark:text-white truncate">{item.productName}</div>
                          <button
                            onClick={() => setNewSaleItems(newSaleItems.filter((_, i) => i !== index))}
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
                              const newItems = [...newSaleItems];
                              newItems[index].quantity = parseInt(e.target.value) || 1;
                              setNewSaleItems(newItems);
                            }}
                            className="w-full p-1 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-xs"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => {
                              const newItems = [...newSaleItems];
                              newItems[index].price = parseFloat(e.target.value) || 0;
                              setNewSaleItems(newItems);
                            }}
                            className="w-full p-1 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-xs"
                          />
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Subtotal: Ksh {formatCurrency(item.quantity * item.price)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-200 dark:border-blue-800 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-black dark:text-white text-sm">Total:</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        Ksh {formatCurrency(newSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payments */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 text-black dark:text-white">Payments</h3>
                  
                  {newSalePayments.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {newSalePayments.map((payment, index) => (
                        <div key={index} className="flex justify-between items-center bg-white dark:bg-gray-700 p-2 rounded border text-sm">
                          <div className="flex items-center gap-1">
                            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                              paymentMethods.find(m => m.value === payment.method)?.color
                            }`}>
                              {payment.method}
                            </span>
                            {payment.amount !== "0" && (
                              <span className="font-medium">Ksh {formatCurrency(parseFloat(payment.amount))}</span>
                            )}
                            {payment.dueDate && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">Due: {formatDate(payment.dueDate)}</span>
                            )}
                          </div>
                          <button
                            onClick={() => setNewSalePayments(newSalePayments.filter((_, i) => i !== index))}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <select
                          value={newSaleCurrentPayment.method}
                          onChange={(e) => setNewSaleCurrentPayment({...newSaleCurrentPayment, method: e.target.value as any})}
                          className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
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
                          value={newSaleCurrentPayment.amount}
                          onChange={(e) => setNewSaleCurrentPayment({...newSaleCurrentPayment, amount: e.target.value})}
                          placeholder="Amount"
                          className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                          disabled={newSaleCurrentPayment.method === "CREDIT"}
                        />
                      </div>
                    </div>
                    
                    {["TILL", "BANK", "CARD"].includes(newSaleCurrentPayment.method) && (
                      <input
                        type="text"
                        value={newSaleCurrentPayment.referenceId}
                        onChange={(e) => setNewSaleCurrentPayment({...newSaleCurrentPayment, referenceId: e.target.value})}
                        placeholder="Reference ID"
                        className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                      />
                    )}
                    
                    {newSaleCurrentPayment.method === "CHECK" && (
                      <input
                        type="date"
                        value={newSaleCurrentPayment.checkDepositDate}
                        onChange={(e) => setNewSaleCurrentPayment({...newSaleCurrentPayment, checkDepositDate: e.target.value})}
                        className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                      />
                    )}
                    
                    {newSaleCurrentPayment.method === "CREDIT" && (
                      <input
                        type="date"
                        value={newSaleCurrentPayment.dueDate}
                        onChange={(e) => setNewSaleCurrentPayment({...newSaleCurrentPayment, dueDate: e.target.value})}
                        className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                      />
                    )}
                    
                    <button
                      onClick={handleAddPaymentToNewSale}
                      className="w-full bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600 text-sm flex items-center justify-center gap-1"
                    >
                      <Plus size={14} />
                      Add Payment
                    </button>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg text-sm mt-2">
                    <div className="flex justify-between mb-1">
                      <span>Total Sale:</span>
                      <span className="font-bold">Ksh {formatCurrency(newSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0))}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>Total Payments:</span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        Ksh {formatCurrency(newSalePayments.reduce((sum, p) => sum + Number(p.amount), 0))}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t">
                      <span>Remaining:</span>
                      <span className={`font-bold ${
                        Math.max(0, newSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0) - newSalePayments.reduce((sum, p) => sum + Number(p.amount), 0)) > 0 
                          ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      }`}>
                        Ksh {formatCurrency(Math.max(0, newSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0) - newSalePayments.reduce((sum, p) => sum + Number(p.amount), 0)))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t dark:border-gray-700">
                  <button
                    onClick={() => setShowCreateSaleModal(false)}
                    disabled={loading}
                    className="flex-1 bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600 disabled:opacity-50 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateSale}
                    disabled={loading || !newSaleCustomerId || newSaleItems.length === 0}
                    className="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center justify-center gap-1"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Create Sale
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Sale Modal - UPDATED for payment-only updates and removed messaging */}
        {editingSale && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-2 z-50 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto mt-2">
              <div className="p-3 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-bold text-black dark:text-white">
                    {editingSale.hasProducts ? `Edit Sale #${editingSale.id}` : `Update Payment - Sale #${editingSale.id}`}
                  </h2>
                  <button
                    onClick={() => setEditingSale(null)}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-3 space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                  <h3 className="font-semibold mb-2 text-black dark:text-white text-sm">Sale Information</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Sale ID:</span>
                      <div className="font-mono font-medium text-blue-600 dark:text-blue-400">#{editingSale.id}</div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Customer:</span>
                      <div className="font-medium text-black dark:text-white truncate">{editingSale.customer.name}</div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Date:</span>
                      <div className="text-black dark:text-white">{formatDate(editingSale.date)}</div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Total Amount:</span>
                      <div className="font-semibold text-emerald-600 dark:text-emerald-400">Ksh {formatCurrency(editingSale.amount)}</div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Remaining:</span>
                      <div className="font-semibold text-red-600 dark:text-red-400">Ksh {formatCurrency(editingSale.balance || editingSale.remainingAmount)}</div>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-600 dark:text-gray-400">Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-bold ${
                        editingSale.status === "PAID" ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300" :
                        editingSale.status === "PARTIAL" ? "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-300" :
                        "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300"
                      }`}>
                        {editingSale.status}
                      </span>
                    </div>
                  </div>

                  {!editingSale.hasProducts && (
                    <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded text-xs text-yellow-800 dark:text-yellow-300">
                      <div className="flex items-start gap-1">
                        <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                        <span>This is a debt record with no product details. You can only update payments.</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Only show product editing for sales that have products */}
                {editingSale.hasProducts && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-black dark:text-white flex items-center gap-1">
                      <Calculator size={16} />
                      Edit Sale Items
                    </h3>
                    
                    <div className="space-y-2 mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <h4 className="font-medium text-black dark:text-white text-xs">Add New Item</h4>
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
                            className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                          />
                          {showProductDropdown && filteredProducts.length > 0 && (
                            <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
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
                                  className="p-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0 text-sm"
                                >
                                  <div className="font-medium text-black dark:text-white truncate">{product.name}</div>
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
                              className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
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
                              className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
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

                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {editSaleItems.map((item, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded border text-sm">
                          <div className="flex justify-between items-center mb-1">
                            <div className="font-medium text-black dark:text-white truncate">{item.productName}</div>
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
                              className="w-full p-1 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-xs"
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
                              className="w-full p-1 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-xs"
                            />
                          </div>
                          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Subtotal: Ksh {formatCurrency(item.quantity * item.price)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {editSaleItems.length > 0 && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-200 dark:border-blue-800 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-black dark:text-white text-sm">New Total:</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400">
                            Ksh {formatCurrency(editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0))}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Payment Section - Always shown */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 text-black dark:text-white">Payments</h3>
                  
                  {editPayments.length > 0 && (
                    <div className="space-y-1 mb-3 max-h-40 overflow-y-auto">
                      {editPayments.map((payment, index) => (
                        <div key={index} className="flex justify-between items-center bg-white dark:bg-gray-700 p-2 rounded border text-sm">
                          <div className="flex items-center gap-1">
                            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                              paymentMethods.find(m => m.value === payment.method)?.color
                            }`}>
                              {payment.method}
                            </span>
                            {payment.amount !== "0" && (
                              <span className="font-medium">Ksh {formatCurrency(parseFloat(payment.amount))}</span>
                            )}
                            {payment.dueDate && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">Due: {formatDate(payment.dueDate)}</span>
                            )}
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

                  <div className="space-y-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <select
                          value={currentPayment.method}
                          onChange={(e) => setCurrentPayment({...currentPayment, method: e.target.value as any})}
                          className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
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
                          className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                          disabled={currentPayment.method === "CREDIT"}
                        />
                      </div>
                    </div>
                    
                    {["TILL", "BANK", "CARD"].includes(currentPayment.method) && (
                      <input
                        type="text"
                        value={currentPayment.referenceId}
                        onChange={(e) => setCurrentPayment({...currentPayment, referenceId: e.target.value})}
                        placeholder="Reference ID"
                        className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                      />
                    )}
                    
                    {currentPayment.method === "CHECK" && (
                      <input
                        type="date"
                        value={currentPayment.checkDepositDate}
                        onChange={(e) => setCurrentPayment({...currentPayment, checkDepositDate: e.target.value})}
                        className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                      />
                    )}
                    
                    {currentPayment.method === "CREDIT" && (
                      <input
                        type="date"
                        value={currentPayment.dueDate}
                        onChange={(e) => setCurrentPayment({...currentPayment, dueDate: e.target.value})}
                        className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
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

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg text-sm mt-2">
                    <div className="flex justify-between mb-1">
                      <span>Total Sale:</span>
                      <span className="font-bold">Ksh {formatCurrency(editingSale.amount)}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>Total Payments:</span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        Ksh {formatCurrency(editPayments.reduce((sum, p) => sum + Number(p.amount), 0))}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t">
                      <span>Remaining:</span>
                      <span className={`font-bold ${
                        Math.max(0, editingSale.amount - editPayments.reduce((sum, p) => sum + Number(p.amount), 0)) > 0 
                          ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      }`}>
                        Ksh {formatCurrency(Math.max(0, editingSale.amount - editPayments.reduce((sum, p) => sum + Number(p.amount), 0)))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t dark:border-gray-700">
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
                        {editingSale.hasProducts ? "Saving..." : "Adding Payment..."}
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        {editingSale.hasProducts ? "Update Sale" : "Add Payment"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Deleted Sales Modal */}
        {showDeletedModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-2 z-50 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto mt-2">
              <div className="p-3 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-bold text-black dark:text-white flex items-center gap-2">
                    <Archive size={20} />
                    Deleted Sales Archive
                  </h2>
                  <button
                    onClick={() => {
                      setShowDeletedModal(false);
                      setDeletedSales([]);
                    }}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-3 space-y-3">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          type="text"
                          placeholder="Search by customer, deleter, or items..."
                          value={deletedSearchTerm}
                          onChange={(e) => {
                            setDeletedSearchTerm(e.target.value);
                            setDeletedSalesPage(1);
                            fetchDeletedSales();
                          }}
                          className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Deleted Date</label>
                      <select
                        value={deletedDateFilter}
                        onChange={(e) => {
                          setDeletedDateFilter(e.target.value as any);
                          setDeletedSalesPage(1);
                          fetchDeletedSales();
                        }}
                        className="w-full p-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700"
                      >
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="week">Last 7 Days</option>
                        <option value="month">Last 30 Days</option>
                        <option value="custom">Custom Range</option>
                      </select>
                    </div>
                  </div>
                  
                  {deletedDateFilter === "custom" && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={deletedCustomStartDate}
                        onChange={(e) => {
                          setDeletedCustomStartDate(e.target.value);
                          fetchDeletedSales();
                        }}
                        className="p-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700"
                        placeholder="Start Date"
                      />
                      <input
                        type="date"
                        value={deletedCustomEndDate}
                        onChange={(e) => {
                          setDeletedCustomEndDate(e.target.value);
                          fetchDeletedSales();
                        }}
                        className="p-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700"
                        placeholder="End Date"
                      />
                    </div>
                  )}
                </div>

                {deletedSalesLoading ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading deleted sales...</div>
                ) : deletedSales.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">No deleted sales found</div>
                ) : (
                  <div className="space-y-3">
                    {deletedSales.map((deletedSale) => (
                      <div key={deletedSale.id} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-3 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-black dark:text-white text-sm">
                                #{deletedSale.originalSaleId} - {deletedSale.customerName}
                              </h3>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                deletedSale.statusAtDeletion === "PAID" ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300" :
                                deletedSale.statusAtDeletion === "PARTIAL" ? "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-300" :
                                "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300"
                              }`}>
                                {deletedSale.statusAtDeletion}
                              </span>
                              {deletedSale.restockedItems && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300">
                                  Restocked
                                </span>
                              )}
                              {deletedSale.expiresAt && new Date(deletedSale.expiresAt) < new Date() ? (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300">
                                  Expired
                                </span>
                              ) : deletedSale.expiresAt && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300">
                                  Expires: {formatDate(deletedSale.expiresAt)}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Original Date: {formatDate(deletedSale.saleDate)} | 
                              Deleted: {formatDateTime(deletedSale.deletedAt)}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setShowDeleteDetailsModal(deletedSale)}
                              className="p-1 text-blue-600 dark:text-blue-400 hover:text-blue-800"
                              title="View Details"
                            >
                              <Info size={16} />
                            </button>
                            {!deletedSale.restoredAt && new Date(deletedSale.expiresAt) > new Date() && (
                              <button
                                onClick={() => handleRestoreSale(deletedSale.id)}
                                disabled={restoringSaleId === deletedSale.id}
                                className="p-1 text-green-600 dark:text-green-400 hover:text-green-800 disabled:opacity-50"
                                title="Restore Sale"
                              >
                                {restoringSaleId === deletedSale.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                                ) : (
                                  <RotateCcw size={16} />
                                )}
                              </button>
                            )}
                            {deletedSale.restoredAt && (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300">
                                Restored {formatDate(deletedSale.restoredAt)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Total Amount:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 ml-1">
                              Ksh {formatCurrency(deletedSale.totalAmount)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Deleted By:</span>
                            <span className="font-medium text-red-600 dark:text-red-400 ml-1">
                              {getUserDisplayName(deletedSale.deletedBy).name}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                          <div className="font-medium">Items:</div>
                          <div className="truncate">{deletedSale.saleItemsSummary}</div>
                        </div>

                        {deletedSale.deletionReason && (
                          <div className="text-xs bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-800">
                            <span className="font-medium">Reason for deletion:</span> {deletedSale.deletionReason}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {deletedSalesTotal > 50 && (
                      <div className="flex justify-center gap-2 mt-4">
                        <button
                          onClick={() => {
                            setDeletedSalesPage(Math.max(1, deletedSalesPage - 1));
                            fetchDeletedSales();
                          }}
                          disabled={deletedSalesPage === 1}
                          className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Page {deletedSalesPage} of {Math.ceil(deletedSalesTotal / 50)}
                        </span>
                        <button
                          onClick={() => {
                            setDeletedSalesPage(deletedSalesPage + 1);
                            fetchDeletedSales();
                          }}
                          disabled={deletedSalesPage >= Math.ceil(deletedSalesTotal / 50)}
                          className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Deleted Sale Details Modal */}
        {showDeleteDetailsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-[70]">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto">
              <div className="p-3 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-black dark:text-white">Deleted Sale Details</h3>
                  <button
                    onClick={() => setShowDeleteDetailsModal(null)}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="p-3 space-y-3">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2">Sale Information</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Original ID:</span>
                      <span className="ml-1 font-medium">#{showDeleteDetailsModal.originalSaleId}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Customer:</span>
                      <span className="ml-1">{showDeleteDetailsModal.customerName}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Phone:</span>
                      <span className="ml-1">{showDeleteDetailsModal.customerPhone || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Total:</span>
                      <span className="ml-1 font-bold text-emerald-600 dark:text-emerald-400">
                        Ksh {formatCurrency(showDeleteDetailsModal.totalAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Original Date:</span>
                      <span className="ml-1">{formatDate(showDeleteDetailsModal.saleDate)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Status at Deletion:</span>
                      <span className={`ml-1 px-2 py-0.5 rounded text-xs ${
                        showDeleteDetailsModal.statusAtDeletion === "PAID" ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300" :
                        showDeleteDetailsModal.statusAtDeletion === "PARTIAL" ? "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-300" :
                        "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300"
                      }`}>
                        {showDeleteDetailsModal.statusAtDeletion}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2 text-red-800 dark:text-red-300">Deletion Information</h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Deleted By:</span>
                      <span className="ml-1 font-medium text-red-700 dark:text-red-400">
                        {getUserDisplayName(showDeleteDetailsModal.deletedBy).name}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Deleted At:</span>
                      <span className="ml-1">{formatDateTime(showDeleteDetailsModal.deletedAt)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Items Restocked:</span>
                      <span className={`ml-1 font-medium ${showDeleteDetailsModal.restockedItems ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {showDeleteDetailsModal.restockedItems ? "Yes" : "No"}
                      </span>
                    </div>
                    {showDeleteDetailsModal.deletionReason && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Reason:</span>
                        <div className="mt-1 p-2 bg-white dark:bg-gray-700 rounded border text-gray-700 dark:text-gray-300">
                          {showDeleteDetailsModal.deletionReason}
                        </div>
                      </div>
                    )}
                    {showDeleteDetailsModal.restoredAt && (
                      <>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Restored By:</span>
                          <span className="ml-1 font-medium text-green-700 dark:text-green-400">
                            {getUserDisplayName(showDeleteDetailsModal.restoredBy).name}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Restored At:</span>
                          <span className="ml-1">{formatDateTime(showDeleteDetailsModal.restoredAt)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2">Items Sold</h4>
                  <div className="text-sm space-y-1">
                    {showDeleteDetailsModal.saleItemsSummary.split(', ').map((item, idx) => (
                      <div key={idx} className="text-gray-700 dark:text-gray-300">• {item}</div>
                    ))}
                  </div>
                </div>

                {showDeleteDetailsModal.paymentsSummary && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                    <h4 className="font-semibold text-sm mb-2">Payments</h4>
                    <div className="text-sm space-y-1">
                      {showDeleteDetailsModal.paymentsSummary.split(', ').map((payment, idx) => (
                        <div key={idx} className="text-gray-700 dark:text-gray-300">• {payment}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Audit Log Modal */}
        {showAuditModal && selectedSaleForAudit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-[70]">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-3 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-black dark:text-white flex items-center gap-2">
                    <History size={20} />
                    Audit History - Sale #{selectedSaleForAudit.id}
                  </h3>
                  <button
                    onClick={() => {
                      setShowAuditModal(false);
                      setSelectedSaleForAudit(null);
                      setAuditLogs([]);
                    }}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="p-3">
                {auditLogsLoading ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading audit logs...</div>
                ) : auditLogs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">No audit records found for this sale</div>
                ) : (
                  <div className="space-y-3">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="border dark:border-gray-700 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                              log.action === "CREATE" ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300" :
                              log.action === "UPDATE" ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300" :
                              log.action === "DELETE" ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300" :
                              "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-300"
                            }`}>
                              {log.action}
                            </span>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {formatDateTime(log.changedAt)}
                            </div>
                          </div>
                          <div className="text-xs text-right">
                            <div className="font-medium text-gray-700 dark:text-gray-300">By: {getUserDisplayName(log.changedBy).name}</div>
                            {log.ipAddress && <div className="text-gray-400">IP: {log.ipAddress}</div>}
                          </div>
                        </div>
                        
                        {log.fieldName && (
                          <div className="text-sm mt-2">
                            <div className="font-medium text-gray-700 dark:text-gray-300">Field: {log.fieldName}</div>
                            <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                              <div className="bg-red-50 dark:bg-red-900/20 p-1 rounded">
                                <span className="text-red-600 dark:text-red-400">Old: </span>
                                <span className="text-gray-700 dark:text-gray-300">{log.oldValue || "-"}</span>
                              </div>
                              <div className="bg-green-50 dark:bg-green-900/20 p-1 rounded">
                                <span className="text-green-600 dark:text-green-400">New: </span>
                                <span className="text-gray-700 dark:text-gray-300">{log.newValue || "-"}</span>
                              </div>
                            </div>
                            {log.difference && (
                              <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                                {log.difference}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {log.notes && (
                          <div className="mt-2 text-xs bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                            <span className="font-medium">Note:</span> {log.notes}
                          </div>
                        )}
                        
                        {log.snapshot && (
                          <details className="mt-2">
                            <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer">View Full Snapshot</summary>
                            <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.snapshot, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== ACCOUNTING REPORTS MODAL ==================== */}
        {/* ==================== ACCOUNTING REPORTS MODAL - COMPLETE ==================== */}
{showAccountingModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-[60]">
    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
      <div className="p-3 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-black dark:text-white flex items-center gap-2">
            <FileSpreadsheet size={20} />
            Accounting Reports
          </h3>
          <button
            onClick={() => {
              setShowAccountingModal(false);
              setAccountingCustomerSearch("");
              setAccountingCustomerId("");
            }}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>
      </div>
      
      <div className="p-3 space-y-4">
        {/* Report Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Select Report Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setAccountingReportType("daily")}
              className={`px-3 py-2 text-sm rounded-lg transition ${
                accountingReportType === "daily"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              Daily Report
            </button>
            <button
              onClick={() => setAccountingReportType("weekly")}
              className={`px-3 py-2 text-sm rounded-lg transition ${
                accountingReportType === "weekly"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              Weekly Report
            </button>
            <button
              onClick={() => setAccountingReportType("monthly")}
              className={`px-3 py-2 text-sm rounded-lg transition ${
                accountingReportType === "monthly"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              Monthly Report
            </button>
           
            
           
          </div>
        </div>

        {/* Info Box - Explains what each report shows */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Info size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800 dark:text-blue-300">
              <p className="font-semibold mb-1">What each report shows:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li><strong>Daily/Weekly/Monthly:</strong> All payments received during period with previous balances</li>
                <li><strong>Outstanding Debts:</strong> All UNPAID and PARTIAL sales with aging analysis</li>
                <li><strong>Customer History:</strong> Complete transaction history with running balance</li>
                <li><strong>Payment Activity:</strong> Sales that received payments in selected period</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Daily/Weekly/Monthly Report Fields */}
        {(accountingReportType === "daily" || accountingReportType === "weekly" || accountingReportType === "monthly") && (
          <>
            {accountingReportType === "daily" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Date
                </label>
                <input
                  type="date"
                  value={accountingDate}
                  onChange={(e) => setAccountingDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Shows all payments received and previous balances for this day
                </p>
              </div>
            )}

            {accountingReportType === "weekly" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Week Start Date
                  </label>
                  <input
                    type="date"
                    value={accountingStartDate}
                    onChange={(e) => setAccountingStartDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Week End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={accountingEndDate}
                    onChange={(e) => setAccountingEndDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Shows weekly breakdown of payments received
                </p>
              </>
            )}

            {accountingReportType === "monthly" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Month Start Date
                  </label>
                  <input
                    type="date"
                    value={accountingStartDate}
                    onChange={(e) => setAccountingStartDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Month End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={accountingEndDate}
                    onChange={(e) => setAccountingEndDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Shows monthly summary with payment trends
                </p>
              </>
            )}
          </>
        )}

        {/* Outstanding Debts Fields */}
        {accountingReportType === "outstanding" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              As of Date
            </label>
            <input
              type="date"
              value={accountingDate}
              onChange={(e) => setAccountingDate(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Shows all unpaid and partially paid sales up to this date with days overdue
            </p>
          </div>
        )}

        {/* Payment Activity Fields */}
        {accountingReportType === "payment-activity" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Period
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setAccountingPeriod("daily")}
                  className={`px-3 py-2 text-sm rounded-lg transition ${
                    accountingPeriod === "daily"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setAccountingPeriod("weekly")}
                  className={`px-3 py-2 text-sm rounded-lg transition ${
                    accountingPeriod === "weekly"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setAccountingPeriod("monthly")}
                  className={`px-3 py-2 text-sm rounded-lg transition ${
                    accountingPeriod === "monthly"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={accountingStartDate}
                  onChange={(e) => setAccountingStartDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  value={accountingEndDate}
                  onChange={(e) => setAccountingEndDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Shows sales that were updated by payments in this period
            </p>
          </>
        )}

        {/* Customer History Fields */}
        {accountingReportType === "customer" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select Customer
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search customer..."
                  value={accountingCustomerSearch}
                  onChange={(e) => {
                    setAccountingCustomerSearch(e.target.value);
                    setAccountingShowCustomerDropdown(true);
                  }}
                  onFocus={() => setAccountingShowCustomerDropdown(true)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                />
                {accountingShowCustomerDropdown && accountingFilteredCustomers.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {accountingFilteredCustomers.map(customer => (
                      <div
                        key={customer.id}
                        onClick={() => {
                          setAccountingCustomerId(customer.id.toString());
                          setAccountingCustomerSearch(customer.name);
                          setAccountingShowCustomerDropdown(false);
                        }}
                        className="p-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0 text-sm"
                      >
                        <div className="font-medium text-black dark:text-white truncate">{customer.name}</div>
                        {customer.phone && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">{customer.phone}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {accountingCustomerId && (
                <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                  Selected: {customers.find(c => c.id === Number(accountingCustomerId))?.name}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={accountingStartDate}
                  onChange={(e) => setAccountingStartDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={accountingEndDate}
                  onChange={(e) => setAccountingEndDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Shows complete payment history with running balance
            </p>
          </>
        )}
        
        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => {
              setShowAccountingModal(false);
              setAccountingCustomerSearch("");
              setAccountingCustomerId("");
            }}
            className="flex-1 bg-gray-500 text-white px-3 py-2 rounded-lg hover:bg-gray-600 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => downloadAccountingReport(accountingReportType)}
            disabled={downloadingReport || (accountingReportType === "customer" && !accountingCustomerId)}
            className="flex-1 bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
          >
            {downloadingReport ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Downloading...
              </>
            ) : (
              <>
                <Download size={16} />
                Download CSV
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  </div>
)}
      </div>
    </ThemeContext.Provider>
  );
}