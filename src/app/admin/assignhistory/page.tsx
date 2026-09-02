// src/app/admin/assignhistory/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Package,
  User,
  Calendar,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  ShoppingBag,
  FileText,
  Printer,
  Moon,
  Sun,
  LogOut,
  LayoutDashboard,
  Home,
  ArrowLeft,
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Hash,
  Building2,
  Phone,
  Mail,
  CreditCard,
  Wallet,
  Receipt,
  BarChart3,
  ListChecks,
  Layers,
  Grid,
  List,
  SortAsc,
  SortDesc,
  FilterX,
  Zap,
  PackagePlus,
  PackageMinus,
  TrendingUp as TrendingUpIcon,
  CalendarDays,
  Clock as ClockIcon,
  UserPlus,
  Edit,
  Trash2,
  Table
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ==================== INTERFACES ====================

interface Staff {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  department?: string;
}

interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  category?: string;
  productionCost?: number;
  sku?: string;
  brand?: string;
  model?: string;
}

interface SaleItem {
  id: number;
  quantity: number;
  price: number;
  total: number;
  saleId: number;
  sale?: {
    id: number;
    date: string;
    status: string;
    customer?: {
      name: string;
      phone?: string;
    };
  };
}

interface StaffInventory {
  id: number;
  staffId: number;
  productId: number;
  weekStartDate: string | null;
  weekEndDate: string | null;
  quantityGiven: number;
  quantitySold: number;
  quantityReturned: number;
  staff: Staff;
  product: Product;
  saleItems: SaleItem[];
  createdAt: string;
  updatedAt: string;
  status: 'ACTIVE' | 'COMPLETED' | 'OVERDUE' | 'PENDING';
  totalSalesAmount: number;
  remainingQuantity: number;
  sellThroughRate: number;
  isCurrentWeek: boolean;
  weekRange?: string;
  // Added for date display
  assignedDateFormatted?: string;
  assignedTimeAgo?: string;
}

