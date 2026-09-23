// src/app/admin/creditors/page.tsx
"use client";

import { 
  CreditCard, Plus, Trash2, Edit2, ChevronDown, ChevronUp, X, Loader, Package,
  Calendar, DollarSign, Phone, Mail, Building2, Clock, CheckCircle, 
  AlertCircle, TrendingUp, TrendingDown, Wallet, Receipt, FileText,
  Search, Filter, Download, Printer, Eye, User, ArrowRight, 
  History, UserPlus, Check, AlertTriangle, BarChart3, ListChecks,
  ClipboardList, Layers, ShoppingBag, Users, Home, LogOut, Menu,
  LayoutDashboard, Moon, Sun, RefreshCw, Share2, Copy,
  CreditCard as CreditCardIcon, QrCode, Building, Send, FileCheck,
  Info, Link2, ExternalLink, Save, Undo, Trash, FileEdit, EyeOff,
  Copy as CopyIcon
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

// ==================== TYPES ====================

type CreditorPaymentDetail = {
  id: number;
  paymentId: number;
  creditorId: number;
  amount: number;
  description?: string;
  invoiceNumber?: string;
  paymentReference?: string;
  dueDate?: string;
  bankName?: string;
  accountNumber?: string;
  checkNumber?: string;
  checkDate?: string;
  transactionId?: string;
  notes?: string;
  attachments?: string;
  createdAt: string;
  updatedAt: string;
};

type PaymentTemplate = {
  id: number;
  creditorId: number;
  name: string;
  description?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  bankBranch?: string;
  swiftCode?: string;
  defaultPaymentMethod?: string;
  notes?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type Payment = {
  id: number;
  amount: number;
  paymentDate: string;
  paymentMethod?: string; // FIX: Made optional to prevent undefined errors
  reference?: string;
  notes?: string;
  recordedBy?: string;
  recordedByEmail?: string;
  creditorPaymentDetails?: CreditorPaymentDetail[];
};

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
  createdBy?: string;
  createdByEmail?: string;
  staffName?: string;
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
  creditorPaymentDetails?: CreditorPaymentDetail[];
  creditorPaymentTemplates?: PaymentTemplate[];
  createdAt: string;
  updatedAt: string;
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
  bankName?: string;
  accountNumber?: string;
};

type PaymentDetailFormData = {
  amount: string;
  description: string;
  invoiceNumber: string;
  paymentReference: string;
  dueDate: string;
  bankName: string;
  accountNumber: string;
  checkNumber: string;
  checkDate: string;
  transactionId: string;
  notes: string;
  attachments: string;
};

type TemplateFormData = {
  name: string;
  description: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankBranch: string;
  swiftCode: string;
  defaultPaymentMethod: string;
  notes: string;
  isDefault: boolean;
};

// ==================== SAFE FORMAT HELPERS ====================
// FIX: Added safe helpers that handle undefined/null/invalid values

const safeString = (value: any, fallback: string = 'N/A'): string => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

const safeUpper = (value: any, fallback: string = 'N/A'): string => {
  return safeString(value, fallback).toUpperCase();
};

// ==================== NAVIGATION COMPONENT ====================
function NavigationBar({ activePage }: { activePage: string }) {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const navItems = [
    { id: "dashboard", label: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
    { id: "creditors", label: "Creditors", path: "/admin/creditors", icon: CreditCard },
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

// ==================== MAIN COMPONENT ====================
export default function CreditorsSection() {
  const router = useRouter();
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentDetailModal, setShowPaymentDetailModal] = useState(false);
  const [showPaymentDetailEditModal, setShowPaymentDetailEditModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingDetailId, setEditingDetailId] = useState<number | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [selectedCreditor, setSelectedCreditor] = useState<Creditor | null>(null);
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<CreditorPaymentDetail | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<PaymentTemplate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("all");
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [currentUser, setCurrentUser] = useState<{email: string, name: string} | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'totalOwed' | 'restocks' | 'balance' | 'paymentPercentage'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [sharingCreditor, setSharingCreditor] = useState<Creditor | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [templates, setTemplates] = useState<PaymentTemplate[]>([]);
  
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
    bankName: "",
    accountNumber: "",
  });

  const [paymentDetailForm, setPaymentDetailForm] = useState<PaymentDetailFormData>({
    amount: "",
    description: "",
    invoiceNumber: "",
    paymentReference: "",
    dueDate: "",
    bankName: "",
    accountNumber: "",
    checkNumber: "",
    checkDate: "",
    transactionId: "",
    notes: "",
    attachments: "",
  });

  const [templateForm, setTemplateForm] = useState<TemplateFormData>({
    name: "",
    description: "",
    bankName: "",
    accountNumber: "",
    accountName: "",
    bankBranch: "",
    swiftCode: "",
    defaultPaymentMethod: "bank",
    notes: "",
    isDefault: false,
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

  // ==================== GET CURRENT USER ====================
  useEffect(() => {
    const getUser = async () => {
      const user = auth.currentUser;
      if (user) {
        setCurrentUser({
          email: user.email || 'Unknown',
          name: user.displayName || user.email?.split('@')[0] || 'User'
        });
      }
    };
    getUser();
  }, []);

  // ==================== DATA FETCHING ====================
  const fetchCreditors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch("/api/creditors", { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch creditors");
      }
      
      const data = await response.json();
      
      // FIX: Normalize all data with proper fallbacks to prevent undefined errors
      const creditorsWithData = data.map((creditor: any) => ({
        ...creditor,
        name: creditor.name || 'Unnamed Creditor',
        phone: creditor.phone || null,
        email: creditor.email || null,
        createdAt: creditor.createdAt || new Date().toISOString(),
        updatedAt: creditor.updatedAt || new Date().toISOString(),
        // FIX: Normalize payments with guaranteed paymentMethod and paymentDate
        payments: (creditor.payments || []).map((payment: any) => ({
          ...payment,
          amount: Number(payment.amount) || 0,
          paymentMethod: payment.paymentMethod || payment.method || 'cash',
          paymentDate: payment.paymentDate || payment.createdAt || new Date().toISOString(),
          reference: payment.reference || '',
          notes: payment.notes || '',
        })),
        creditorPaymentDetails: (creditor.creditorPaymentDetails || []).map((detail: any) => ({
          ...detail,
          amount: Number(detail.amount) || 0,
          createdAt: detail.createdAt || new Date().toISOString(),
          updatedAt: detail.updatedAt || new Date().toISOString(),
        })),
        // FIX: Normalize templates with guaranteed defaultPaymentMethod
        creditorPaymentTemplates: (creditor.creditorPaymentTemplates || []).map((template: any) => ({
          ...template,
          name: template.name || 'Unnamed Template',
          defaultPaymentMethod: template.defaultPaymentMethod || 'bank',
          isDefault: Boolean(template.isDefault),
          createdAt: template.createdAt || new Date().toISOString(),
          updatedAt: template.updatedAt || new Date().toISOString(),
        })),
        // FIX: Normalize restocks with safe product access
        restocks: (creditor.restocks || []).map((restock: any) => ({
          ...restock,
          createdAt: restock.createdAt || new Date().toISOString(),
          costPrice: Number(restock.costPrice) || 0,
          quantity: Number(restock.quantity) || 0,
          totalCost: Number(restock.totalCost) || 0,
          paymentSource: restock.paymentSource || 'Unknown',
          createdBy: restock.createdBy || 'System',
          createdByEmail: restock.createdByEmail || 'system@swiftmetals.com',
          product: {
            id: restock.product?.id || 0,
            name: restock.product?.name || 'Unknown Product',
            price: Number(restock.product?.price) || 0,
            category: restock.product?.category || '',
          },
        }))
      }));
      
      setCreditors(creditorsWithData);
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
  }, []);

  useEffect(() => {
    fetchCreditors();
  }, [fetchCreditors]);

  // ==================== CALCULATIONS ====================
  const calculateTotalOwed = (creditor: Creditor) => {
    return (creditor.restocks || []).reduce((sum, restock) => sum + (Number(restock.totalCost) || 0), 0);
  };

  const calculateTotalPaid = (creditor: Creditor) => {
    return (creditor.payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  };

  const calculateBalance = (creditor: Creditor) => {
    const totalOwed = calculateTotalOwed(creditor);
    const totalPaid = calculateTotalPaid(creditor);
    return totalOwed - totalPaid;
  };

  const calculatePaymentPercentage = (creditor: Creditor) => {
    const totalOwed = calculateTotalOwed(creditor);
    const totalPaid = calculateTotalPaid(creditor);
    return totalOwed > 0 ? Math.round((totalPaid / totalOwed) * 100) : 0;
  };

  const getPaymentStatus = (creditor: Creditor) => {
    const balance = calculateBalance(creditor);
    const totalOwed = calculateTotalOwed(creditor);
    
    if (totalOwed === 0) return { label: 'No Debt', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
    if (balance <= 0) return { label: 'Fully Paid', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
    if (balance < totalOwed * 0.3) return { label: 'Almost Paid', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
    if (balance < totalOwed * 0.7) return { label: 'Partially Paid', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' };
    return { label: 'Owing', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
  };

  const getBalanceColor = (balance: number) => {
    if (balance === 0) return 'text-green-600 dark:text-green-400';
    if (balance < 1000) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const formatCurrency = (amount: number) =>
    Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // FIX: Safe formatDate that handles undefined/invalid dates
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // FIX: Safe formatDateTime that handles undefined/invalid dates
  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ==================== FILTERS & SEARCH ====================
  const filteredCreditors = useMemo(() => {
    let filtered = creditors;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        (c.name || '').toLowerCase().includes(term) ||
        (c.email && c.email.toLowerCase().includes(term)) ||
        (c.phone && c.phone.includes(term)) ||
        (c.restocks || []).some(r => (r.product?.name || '').toLowerCase().includes(term))
      );
    }
    
    filtered = [...filtered].sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case 'name':
          valA = (a.name || '').toLowerCase();
          valB = (b.name || '').toLowerCase();
          break;
        case 'totalOwed':
          valA = calculateTotalOwed(a);
          valB = calculateTotalOwed(b);
          break;
        case 'balance':
          valA = calculateBalance(a);
          valB = calculateBalance(b);
          break;
        case 'paymentPercentage':
          valA = calculatePaymentPercentage(a);
          valB = calculatePaymentPercentage(b);
          break;
        case 'restocks':
          valA = (a.restocks || []).length;
          valB = (b.restocks || []).length;
          break;
        default:
          valA = a.name;
          valB = b.name;
      }
      if (sortOrder === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });
    
    return filtered;
  }, [creditors, searchTerm, sortBy, sortOrder]);

  // ==================== TEMPLATE OPERATIONS ====================
  const fetchTemplates = useCallback(async (creditorId: number) => {
    try {
      const response = await fetch(`/api/creditors/templates?creditorId=${creditorId}`);
      if (!response.ok) throw new Error("Failed to fetch templates");
      const data = await response.json();
      // FIX: Normalize templates
      const normalized = (data || []).map((template: any) => ({
        ...template,
        name: template.name || 'Unnamed Template',
        defaultPaymentMethod: template.defaultPaymentMethod || 'bank',
        isDefault: Boolean(template.isDefault),
        createdAt: template.createdAt || new Date().toISOString(),
        updatedAt: template.updatedAt || new Date().toISOString(),
      }));
      setTemplates(normalized);
      return normalized;
    } catch (error) {
      console.error("Error fetching templates:", error);
      setError("Failed to load payment templates");
      return [];
    }
  }, []);

  const handleSaveTemplate = async () => {
    if (!selectedCreditor) return;
    if (!templateForm.name.trim()) {
      alert("Template name is required");
      return;
    }

    try {
      setSubmitting(true);
      const url = `/api/creditors/templates`;
      const method = editingTemplateId ? "PUT" : "POST";
      const body = {
        id: editingTemplateId,
        creditorId: selectedCreditor.id,
        ...templateForm,
        isDefault: templateForm.isDefault,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save template");
      }

      await fetchTemplates(selectedCreditor.id);
      await fetchCreditors();
      setShowTemplateModal(false);
      setEditingTemplateId(null);
      setTemplateForm({
        name: "",
        description: "",
        bankName: "",
        accountNumber: "",
        accountName: "",
        bankBranch: "",
        swiftCode: "",
        defaultPaymentMethod: "bank",
        notes: "",
        isDefault: false,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const loadTemplateIntoPayment = (template: PaymentTemplate) => {
    setPaymentForm({
      ...paymentForm,
      bankName: template.bankName || "",
      accountNumber: template.accountNumber || "",
      notes: template.notes || paymentForm.notes,
      paymentMethod: template.defaultPaymentMethod || paymentForm.paymentMethod,
    });
    setSelectedTemplate(template);
    setShowTemplateSelector(false);
  };

  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    
    try {
      const response = await fetch("/api/creditors/templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: templateId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete template");
      }

      if (selectedCreditor) {
        await fetchTemplates(selectedCreditor.id);
        await fetchCreditors();
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  // ==================== CRUD OPERATIONS ====================
  const openModal = (creditor?: Creditor) => {
    if (creditor) {
      setEditingId(creditor.id);
      setFormData({
        name: creditor.name || "",
        phone: creditor.phone || "",
        email: creditor.email || "",
        totalOwed: creditor.totalOwed || 0,
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
      bankName: "",
      accountNumber: "",
    });
    setShowPaymentModal(true);
    if (creditor.creditorPaymentTemplates && creditor.creditorPaymentTemplates.length > 0) {
      setTemplates(creditor.creditorPaymentTemplates);
    } else {
      setTemplates([]);
    }
    setShowTemplateSelector(false);
  };

  const openPaymentDetailModal = (creditor: Creditor, detail?: CreditorPaymentDetail) => {
    setSelectedCreditor(creditor);
    if (detail) {
      setEditingDetailId(detail.id);
      setSelectedPaymentDetail(detail);
      setPaymentDetailForm({
        amount: (detail.amount || 0).toString(),
        description: detail.description || "",
        invoiceNumber: detail.invoiceNumber || "",
        paymentReference: detail.paymentReference || "",
        dueDate: detail.dueDate || "",
        bankName: detail.bankName || "",
        accountNumber: detail.accountNumber || "",
        checkNumber: detail.checkNumber || "",
        checkDate: detail.checkDate || "",
        transactionId: detail.transactionId || "",
        notes: detail.notes || "",
        attachments: detail.attachments || "",
      });
      setShowPaymentDetailEditModal(true);
    } else {
      setEditingDetailId(null);
      setSelectedPaymentDetail(null);
      setPaymentDetailForm({
        amount: "",
        description: "",
        invoiceNumber: "",
        paymentReference: "",
        dueDate: "",
        bankName: "",
        accountNumber: "",
        checkNumber: "",
        checkDate: "",
        transactionId: "",
        notes: "",
        attachments: "",
      });
      setShowPaymentDetailModal(true);
    }
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
          body: JSON.stringify({ 
            id: editingId, 
            ...formData,
            updatedBy: currentUser?.email || 'system'
          }),
        });
      } else {
        response = await fetch("/api/creditors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            createdBy: currentUser?.email || 'system',
            createdByEmail: currentUser?.email || 'system@swiftmetals.com'
          }),
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save creditor");
      }

      await fetchCreditors();
      setShowModal(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this creditor? This will also remove all associated restocks, payment details, and templates.")) return;

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
      setError(err instanceof Error ? err.message : "An error occurred");
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
          paymentMethod: paymentForm.paymentMethod || 'cash', // FIX: Ensure never undefined
          reference: paymentForm.reference,
          notes: paymentForm.notes,
          recordedBy: currentUser?.email || 'system',
          recordedByEmail: currentUser?.email || 'system@swiftmetals.com',
          bankName: paymentForm.bankName,
          accountNumber: paymentForm.accountNumber,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to record payment");
      }

      await fetchCreditors();
      setShowPaymentModal(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePaymentDetail = async () => {
    if (!selectedCreditor) return;
    
    const amount = parseFloat(paymentDetailForm.amount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      setSubmitting(true);
      let response;

      if (editingDetailId !== null) {
        response = await fetch("/api/creditors/payment-details", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingDetailId,
            ...paymentDetailForm,
            amount: amount,
            updatedBy: currentUser?.email || 'system'
          }),
        });
      } else {
        response = await fetch("/api/creditors/payment-details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creditorId: selectedCreditor.id,
            ...paymentDetailForm,
            amount: amount,
            createdBy: currentUser?.email || 'system',
            createdByEmail: currentUser?.email || 'system@swiftmetals.com'
          }),
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save payment detail");
      }

      await fetchCreditors();
      setShowPaymentDetailModal(false);
      setShowPaymentDetailEditModal(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePaymentDetail = async (detailId: number) => {
    if (!confirm("Are you sure you want to delete this payment detail?")) return;

    try {
      const response = await fetch("/api/creditors/payment-details", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: detailId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete payment detail");
      }

      await fetchCreditors();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  // ==================== SHARING FUNCTIONS ====================
  const generateWhatsAppMessage = (creditor: Creditor) => {
    const totalOwed = calculateTotalOwed(creditor);
    const totalPaid = calculateTotalPaid(creditor);
    const balance = calculateBalance(creditor);
    const paymentPercentage = calculatePaymentPercentage(creditor);
    const paymentDetails = creditor.creditorPaymentDetails || [];
    const templates = creditor.creditorPaymentTemplates || [];

    let message = `🏢 *CREDITOR STATEMENT - ${safeUpper(creditor.name, 'UNNAMED')}*\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📋 *CREDITOR DETAILS*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🔹 *Name:* ${safeString(creditor.name)}\n`;
    if (creditor.phone) message += `📞 *Phone:* ${creditor.phone}\n`;
    if (creditor.email) message += `📧 *Email:* ${creditor.email}\n`;
    message += `📅 *Member Since:* ${formatDate(creditor.createdAt)}\n\n`;

    message += `💰 *FINANCIAL SUMMARY*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💵 *Total Owed:* KES ${totalOwed.toLocaleString()}\n`;
    message += `✅ *Total Paid:* KES ${totalPaid.toLocaleString()}\n`;
    message += `📊 *Balance:* KES ${balance.toLocaleString()}\n`;
    message += `📈 *Payment Rate:* ${paymentPercentage}%\n`;
    message += `📦 *Total Restocks:* ${(creditor.restocks || []).length}\n`;
    message += `💳 *Total Payments:* ${(creditor.payments || []).length}\n\n`;

    // Templates
    if (templates.length > 0) {
      message += `💳 *SAVED PAYMENT TEMPLATES*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      templates.forEach((template, index) => {
        message += `${index + 1}. *${safeString(template.name, 'Unnamed')}*\n`;
        if (template.bankName) message += `   🏦 Bank: ${template.bankName}\n`;
        if (template.accountNumber) message += `   🔢 Account: ${template.accountNumber}\n`;
        if (template.accountName) message += `   👤 Account Name: ${template.accountName}\n`;
        if (template.swiftCode) message += `   🔑 SWIFT: ${template.swiftCode}\n`;
        if (template.notes) message += `   📌 Notes: ${template.notes}\n`;
        message += `   ─────────────────────────────────────\n`;
      });
    }

    // Restock Details
    if ((creditor.restocks || []).length > 0) {
      message += `\n📦 *RESTOCK DETAILS*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      creditor.restocks.forEach((restock, index) => {
        message += `${index + 1}. *${safeString(restock.product?.name, 'Unknown Product')}*\n`;
        message += `   📊 Qty: ${restock.quantity} | Unit: KES ${(restock.costPrice || 0).toLocaleString()}\n`;
        message += `   💰 Total: KES ${(restock.totalCost || 0).toLocaleString()}\n`;
        message += `   📅 Date: ${formatDate(restock.createdAt)}\n`;
        message += `   💳 Payment Source: ${safeString(restock.paymentSource)}\n`;
        if (restock.createdByEmail) message += `   👤 By: ${restock.createdByEmail}\n`;
        message += `   ─────────────────────────────────────\n`;
      });
    }

    // Payment Details
    if (paymentDetails.length > 0) {
      message += `\n💳 *PAYMENT DETAILS*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      paymentDetails.forEach((detail, index) => {
        message += `${index + 1}. *Amount:* KES ${(detail.amount || 0).toLocaleString()}\n`;
        if (detail.invoiceNumber) message += `   📄 Invoice: ${detail.invoiceNumber}\n`;
        if (detail.paymentReference) message += `   🔑 Reference: ${detail.paymentReference}\n`;
        if (detail.bankName) message += `   🏦 Bank: ${detail.bankName}\n`;
        if (detail.accountNumber) message += `   🔢 Account: ${detail.accountNumber}\n`;
        if (detail.checkNumber) message += `   ✓ Check #: ${detail.checkNumber}\n`;
        if (detail.transactionId) message += `   🆔 Transaction: ${detail.transactionId}\n`;
        if (detail.description) message += `   📝 Description: ${detail.description}\n`;
        if (detail.notes) message += `   📌 Notes: ${detail.notes}\n`;
        message += `   ─────────────────────────────────────\n`;
      });
    }

    // Payment Summary
    message += `\n📊 *PAYMENT SUMMARY*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💰 Total Owed: KES ${totalOwed.toLocaleString()}\n`;
    message += `✅ Total Paid: KES ${totalPaid.toLocaleString()}\n`;
    message += `📊 Balance: KES ${balance.toLocaleString()}\n`;
    message += `📈 Payment Rate: ${paymentPercentage}%\n`;

    message += `\n📅 *Generated:* ${new Date().toLocaleString()}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🔹 *Please review and settle the outstanding balance.*\n`;
    message += `🔹 *Thank you for your continued partnership!* 🙏\n\n`;
    message += `*SWIFT METALS ACCOUNTING*\n`;
    message += `📧 accounting@swiftmetals.com\n`;
    message += `📞 +254 700 000 000`;

    return encodeURIComponent(message);
  };

  const shareViaWhatsApp = (creditor: Creditor) => {
    const message = generateWhatsAppMessage(creditor);
    const whatsappUrl = `https://wa.me/?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  const copyToClipboard = async (creditor: Creditor) => {
    const message = generateWhatsAppMessage(creditor);
    try {
      await navigator.clipboard.writeText(decodeURIComponent(message));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (err) {
      alert('Failed to copy message. Please try again.');
    }
  };

  // ==================== EXPORT ====================
  const exportToCSV = () => {
    if (creditors.length === 0) return;

    const csvData: any[] = [];
    for (const creditor of creditors) {
      const totalOwed = calculateTotalOwed(creditor);
      const totalPaid = calculateTotalPaid(creditor);
      const balance = calculateBalance(creditor);
      const paymentPercentage = calculatePaymentPercentage(creditor);
      
      // Add summary row
      csvData.push({
        'Creditor': safeString(creditor.name),
        'Phone': creditor.phone || '',
        'Email': creditor.email || '',
        'Total Owed (KES)': totalOwed.toFixed(2),
        'Total Paid (KES)': totalPaid.toFixed(2),
        'Balance (KES)': balance.toFixed(2),
        'Payment %': paymentPercentage + '%',
        'Total Restocks': (creditor.restocks || []).length,
        'Total Payments': (creditor.payments || []).length,
        'Templates': (creditor.creditorPaymentTemplates || []).length,
        'Status': getPaymentStatus(creditor).label,
        'Member Since': formatDate(creditor.createdAt)
      });

      // Add restock details
      for (const restock of (creditor.restocks || [])) {
        csvData.push({
          'Creditor': safeString(creditor.name),
          'Phone': creditor.phone || '',
          'Email': creditor.email || '',
          'Product': safeString(restock.product?.name, 'Unknown Product'),
          'Quantity': restock.quantity,
          'Unit Price (KES)': (restock.costPrice || 0).toFixed(2),
          'Total (KES)': (restock.totalCost || 0).toFixed(2),
          'Date': formatDateTime(restock.createdAt),
          'Payment Source': safeString(restock.paymentSource),
          'Created By': restock.createdByEmail || 'System',
          'Staff': restock.staffName || 'N/A'
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
    let totalTransactions = 0;
    let totalTemplates = 0;
    let fullyPaid = 0;
    let partiallyPaid = 0;
    let owing = 0;

    for (const creditor of creditors) {
      const owed = calculateTotalOwed(creditor);
      const paid = calculateTotalPaid(creditor);
      const balance = owed - paid;
      
      totalOwed += owed;
      totalPaid += paid;
      totalRestocks += (creditor.restocks || []).length;
      totalTransactions += (creditor.restocks || []).length + (creditor.payments || []).length;
      totalTemplates += (creditor.creditorPaymentTemplates || []).length;
      
      if (balance <= 0) fullyPaid++;
      else if (balance < owed * 0.7) partiallyPaid++;
      else owing++;
      
      for (const restock of (creditor.restocks || [])) {
        if (restock.product?.id) totalProducts.add(restock.product.id);
      }
    }

    return {
      totalCreditors,
      totalOwed,
      totalPaid,
      totalRestocks,
      totalProducts: totalProducts.size,
      totalTransactions,
      totalTemplates,
      balance: totalOwed - totalPaid,
      fullyPaid,
      partiallyPaid,
      owing,
      averagePaymentRate: totalOwed > 0 ? Math.round((totalPaid / totalOwed) * 100) : 0
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
            <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm lg:text-base mt-1 md:mt-2">
              Manage suppliers, creditors, and track payments with reusable templates
              {currentUser && (
                <span className="ml-2 text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                  {currentUser.email}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                setViewMode(viewMode === 'cards' ? 'table' : 'cards');
              }}
              className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {viewMode === 'cards' ? <ListChecks size={16} /> : <Layers size={16} />}
              {viewMode === 'cards' ? 'Table View' : 'Card View'}
            </button>
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
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-6 py-2 md:py-3 rounded-lg font-medium transition flex items-center gap-2 shadow-lg hover:shadow-xl text-sm md:text-base"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5" /> Add Creditor
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto hover:bg-red-100 dark:hover:bg-red-800/50 p-1 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Copy Success Notification */}
        {copySuccess && (
          <div className="fixed top-20 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <CheckCircle size={18} />
            Message copied to clipboard!
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
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 md:gap-4 mb-6 md:mb-8">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 md:p-6 shadow-md border-l-4 border-blue-600">
                  <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm font-medium mb-1 md:mb-2">Total Creditors</p>
                  <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{stats.totalCreditors}</p>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span className="text-green-600">✓ {stats.fullyPaid} paid</span>
                  </div>
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
                  <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm font-medium mb-1 md:mb-2">Restocks</p>
                  <p className="text-2xl md:text-3xl font-bold text-orange-600">{stats.totalRestocks}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 md:p-6 shadow-md border-l-4 border-teal-500">
                  <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm font-medium mb-1 md:mb-2">Payment Rate</p>
                  <p className="text-2xl md:text-3xl font-bold text-teal-600">{stats.averagePaymentRate}%</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 md:p-6 shadow-md border-l-4 border-indigo-500">
                  <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm font-medium mb-1 md:mb-2">Templates</p>
                  <p className="text-2xl md:text-3xl font-bold text-indigo-600">{stats.totalTemplates}</p>
                </div>
              </div>
            )}

            {/* Search and Filters */}
            <div className="mb-4 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search creditors by name, email, phone or product..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                >
                  <option value="name">Sort by Name</option>
                  <option value="totalOwed">Sort by Amount Owed</option>
                  <option value="balance">Sort by Balance</option>
                  <option value="paymentPercentage">Sort by Payment %</option>
                  <option value="restocks">Sort by Restocks</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSortBy('name');
                    setSortOrder('asc');
                  }}
                  className="px-3 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>

            {/* Creditors List */}
            {filteredCreditors.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-8 md:p-12 text-center shadow-sm">
                <CreditCard className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400 text-sm md:text-lg">
                  {searchTerm ? 'No creditors match your search' : 'No creditors found. Add one to get started.'}
                </p>
              </div>
            ) : viewMode === 'cards' ? (
              // CARD VIEW - Enhanced with clear financial info
              <div className="space-y-4">
                {filteredCreditors.map((creditor) => {
                  const totalOwed = calculateTotalOwed(creditor);
                  const totalPaid = calculateTotalPaid(creditor);
                  const balance = calculateBalance(creditor);
                  const paymentPercentage = calculatePaymentPercentage(creditor);
                  const paymentStatus = getPaymentStatus(creditor);
                  const totalRestocks = (creditor.restocks || []).length;
                  const isExpanded = expandedId === creditor.id;
                  const templateCount = (creditor.creditorPaymentTemplates || []).length;

                  return (
                    <div key={creditor.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg overflow-hidden transition-all border border-gray-200 dark:border-gray-700">
                      {/* Main Card */}
                      <div
                        onClick={() => setExpandedId(isExpanded ? null : creditor.id)}
                        className="p-4 md:p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                          {/* Left: Creditor Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                              <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">{safeString(creditor.name)}</h3>
                              <span className={`text-xs px-3 py-1 rounded-full font-medium ${paymentStatus.color}`}>
                                {paymentStatus.label}
                              </span>
                              {templateCount > 0 && (
                                <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-2 py-1 rounded-full">
                                  {templateCount} templates
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                              {creditor.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone size={14} /> {creditor.phone}
                                </span>
                              )}
                              {creditor.email && (
                                <span className="flex items-center gap-1 truncate">
                                  <Mail size={14} /> <span className="truncate max-w-[150px]">{creditor.email}</span>
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Package size={14} /> {totalRestocks} restocks
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={14} /> {formatDate(creditor.createdAt)}
                              </span>
                            </div>
                          </div>

                          {/* Right: Financial Summary */}
                          <div className="grid grid-cols-4 gap-3 flex-shrink-0">
                            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2 text-center">
                              <p className="text-xs text-gray-600 dark:text-gray-400">Owed</p>
                              <p className="text-sm font-bold text-purple-600">KES {formatCurrency(totalOwed)}</p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
                              <p className="text-xs text-gray-600 dark:text-gray-400">Paid</p>
                              <p className="text-sm font-bold text-green-600">KES {formatCurrency(totalPaid)}</p>
                            </div>
                            <div className={`rounded-lg p-2 text-center ${balance > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                              <p className="text-xs text-gray-600 dark:text-gray-400">Balance</p>
                              <p className={`text-sm font-bold ${getBalanceColor(balance)}`}>
                                {balance > 0 ? `KES ${formatCurrency(balance)}` : '✓ Paid'}
                              </p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center">
                              <p className="text-xs text-gray-600 dark:text-gray-400">Payment %</p>
                              <p className="text-sm font-bold text-blue-600">{paymentPercentage}%</p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSharingCreditor(creditor);
                                setShowShareModal(true);
                              }}
                              className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition"
                              title="Share via WhatsApp"
                            >
                              <Share2 size={20} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openPaymentDetailModal(creditor);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                              title="Add Payment Details"
                            >
                              <FileText size={20} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openPaymentModal(creditor);
                              }}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors flex items-center gap-2"
                            >
                              <Wallet size={16} />
                              Pay
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openModal(creditor);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                              title="Edit"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(creditor.id);
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                              title="Delete"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                            <button className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  paymentPercentage > 70 ? 'bg-green-500' : 
                                  paymentPercentage > 40 ? 'bg-yellow-500' : 
                                  paymentPercentage > 0 ? 'bg-orange-500' : 
                                  'bg-red-500'
                                }`}
                                style={{ width: `${paymentPercentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 min-w-[40px]">
                              {paymentPercentage}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-4 md:px-6 pb-4 md:pb-6 space-y-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                          {/* Financial Breakdown */}
                          <div className="pt-4">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-green-600" />
                              Financial Breakdown
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Total Owed</p>
                                <p className="text-lg font-bold text-purple-600">KES {formatCurrency(totalOwed)}</p>
                                <p className="text-xs text-gray-400">{(creditor.restocks || []).length} restocks</p>
                              </div>
                              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Total Paid</p>
                                <p className="text-lg font-bold text-green-600">KES {formatCurrency(totalPaid)}</p>
                                <p className="text-xs text-gray-400">{(creditor.payments || []).length} payments</p>
                              </div>
                              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Balance</p>
                                <p className={`text-lg font-bold ${getBalanceColor(balance)}`}>
                                  {balance > 0 ? `KES ${formatCurrency(balance)}` : '✓ Fully Paid'}
                                </p>
                                <p className="text-xs text-gray-400">{paymentPercentage}% paid</p>
                              </div>
                              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Templates</p>
                                <p className="text-lg font-bold text-indigo-600">{templateCount}</p>
                                <p className="text-xs text-gray-400">Payment templates</p>
                              </div>
                            </div>
                          </div>

                          {/* Templates Section */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Save className="w-4 h-4 text-indigo-600" />
                                Payment Templates ({templateCount})
                              </h4>
                              <button
                                onClick={() => {
                                  setSelectedCreditor(creditor);
                                  setEditingTemplateId(null);
                                  setTemplateForm({
                                    name: "",
                                    description: "",
                                    bankName: "",
                                    accountNumber: "",
                                    accountName: "",
                                    bankBranch: "",
                                    swiftCode: "",
                                    defaultPaymentMethod: "bank",
                                    notes: "",
                                    isDefault: false,
                                  });
                                  setShowTemplateModal(true);
                                }}
                                className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
                              >
                                <Plus size={14} />
                                New Template
                              </button>
                            </div>
                            {(creditor.creditorPaymentTemplates && creditor.creditorPaymentTemplates.length > 0) ? (
                              <div className="space-y-2 max-h-60 overflow-y-auto">
                                {creditor.creditorPaymentTemplates.map((template) => (
                                  <div key={template.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-semibold text-gray-900 dark:text-white">
                                            {safeString(template.name, 'Unnamed Template')}
                                          </span>
                                          {template.isDefault && (
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                              Default
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                          {template.bankName && (
                                            <span className="flex items-center gap-1">
                                              <Building size={12} />
                                              {template.bankName}
                                            </span>
                                          )}
                                          {template.accountNumber && (
                                            <span className="flex items-center gap-1">
                                              🔢 {template.accountNumber}
                                            </span>
                                          )}
                                          {template.defaultPaymentMethod && (
                                            <span className="flex items-center gap-1">
                                              💳 {safeUpper(template.defaultPaymentMethod)}
                                            </span>
                                          )}
                                        </div>
                                        {template.description && (
                                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{template.description}</p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                          onClick={() => {
                                            setSelectedCreditor(creditor);
                                            setEditingTemplateId(template.id);
                                            setTemplateForm({
                                              name: template.name || "",
                                              description: template.description || "",
                                              bankName: template.bankName || "",
                                              accountNumber: template.accountNumber || "",
                                              accountName: template.accountName || "",
                                              bankBranch: template.bankBranch || "",
                                              swiftCode: template.swiftCode || "",
                                              defaultPaymentMethod: template.defaultPaymentMethod || "bank",
                                              notes: template.notes || "",
                                              isDefault: template.isDefault,
                                            });
                                            setShowTemplateModal(true);
                                          }}
                                          className="p-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition"
                                          title="Edit Template"
                                        >
                                          <Edit2 size={14} />
                                        </button>
                                        <button
                                          onClick={() => {
                                            openPaymentModal(creditor);
                                            setTimeout(() => {
                                              loadTemplateIntoPayment(template);
                                            }, 100);
                                          }}
                                          className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition"
                                          title="Use Template"
                                        >
                                          <CopyIcon size={14} />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteTemplate(template.id)}
                                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                                          title="Delete Template"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-500 dark:text-gray-400 text-sm py-2">No payment templates saved</p>
                            )}
                          </div>

                          {/* Restock History */}
                          {(creditor.restocks || []).length > 0 && (
                            <div>
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <Package className="w-4 h-4 text-orange-600" />
                                Restock History ({(creditor.restocks || []).length})
                              </h4>
                              <div className="max-h-60 overflow-y-auto space-y-2">
                                {(creditor.restocks || []).slice(0, 10).map((restock, index) => (
                                  <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                    <div>
                                      <p className="font-medium text-gray-900 dark:text-white">{safeString(restock.product?.name, 'Unknown Product')}</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {restock.quantity} units × KES {formatCurrency(restock.costPrice)} = KES {formatCurrency(restock.totalCost)}
                                      </p>
                                      <p className="text-xs text-gray-400">{formatDateTime(restock.createdAt)}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-bold text-purple-600">KES {formatCurrency(restock.totalCost)}</p>
                                      <p className="text-xs text-gray-400">{safeString(restock.paymentSource)}</p>
                                    </div>
                                  </div>
                                ))}
                                {(creditor.restocks || []).length > 10 && (
                                  <p className="text-xs text-gray-400 text-center">+ {(creditor.restocks || []).length - 10} more restocks</p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Payment History */}
                          {(creditor.payments || []).length > 0 && (
                            <div>
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <Receipt className="w-4 h-4 text-green-600" />
                                Payment History ({(creditor.payments || []).length})
                              </h4>
                              <div className="max-h-60 overflow-y-auto space-y-2">
                                {(creditor.payments || []).slice(0, 10).map((payment, index) => (
                                  <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                    <div>
                                      <p className="font-medium text-gray-900 dark:text-white">KES {formatCurrency(payment.amount)}</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {/* FIX: Safe toUpperCase with fallback - THIS WAS THE BUG */}
                                        {safeUpper(payment.paymentMethod)} • {formatDateTime(payment.paymentDate)}
                                      </p>
                                      {payment.reference && (
                                        <p className="text-xs text-gray-400">Ref: {payment.reference}</p>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded-full">
                                        Paid
                                      </span>
                                    </div>
                                  </div>
                                ))}
                                {(creditor.payments || []).length > 10 && (
                                  <p className="text-xs text-gray-400 text-center">+ {(creditor.payments || []).length - 10} more payments</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              // TABLE VIEW - Enhanced with clear financial columns
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Creditor</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Restocks</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Owed</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Paid</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Balance</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payment %</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Templates</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredCreditors.map((creditor) => {
                        const totalOwed = calculateTotalOwed(creditor);
                        const totalPaid = calculateTotalPaid(creditor);
                        const balance = calculateBalance(creditor);
                        const paymentPercentage = calculatePaymentPercentage(creditor);
                        const paymentStatus = getPaymentStatus(creditor);
                        const templateCount = (creditor.creditorPaymentTemplates || []).length;
                        
                        return (
                          <tr key={creditor.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900 dark:text-white">{safeString(creditor.name)}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{formatDate(creditor.createdAt)}</div>
                            </td>
                            <td className="px-4 py-3">
                              {creditor.phone && <div className="text-sm text-gray-600 dark:text-gray-300">{creditor.phone}</div>}
                              {creditor.email && <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{creditor.email}</div>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs">
                                <Package size={12} />
                                {(creditor.restocks || []).length}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-purple-600">
                              KES {formatCurrency(totalOwed)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-green-600">
                              KES {formatCurrency(totalPaid)}
                            </td>
                            <td className={`px-4 py-3 text-right font-bold ${getBalanceColor(balance)}`}>
                              {balance > 0 ? `KES ${formatCurrency(balance)}` : '✓ Paid'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${paymentPercentage > 70 ? 'bg-green-500' : paymentPercentage > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                    style={{ width: `${paymentPercentage}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{paymentPercentage}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${templateCount > 0 ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                                <Save size={12} />
                                {templateCount}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${paymentStatus.color}`}>
                                {paymentStatus.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => {
                                    setSharingCreditor(creditor);
                                    setShowShareModal(true);
                                  }}
                                  className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition"
                                  title="Share via WhatsApp"
                                >
                                  <Share2 size={16} />
                                </button>
                                <button
                                  onClick={() => openPaymentDetailModal(creditor)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition"
                                  title="Add Payment Details"
                                >
                                  <FileText size={16} />
                                </button>
                                <button
                                  onClick={() => openPaymentModal(creditor)}
                                  className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition"
                                  title="Record Payment"
                                >
                                  <Wallet size={16} />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedCreditor(creditor);
                                    setEditingTemplateId(null);
                                    setTemplateForm({
                                      name: "",
                                      description: "",
                                      bankName: "",
                                      accountNumber: "",
                                      accountName: "",
                                      bankBranch: "",
                                      swiftCode: "",
                                      defaultPaymentMethod: "bank",
                                      notes: "",
                                      isDefault: false,
                                    });
                                    setShowTemplateModal(true);
                                  }}
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition"
                                  title="Add Template"
                                >
                                  <Save size={16} />
                                </button>
                                <button
                                  onClick={() => openModal(creditor)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition"
                                  title="Edit"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleDelete(creditor.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                                <button
                                  onClick={() => setExpandedId(expandedId === creditor.id ? null : creditor.id)}
                                  className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
                                >
                                  {expandedId === creditor.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer Stats */}
            {creditors.length > 0 && (
              <div className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
                Showing {filteredCreditors.length} of {creditors.length} creditors | 
                Total outstanding: KES {formatCurrency(stats.balance)} | 
                Average payment rate: {stats.averagePaymentRate}% |
                Templates: {stats.totalTemplates} |
                Last updated: {new Date().toLocaleString()}
              </div>
            )}
          </>
        )}
      </div>

      {/* ==================== MODALS ==================== */}
      
      {/* Creditor Modal - Keep existing */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
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

      {/* ==================== PAYMENT MODAL WITH TEMPLATE SUPPORT ==================== */}
      {showPaymentModal && selectedCreditor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Record Payment</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pay to: {safeString(selectedCreditor.name)}</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                disabled={submitting}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Template Selector */}
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Payment Details
                </label>
                <div className="flex gap-2">
                  {templates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                      className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
                    >
                      <CopyIcon size={14} />
                      {showTemplateSelector ? 'Hide Templates' : 'Load Template'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowTemplateSelector(false);
                      setShowTemplateModal(true);
                      setEditingTemplateId(null);
                      setTemplateForm({
                        name: "",
                        description: "",
                        bankName: "",
                        accountNumber: "",
                        accountName: "",
                        bankBranch: "",
                        swiftCode: "",
                        defaultPaymentMethod: "bank",
                        notes: "",
                        isDefault: false,
                      });
                    }}
                    className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 flex items-center gap-1"
                  >
                    <Save size={14} />
                    Save as Template
                  </button>
                </div>
              </div>

              {/* Template Selector Dropdown */}
              {showTemplateSelector && templates.length > 0 && (
                <div className="mt-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between p-2 bg-white dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-500 hover:border-indigo-400 cursor-pointer"
                        onClick={() => loadTemplateIntoPayment(template)}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-gray-900 dark:text-white">
                              {safeString(template.name, 'Unnamed Template')}
                            </span>
                            {template.isDefault && (
                              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                Default
                              </span>
                            )}
                          </div>
                          {template.bankName && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {template.bankName}
                              {template.accountNumber && ` • ${template.accountNumber.slice(-4)}`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              loadTemplateIntoPayment(template);
                            }}
                            className="text-indigo-600 hover:text-indigo-700 text-xs px-2 py-1"
                          >
                            Use
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTemplateId(template.id);
                              setTemplateForm({
                                name: template.name || "",
                                description: template.description || "",
                                bankName: template.bankName || "",
                                accountNumber: template.accountNumber || "",
                                accountName: template.accountName || "",
                                bankBranch: template.bankBranch || "",
                                swiftCode: template.swiftCode || "",
                                defaultPaymentMethod: template.defaultPaymentMethod || "bank",
                                notes: template.notes || "",
                                isDefault: template.isDefault,
                              });
                              setShowTemplateModal(true);
                              setShowTemplateSelector(false);
                            }}
                            className="text-blue-600 hover:text-blue-700 text-xs px-2 py-1"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTemplate(template.id);
                            }}
                            className="text-red-600 hover:text-red-700 text-xs px-2 py-1"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Payment Form */}
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bank Name</label>
                <input
                  type="text"
                  placeholder="Bank name (optional)"
                  value={paymentForm.bankName || ""}
                  onChange={(e) => setPaymentForm({ ...paymentForm, bankName: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Account Number</label>
                <input
                  type="text"
                  placeholder="Account number (optional)"
                  value={paymentForm.accountNumber || ""}
                  onChange={(e) => setPaymentForm({ ...paymentForm, accountNumber: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                  disabled={submitting}
                />
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

      {/* ==================== PAYMENT DETAIL MODAL ==================== */}
      {showPaymentDetailModal && selectedCreditor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Add Payment Details</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">For: {safeString(selectedCreditor.name)}</p>
              </div>
              <button
                onClick={() => setShowPaymentDetailModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                disabled={submitting}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Amount (KES) *</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={paymentDetailForm.amount}
                    onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, amount: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                  <input
                    type="text"
                    placeholder="Payment description"
                    value={paymentDetailForm.description}
                    onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, description: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Invoice Number</label>
                  <input
                    type="text"
                    placeholder="INV-2024-001"
                    value={paymentDetailForm.invoiceNumber}
                    onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, invoiceNumber: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Payment Reference</label>
                  <input
                    type="text"
                    placeholder="REF-12345"
                    value={paymentDetailForm.paymentReference}
                    onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, paymentReference: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Due Date</label>
                <input
                  type="date"
                  value={paymentDetailForm.dueDate}
                  onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, dueDate: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bank Name</label>
                  <input
                    type="text"
                    placeholder="Bank name"
                    value={paymentDetailForm.bankName}
                    onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, bankName: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Account Number</label>
                  <input
                    type="text"
                    placeholder="Account number"
                    value={paymentDetailForm.accountNumber}
                    onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, accountNumber: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Check Number</label>
                  <input
                    type="text"
                    placeholder="Check number"
                    value={paymentDetailForm.checkNumber}
                    onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, checkNumber: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Check Date</label>
                  <input
                    type="date"
                    value={paymentDetailForm.checkDate}
                    onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, checkDate: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Transaction ID</label>
                <input
                  type="text"
                  placeholder="Transaction ID"
                  value={paymentDetailForm.transactionId}
                  onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, transactionId: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</label>
                <textarea
                  placeholder="Additional notes"
                  value={paymentDetailForm.notes}
                  onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white resize-none"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowPaymentDetailModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition font-medium disabled:opacity-50"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSavePaymentDetail}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium disabled:opacity-50 flex items-center gap-2"
                disabled={submitting}
              >
                {submitting && <Loader className="w-4 h-4 animate-spin" />}
                <Save size={16} />
                Save Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PAYMENT DETAIL EDIT MODAL ==================== */}
      {showPaymentDetailEditModal && selectedCreditor && selectedPaymentDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Payment Details</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">For: {safeString(selectedCreditor.name)}</p>
              </div>
              <button
                onClick={() => setShowPaymentDetailEditModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                disabled={submitting}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Amount (KES) *</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={paymentDetailForm.amount}
                    onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, amount: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                  <input
                    type="text"
                    placeholder="Payment description"
                    value={paymentDetailForm.description}
                    onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, description: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Invoice Number</label>
                  <input
                    type="text"
                    placeholder="INV-2024-001"
                    value={paymentDetailForm.invoiceNumber}
                    onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, invoiceNumber: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Payment Reference</label>
                  <input
                    type="text"
                    placeholder="REF-12345"
                    value={paymentDetailForm.paymentReference}
                    onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, paymentReference: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Due Date</label>
                <input
                  type="date"
                  value={paymentDetailForm.dueDate}
                  onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, dueDate: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bank Name</label>
                  <input
                    type="text"
                    placeholder="Bank name"
                    value={paymentDetailForm.bankName}
                    onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, bankName: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Account Number</label>
                  <input
                    type="text"
                    placeholder="Account number"
                    value={paymentDetailForm.accountNumber}
                    onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, accountNumber: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Check Number</label>
                  <input
                    type="text"
                    placeholder="Check number"
                    value={paymentDetailForm.checkNumber}
                    onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, checkNumber: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Check Date</label>
                  <input
                    type="date"
                    value={paymentDetailForm.checkDate}
                    onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, checkDate: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Transaction ID</label>
                <input
                  type="text"
                  placeholder="Transaction ID"
                  value={paymentDetailForm.transactionId}
                  onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, transactionId: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</label>
                <textarea
                  placeholder="Additional notes"
                  value={paymentDetailForm.notes}
                  onChange={(e) => setPaymentDetailForm({ ...paymentDetailForm, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white resize-none"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowPaymentDetailEditModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition font-medium disabled:opacity-50"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSavePaymentDetail}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium disabled:opacity-50 flex items-center gap-2"
                disabled={submitting}
              >
                {submitting && <Loader className="w-4 h-4 animate-spin" />}
                <Save size={16} />
                Update Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TEMPLATE MODAL ==================== */}
      {showTemplateModal && selectedCreditor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {editingTemplateId ? "Edit Template" : "Save Payment Template"}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">For: {safeString(selectedCreditor.name)}</p>
              </div>
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  setEditingTemplateId(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                disabled={submitting}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Bank Transfer, Standard Payment"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Brief description"
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    placeholder="Bank name"
                    value={templateForm.bankName}
                    onChange={(e) => setTemplateForm({ ...templateForm, bankName: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Account Number
                  </label>
                  <input
                    type="text"
                    placeholder="Account number"
                    value={templateForm.accountNumber}
                    onChange={(e) => setTemplateForm({ ...templateForm, accountNumber: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Account Name
                </label>
                <input
                  type="text"
                  placeholder="Account holder name"
                  value={templateForm.accountName}
                  onChange={(e) => setTemplateForm({ ...templateForm, accountName: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bank Branch
                  </label>
                  <input
                    type="text"
                    placeholder="Branch location"
                    value={templateForm.bankBranch}
                    onChange={(e) => setTemplateForm({ ...templateForm, bankBranch: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Swift Code
                  </label>
                  <input
                    type="text"
                    placeholder="SWIFT/BIC code"
                    value={templateForm.swiftCode}
                    onChange={(e) => setTemplateForm({ ...templateForm, swiftCode: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Default Payment Method
                </label>
                <select
                  value={templateForm.defaultPaymentMethod}
                  onChange={(e) => setTemplateForm({ ...templateForm, defaultPaymentMethod: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  placeholder="Additional notes"
                  value={templateForm.notes}
                  onChange={(e) => setTemplateForm({ ...templateForm, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition dark:bg-gray-700 dark:text-white resize-none"
                  disabled={submitting}
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={templateForm.isDefault}
                  onChange={(e) => setTemplateForm({ ...templateForm, isDefault: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  disabled={submitting}
                />
                <label htmlFor="isDefault" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Set as default template
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  setEditingTemplateId(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition font-medium disabled:opacity-50"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-medium disabled:opacity-50 flex items-center gap-2"
                disabled={submitting}
              >
                {submitting && <Loader className="w-4 h-4 animate-spin" />}
                <Save size={16} />
                {editingTemplateId ? "Update" : "Save"} Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SHARE MODAL ==================== */}
      {showShareModal && sharingCreditor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Share Payment Details</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Share with: {safeString(sharingCreditor.name)}</p>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h3 className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <Info size={18} />
                  Message Preview
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-4">
                  {decodeURIComponent(generateWhatsAppMessage(sharingCreditor)).substring(0, 200)}...
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    shareViaWhatsApp(sharingCreditor);
                    setShowShareModal(false);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg transition flex items-center justify-center gap-2 font-medium"
                >
                  <Send size={18} />
                  Share via WhatsApp
                </button>

                <button
                  onClick={() => {
                    copyToClipboard(sharingCreditor);
                    setShowShareModal(false);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition flex items-center justify-center gap-2 font-medium"
                >
                  <Copy size={18} />
                  Copy Message to Clipboard
                </button>

                <button
                  onClick={() => {
                    const message = generateWhatsAppMessage(sharingCreditor);
                    const url = `data:text/plain;charset=utf-8,${message}`;
                    window.open(url, '_blank');
                    setShowShareModal(false);
                  }}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-lg transition flex items-center justify-center gap-2 font-medium"
                >
                  <FileText size={18} />
                  View Full Message
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}