type FilterStatus = 'all' | 'active' | 'completed' | 'overdue' | 'pending';
type ViewMode = 'table' | 'cards' | 'list';
type SortField = 'staff' | 'product' | 'quantity' | 'status' | 'date' | 'sales' | 'sellThrough';

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
    { id: 'staff', label: 'Staff', icon: Users, path: '/admin/staff' },
    { id: 'assigned', label: 'Assigned History', icon: Package, path: '/admin/assignhistory' },
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
export default function AssignedHistoryPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const router = useRouter();
  
  // Data states
  const [assignments, setAssignments] = useState<StaffInventory[]>([]);
  const [filteredAssignments, setFilteredAssignments] = useState<StaffInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // UI states
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<StaffInventory | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [dateRange, setDateRange] = useState<"all" | "current" | "past" | "custom">("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  
  // Staff and product lists for filters
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [productList, setProductList] = useState<Product[]>([]);

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
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string): string => {
    if (!dateString) return "N/A";
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

  const formatTimeAgo = (dateString: string): string => {
    if (!dateString) return "N/A";
    try {
      const now = new Date();
      const date = new Date(dateString);
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return formatDate(dateString);
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

  const getWeekRange = (startDate: string | null, endDate: string | null): string => {
    if (!startDate || !endDate) return "No week specified";
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'ACTIVE': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-200';
      case 'OVERDUE': return 'bg-red-100 text-red-800 border-red-200';
      case 'PENDING': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'ACTIVE': return <CheckCircle size={14} className="text-emerald-600" />;
      case 'COMPLETED': return <Check size={14} className="text-green-600" />;
      case 'OVERDUE': return <AlertCircle size={14} className="text-red-600" />;
      case 'PENDING': return <Clock size={14} className="text-amber-600" />;
      default: return null;
    }
  };

  // ==================== DATA FETCHING ====================
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Please log in to view assigned stock history");
        setLoading(false);
        return;
      }

      const token = await user.getIdToken();

      // Fetch staff inventory assignments with all details
      const response = await fetch("/api/staff-inventory?includeAllWeeks=true", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error("Failed to fetch assigned stock history");
      }

      const data = await response.json();
      
      // Process and enrich the data
      const enrichedData = data.map((assignment: any) => {
        const remaining = assignment.quantityGiven - assignment.quantitySold - assignment.quantityReturned;
        const sellThroughRate = assignment.quantityGiven > 0 
          ? (assignment.quantitySold / assignment.quantityGiven) * 100 
          : 0;
        
        const isCurrentWeek = assignment.weekStartDate && assignment.weekEndDate
          ? isDateInCurrentWeek(assignment.weekStartDate)
          : false;

        return {
          ...assignment,
          remainingQuantity: remaining,
          sellThroughRate: sellThroughRate,
          isCurrentWeek: isCurrentWeek,
          weekRange: getWeekRange(assignment.weekStartDate, assignment.weekEndDate),
          totalSalesAmount: assignment.quantitySold * (assignment.product?.price || 0),
          saleItems: assignment.saleItems || [],
          assignedDateFormatted: formatDateTime(assignment.createdAt),
          assignedTimeAgo: formatTimeAgo(assignment.createdAt)
        };
      });

      setAssignments(enrichedData);
      setFilteredAssignments(enrichedData);

      // Extract staff and product lists for filters
      const staffMap = new Map<number, Staff>();
      const productMap = new Map<number, Product>();
      
      enrichedData.forEach((a: StaffInventory) => {
        if (a.staff && !staffMap.has(a.staff.id)) {
          staffMap.set(a.staff.id, a.staff);
        }
        if (a.product && !productMap.has(a.product.id)) {
          productMap.set(a.product.id, a.product);
        }
      });
      
      setStaffList(Array.from(staffMap.values()));
      setProductList(Array.from(productMap.values()));

    } catch (err: any) {
      console.error("Error fetching assigned stock:", err);
      setError(err.message || "Failed to load assigned stock history");
    } finally {
      setLoading(false);
    }
  }, []);

  // Helper: Check if date is in current week
  const isDateInCurrentWeek = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return date >= startOfWeek && date <= endOfWeek;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchData();
      } else {
        setError("Please log in to view assigned stock history");
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, [fetchData]);

  // ==================== FILTERING ====================
  useEffect(() => {
    let filtered = [...assignments];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(a => 
        a.staff?.name?.toLowerCase().includes(term) ||
        a.product?.name?.toLowerCase().includes(term) ||
        a.product?.sku?.toLowerCase().includes(term) ||
        a.product?.category?.toLowerCase().includes(term) ||
        a.staff?.email?.toLowerCase().includes(term) ||
        a.staff?.phone?.includes(term)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(a => a.status === statusFilter.toUpperCase());
    }

    // Staff filter
    if (staffFilter !== "all") {
      filtered = filtered.filter(a => a.staffId === parseInt(staffFilter));
    }

    // Product filter
    if (productFilter !== "all") {
      filtered = filtered.filter(a => a.productId === parseInt(productFilter));
    }

    // Date range filter
    if (dateRange === "current") {
      filtered = filtered.filter(a => a.isCurrentWeek);
    } else if (dateRange === "past") {
      filtered = filtered.filter(a => !a.isCurrentWeek);
    } else if (dateRange === "custom" && startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(a => {
        if (!a.weekStartDate) return false;
        const weekStart = new Date(a.weekStartDate);
        return weekStart >= start && weekStart <= end;
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch(sortField) {
        case 'staff':
          aVal = a.staff?.name?.toLowerCase() || '';
          bVal = b.staff?.name?.toLowerCase() || '';
          break;
        case 'product':
          aVal = a.product?.name?.toLowerCase() || '';
          bVal = b.product?.name?.toLowerCase() || '';
          break;
        case 'quantity':
          aVal = a.quantityGiven;
          bVal = b.quantityGiven;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'date':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case 'sales':
          aVal = a.totalSalesAmount || 0;
          bVal = b.totalSalesAmount || 0;
          break;
        case 'sellThrough':
          aVal = a.sellThroughRate || 0;
          bVal = b.sellThroughRate || 0;
          break;
        default:
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredAssignments(filtered);
  }, [assignments, searchTerm, statusFilter, dateRange, startDate, endDate, staffFilter, productFilter, sortField, sortOrder]);

  // ==================== SUMMARY STATS ====================
  const getSummaryStats = useCallback(() => {
    const totalAssignments = filteredAssignments.length;
    const totalItemsGiven = filteredAssignments.reduce((sum, a) => sum + a.quantityGiven, 0);
    const totalItemsSold = filteredAssignments.reduce((sum, a) => sum + a.quantitySold, 0);
    const totalItemsReturned = filteredAssignments.reduce((sum, a) => sum + a.quantityReturned, 0);
    const totalItemsRemaining = totalItemsGiven - totalItemsSold - totalItemsReturned;
    const totalSalesValue = filteredAssignments.reduce((sum, a) => sum + (a.totalSalesAmount || 0), 0);
    const avgSellThrough = totalItemsGiven > 0 ? (totalItemsSold / totalItemsGiven) * 100 : 0;

    const active = filteredAssignments.filter(a => a.status === 'ACTIVE').length;
    const completed = filteredAssignments.filter(a => a.status === 'COMPLETED').length;
    const overdue = filteredAssignments.filter(a => a.status === 'OVERDUE').length;
    const pending = filteredAssignments.filter(a => a.status === 'PENDING').length;

    return {
      totalAssignments,
      totalItemsGiven,
      totalItemsSold,
      totalItemsReturned,
      totalItemsRemaining,
      totalSalesValue,
      avgSellThrough,
      active,
      completed,
      overdue,
      pending
    };
  }, [filteredAssignments]);

  const stats = getSummaryStats();

  // ==================== DETAIL MODAL ====================
  const viewAssignmentDetails = (assignment: StaffInventory) => {
    setSelectedAssignment(assignment);
    setShowDetailModal(true);
  };

  // ==================== EXPORT ====================
  const exportToCSV = () => {
    if (filteredAssignments.length === 0) return;

    const csvData = filteredAssignments.map(a => ({
      'Staff': a.staff?.name || 'N/A',
      'Staff Phone': a.staff?.phone || 'N/A',
      'Staff Email': a.staff?.email || 'N/A',
      'Product': a.product?.name || 'N/A',
      'Product SKU': a.product?.sku || 'N/A',
      'Category': a.product?.category || 'N/A',
      'Assigned Date': a.assignedDateFormatted || 'N/A',
      'Week Start': formatDate(a.weekStartDate),
      'Week End': formatDate(a.weekEndDate),
      'Quantity Given': a.quantityGiven,
      'Quantity Sold': a.quantitySold,
      'Quantity Returned': a.quantityReturned,
      'Remaining': a.remainingQuantity,
      'Sell Through %': a.sellThroughRate.toFixed(1) + '%',
      'Sales Value': 'KES ' + formatCurrency(a.totalSalesAmount || 0),
      'Status': a.status,
    }));

    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => `"${String(row[h as keyof typeof row]).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `assigned_stock_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  // ==================== RENDER ====================

  // Assignment Card Component
  const AssignmentCard = ({ assignment }: { assignment: StaffInventory }) => {
    const isExpanded = expandedId === assignment.id;
    const remaining = assignment.remainingQuantity;
    const sellThroughRate = assignment.sellThroughRate;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
        <div 
          className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
          onClick={() => setExpandedId(isExpanded ? null : assignment.id)}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {assignment.staff?.name || 'Unknown Staff'}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                  {getStatusIcon(assignment.status)}
                  {assignment.status}
                </span>
                {assignment.isCurrentWeek && (
                  <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">
                    Current Week
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Package size={14} />
                  {assignment.product?.name || 'Unknown Product'}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {assignment.weekRange}
                </span>
                {assignment.product?.sku && (
                  <span className="flex items-center gap-1 text-xs font-mono">
                    <Hash size={12} />
                    {assignment.product.sku}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">Given</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{assignment.quantityGiven}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">Sold</div>
                <div className="text-lg font-bold text-emerald-600">{assignment.quantitySold}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">Remaining</div>
                <div className={`text-lg font-bold ${remaining > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                  {remaining}
                </div>
              </div>
              <div className="text-center min-w-[60px]">
                <div className="text-xs text-gray-500 dark:text-gray-400">Sell Through</div>
                <div className="text-lg font-bold text-purple-600">{sellThroughRate.toFixed(1)}%</div>
              </div>
            </div>
          </div>

          {/* Sales Value & Actions Bar - Enhanced with Assignment Date */}
          <div className="flex flex-wrap items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-sm">
                <DollarSign size={16} className="text-green-600" />
                <span className="text-gray-700 dark:text-gray-300">Sales: </span>
                <span className="font-semibold text-green-600">KES {formatCurrency(assignment.totalSalesAmount || 0)}</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Clock size={16} className="text-blue-500" />
                <span className="text-gray-700 dark:text-gray-300">Assigned: </span>
                <span className="font-semibold text-blue-600">{assignment.assignedTimeAgo || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Calendar size={12} />
                <span>{assignment.assignedDateFormatted || 'N/A'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  viewAssignmentDetails(assignment);
                }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                <Eye size={14} />
                Details
              </button>
            </div>
          </div>
        </div>

        {/* Expanded Content - Shows full assignment date */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl">
            <div className="pt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Assignment Date Info */}
              <div className="md:col-span-1">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Clock size={14} className="text-blue-500" />
                  Assignment Date & Time
                </h4>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Assigned:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{assignment.assignedDateFormatted || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Time ago:</span>
                    <span className="font-medium text-blue-600">{assignment.assignedTimeAgo || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Updated:</span>
                    <span className="text-gray-600">{formatDateTime(assignment.updatedAt)}</span>
                  </div>
                </div>
              </div>

              {/* Sale Items */}
              {assignment.saleItems && assignment.saleItems.length > 0 && (
                <div className="md:col-span-2">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Sales from this assignment</h4>
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th className="px-3 py-1.5 text-left">Sale ID</th>
                          <th className="px-3 py-1.5 text-left">Customer</th>
                          <th className="px-3 py-1.5 text-center">Qty</th>
                          <th className="px-3 py-1.5 text-right">Price</th>
                          <th className="px-3 py-1.5 text-right">Total</th>
                          <th className="px-3 py-1.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {assignment.saleItems.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-3 py-1.5 font-medium">#{item.saleId}</td>
                            <td className="px-3 py-1.5">{item.sale?.customer?.name || 'Walk-in'}</td>
                            <td className="px-3 py-1.5 text-center">{item.quantity}</td>
                            <td className="px-3 py-1.5 text-right">KES {formatCurrency(item.price)}</td>
                            <td className="px-3 py-1.5 text-right font-semibold">KES {formatCurrency(item.total)}</td>
                            <td className="px-3 py-1.5 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${
                                item.sale?.status === 'PAID' ? 'bg-green-100 text-green-700' :
                                item.sale?.status === 'UNPAID' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {item.sale?.status || 'N/A'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Assignment Details */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Assignment Details</h4>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Staff:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{assignment.staff?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Product:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{assignment.product?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Given:</span>
                    <span className="font-medium">{assignment.quantityGiven} units</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Sold:</span>
                    <span className="font-medium text-emerald-600">{assignment.quantitySold} units</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Returned:</span>
                    <span className="font-medium text-amber-600">{assignment.quantityReturned} units</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Remaining:</span>
                    <span className={`font-medium ${remaining > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                      {remaining} units
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Sell Through:</span>
                    <span className="font-medium text-purple-600">{sellThroughRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={`min-h-screen transition-colors duration-200 ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        
        <NavigationBar activePage="assigned" />
        
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
                <div className="flex items-center gap-3">
                  <Link 
                    href="/admin/staff"
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <ArrowLeft size={20} />
                  </Link>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                      <Package size={24} />
                      Assigned Stock History
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">Track all inventory assignments to staff members with dates</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setViewMode(viewMode === 'table' ? 'cards' : viewMode === 'cards' ? 'list' : 'table');
                  }}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  {viewMode === 'table' && <Table size={16} />}
                  {viewMode === 'cards' && <Grid size={16} />}
                  {viewMode === 'list' && <List size={16} />}
                  {viewMode === 'table' ? 'Table' : viewMode === 'cards' ? 'Cards' : 'List'}
                </button>
                <button
                  onClick={exportToCSV}
                  disabled={filteredAssignments.length === 0}
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

          {/* Summary Stats */}
          {!loading && filteredAssignments.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-blue-500">
                <div className="text-xs text-gray-500">Total Assignments</div>
                <div className="text-xl font-bold text-blue-600">{stats.totalAssignments}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-emerald-500">
                <div className="text-xs text-gray-500">Active</div>
                <div className="text-xl font-bold text-emerald-600">{stats.active}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-green-500">
                <div className="text-xs text-gray-500">Completed</div>
                <div className="text-xl font-bold text-green-600">{stats.completed}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-red-500">
                <div className="text-xs text-gray-500">Overdue</div>
                <div className="text-xl font-bold text-red-600">{stats.overdue}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-amber-500">
                <div className="text-xs text-gray-500">Pending</div>
                <div className="text-xl font-bold text-amber-600">{stats.pending}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-purple-500">
                <div className="text-xs text-gray-500">Items Sold</div>
                <div className="text-xl font-bold text-purple-600">{stats.totalItemsSold}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-orange-500">
                <div className="text-xs text-gray-500">Sales Value</div>
                <div className="text-sm font-bold text-orange-600">KES {formatCurrency(stats.totalSalesValue)}</div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
            <div className="p-3 border-b dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-500" />
                <span className="font-medium text-sm">Filters</span>
                {(searchTerm || statusFilter !== "all" || dateRange !== "all" || staffFilter !== "all" || productFilter !== "all") && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("all");
                      setDateRange("all");
                      setStaffFilter("all");
                      setProductFilter("all");
                      setStartDate("");
                      setEndDate("");
                    }}
                    className="ml-auto text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                  >
                    <FilterX size={14} />
                    Clear All
                  </button>
                )}
              </div>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Staff, product, SKU..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
                    className="w-full p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="overdue">Overdue</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date Range</label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value as any)}
                    className="w-full p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="all">All Time</option>
                    <option value="current">Current Week</option>
                    <option value="past">Past Weeks</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>
                {dateRange === "custom" && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Staff</label>
                  <select
                    value={staffFilter}
                    onChange={(e) => setStaffFilter(e.target.value)}
                    className="w-full p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="all">All Staff</option>
                    {staffList.map(staff => (
                      <option key={staff.id} value={staff.id}>{staff.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Product</label>
                  <select
                    value={productFilter}
                    onChange={(e) => setProductFilter(e.target.value)}
                    className="w-full p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="all">All Products</option>
                    {productList.map(product => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
              <p className="text-gray-500">Loading assigned stock history...</p>
            </div>
          )}

          {/* No Data State */}
          {!loading && filteredAssignments.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center">
              <Package size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No assignments found</p>
              <p className="text-xs text-gray-400 mt-1">
                {searchTerm || statusFilter !== "all" || dateRange !== "all" 
                  ? "Try adjusting your filters" 
                  : "Start by assigning products to staff members"}
              </p>
            </div>
          )}

          {/* Results Count */}
          {!loading && filteredAssignments.length > 0 && (
            <div className="mb-3 text-sm text-gray-500 flex justify-between items-center">
              <span>Showing {filteredAssignments.length} assignments</span>
              <div className="flex items-center gap-2">
                <span>Sort by:</span>
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as SortField)}
                  className="px-2 py-1 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="date">Date</option>
                  <option value="staff">Staff</option>
                  <option value="product">Product</option>
                  <option value="quantity">Quantity</option>
                  <option value="status">Status</option>
                  <option value="sales">Sales Value</option>
                  <option value="sellThrough">Sell Through</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-2 py-1 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          )}

          {/* Assignments Display */}
          {!loading && filteredAssignments.length > 0 && (
            <>
              {viewMode === 'table' ? (
                // Table View - Enhanced with Assignment Date column
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700/50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Assigned Date</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Staff</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Product</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Given</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Sold</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Remaining</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Sell Through</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Status</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredAssignments.map((assignment) => (
                          <tr key={assignment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900 dark:text-white">{assignment.assignedDateFormatted || 'N/A'}</span>
                                <span className="text-xs text-blue-600">{assignment.assignedTimeAgo || 'N/A'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                  <User size={14} className="text-blue-600" />
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white">{assignment.staff?.name}</div>
                                  {assignment.staff?.phone && (
                                    <div className="text-xs text-gray-500">{assignment.staff.phone}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900 dark:text-white">{assignment.product?.name}</div>
                              {assignment.product?.sku && (
                                <div className="text-xs text-gray-500 font-mono">{assignment.product.sku}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold">{assignment.quantityGiven}</td>
                            <td className="px-4 py-3 text-center font-semibold text-emerald-600">{assignment.quantitySold}</td>
                            <td className={`px-4 py-3 text-center font-semibold ${assignment.remainingQuantity > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                              {assignment.remainingQuantity}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${assignment.sellThroughRate > 70 ? 'bg-green-500' : assignment.sellThroughRate > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                    style={{ width: `${Math.min(assignment.sellThroughRate, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium">{assignment.sellThroughRate.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                                {getStatusIcon(assignment.status)}
                                {assignment.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => viewAssignmentDetails(assignment)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                                title="View Details"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => setExpandedId(expandedId === assignment.id ? null : assignment.id)}
                                className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                              >
                                {expandedId === assignment.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : viewMode === 'cards' ? (
                // Cards View
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredAssignments.map((assignment) => (
                    <AssignmentCard key={assignment.id} assignment={assignment} />
                  ))}
                </div>
              ) : (
                // List View
                <div className="space-y-3">
                  {filteredAssignments.map((assignment) => (
                    <AssignmentCard key={assignment.id} assignment={assignment} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Footer */}
          {!loading && filteredAssignments.length > 0 && (
            <div className="mt-4 text-center text-xs text-gray-400">
              Showing {filteredAssignments.length} assignments | 
              Total items: {stats.totalItemsGiven} | 
              Sold: {stats.totalItemsSold} | 
              Sales value: KES {formatCurrency(stats.totalSalesValue)}
            </div>
          )}
        </div>
      </div>

      {/* ==================== DETAIL MODAL ==================== */}
      {showDetailModal && selectedAssignment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-t-xl flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Assignment Details</h2>
                <p className="text-blue-100 text-sm">
                  {selectedAssignment.staff?.name} - {selectedAssignment.product?.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedAssignment(null);
                }}
                className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Given</div>
                  <div className="text-2xl font-bold text-blue-600">{selectedAssignment.quantityGiven}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Sold</div>
                  <div className="text-2xl font-bold text-emerald-600">{selectedAssignment.quantitySold}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Returned</div>
                  <div className="text-2xl font-bold text-amber-600">{selectedAssignment.quantityReturned}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Sales Value</div>
                  <div className="text-xl font-bold text-green-600">KES {formatCurrency(selectedAssignment.totalSalesAmount || 0)}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Assigned</div>
                  <div className="text-sm font-bold text-blue-600">{selectedAssignment.assignedTimeAgo || 'N/A'}</div>
                </div>
              </div>

              {/* Assignment Info - Enhanced with Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Assignment Info</h3>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Staff:</span>
                      <span className="font-medium">{selectedAssignment.staff?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Product:</span>
                      <span className="font-medium">{selectedAssignment.product?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">SKU:</span>
                      <span className="font-mono">{selectedAssignment.product?.sku || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Category:</span>
                      <span>{selectedAssignment.product?.category || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Assignment Date & Time</h3>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Assigned:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{selectedAssignment.assignedDateFormatted || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Time ago:</span>
                      <span className="font-medium text-blue-600">{selectedAssignment.assignedTimeAgo || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Updated:</span>
                      <span className="text-gray-600">{formatDateTime(selectedAssignment.updatedAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Week Start:</span>
                      <span>{formatDate(selectedAssignment.weekStartDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Week End:</span>
                      <span>{formatDate(selectedAssignment.weekEndDate)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sales Items */}
              {selectedAssignment.saleItems && selectedAssignment.saleItems.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Sales from this assignment</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th className="px-3 py-2 text-left">Sale ID</th>
                          <th className="px-3 py-2 text-left">Customer</th>
                          <th className="px-3 py-2 text-center">Qty</th>
                          <th className="px-3 py-2 text-right">Unit Price</th>
                          <th className="px-3 py-2 text-right">Total</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {selectedAssignment.saleItems.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-3 py-2 font-medium">#{item.saleId}</td>
                            <td className="px-3 py-2">{item.sale?.customer?.name || 'Walk-in'}</td>
                            <td className="px-3 py-2 text-center">{item.quantity}</td>
                            <td className="px-3 py-2 text-right">KES {formatCurrency(item.price)}</td>
                            <td className="px-3 py-2 text-right font-semibold">KES {formatCurrency(item.total)}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                item.sale?.status === 'PAID' ? 'bg-green-100 text-green-700' :
                                item.sale?.status === 'UNPAID' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {item.sale?.status || 'N/A'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t">
                        <tr>
                          <td colSpan={4} className="px-3 py-2 text-right font-semibold">Total Sales:</td>
                          <td className="px-3 py-2 text-right font-bold text-green-600">
                            KES {formatCurrency(selectedAssignment.saleItems.reduce((sum, i) => sum + i.total, 0))}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedAssignment(null);
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
    </ThemeContext.Provider>
  );
}