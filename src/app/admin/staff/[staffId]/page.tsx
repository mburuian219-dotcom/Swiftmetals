"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  Package,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  CreditCard,
  FileText,
  Download,
  Printer,
  BarChart3,
  Users,
  Warehouse,
  CheckCircle,
  AlertCircle,
  X,
  RefreshCw,
  Clock,
  Hash,
  Trash2,
  Edit,
  ChevronDown,
  ChevronUp,
  PieChart,
  TrendingDown,
  Search,
  Filter
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

// Define interfaces
interface Staff {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
  staffInventories?: StaffInventory[];
  sales?: Sale[];
  stats?: StaffStats;
}

interface StaffInventory {
  id: number;
  staffId: number;
  productId: number;
  quantityGiven: number;
  quantitySold: number;
  quantityReturned: number;
  createdAt: Date;
  updatedAt: Date;
  product: Product;
}

interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  productionCost?: number;
  category?: string;
  image?: string;
}

interface Sale {
  id: number;
  amount: number;
  date: Date;
  paymentMethod: string;
  status: string;
  createdAt: Date;
  createdBy?: string;
  createdById?: number;
  saleitem?: SaleItem[];
  customer?: Customer;
  payment?: Payment[];
  staff?: any;
}

interface SaleItem {
  id: number;
  quantity: number;
  price: number;
  total: number;
  product: Product;
}

interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

interface Payment {
  id: number;
  amount: number;
  method: string;
  status: string;
  paidAt: Date;
}

interface StaffStats {
  sales: {
    total: number;
    totalAmount: number;
    totalPaid: number;
    averageSale: number;
  };
  inventory: {
    given: number;
    sold: number;
    returned: number;
    remaining: number;
    value: number;
  };
  performance: {
    salesByMethod: Array<{ method: string; count: number; amount: number }>;
    salesByMonth: Array<{ month: string; count: number; amount: number }>;
    salesSources: {
      directRelation: number;
      emailMatched: number;
      total: number;
    };
  };
}

interface StaffSummary {
  totalInventoryGiven: number;
  totalInventorySold: number;
  totalInventoryReturned: number;
  totalInventoryValue: number;
  totalSalesAmount: number;
  totalSalesCount: number;
  averageSaleValue: number;
}

const StaffDetailsPage = () => {
  const router = useRouter();
  const params = useParams();
  const staffId = params.staffId as string;

  // States
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [deletingInventory, setDeletingInventory] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false); // Add debug mode
  const [apiResponse, setApiResponse] = useState<any>(null); // Store API response
  
  const [summary, setSummary] = useState<StaffSummary>({
    totalInventoryGiven: 0,
    totalInventorySold: 0,
    totalInventoryReturned: 0,
    totalInventoryValue: 0,
    totalSalesAmount: 0,
    totalSalesCount: 0,
    averageSaleValue: 0
  });
  
  // Mobile view states
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [expandedInventoryId, setExpandedInventoryId] = useState<number | null>(null);
  
  // Filters
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: ""
  });
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch staff details with all related data
  const fetchStaffDetails = useCallback(async () => {
    if (!staffId) return;

    setLoading(true);
    setError(null);

    try {
      console.log(`🔍 Fetching staff details for ID: ${staffId}`);
      
      // Fetch staff with all related data from updated API
      const response = await fetch(`/api/staff/${staffId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Staff member not found");
        }
        throw new Error(`Failed to fetch staff: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Store API response for debugging
      setApiResponse(data);
      
      // Debug logging
      console.log("🔄 Staff API Response:", {
        staffName: data.name,
        staffEmail: data.email,
        salesCount: data.sales?.length || 0,
        salesSample: data.sales?.[0],
        stats: data.stats,
        directSales: data.stats?.performance?.salesSources?.directRelation,
        emailSales: data.stats?.performance?.salesSources?.emailMatched,
        hasStaffInventories: Array.isArray(data.staffInventories),
        staffInventoriesCount: data.staffInventories?.length || 0
      });
      
      setStaff(data);
      
      // Calculate summary statistics
      calculateSummary(data);

    } catch (err: any) {
      console.error("❌ Error fetching staff details:", err);
      setError(err.message || "Failed to load staff details");
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  // Calculate summary statistics
  const calculateSummary = (staffData: Staff) => {
    // If API provides stats, use them
    if (staffData.stats) {
      console.log("📊 Using API stats for summary");
      setSummary({
        totalInventoryGiven: staffData.stats.inventory.given,
        totalInventorySold: staffData.stats.inventory.sold,
        totalInventoryReturned: staffData.stats.inventory.returned,
        totalInventoryValue: staffData.stats.inventory.value,
        totalSalesAmount: staffData.stats.sales.totalAmount,
        totalSalesCount: staffData.stats.sales.total,
        averageSaleValue: staffData.stats.sales.averageSale
      });
    } else {
      console.log("📊 Calculating summary from raw data");
      // Fallback calculation for backward compatibility
      let totalInventoryGiven = 0;
      let totalInventorySold = 0;
      let totalInventoryReturned = 0;
      let totalInventoryValue = 0;
      let totalSalesAmount = 0;
      let totalSalesCount = staffData.sales?.length || 0;

      // Calculate inventory stats
      staffData.staffInventories?.forEach(inventory => {
        totalInventoryGiven += inventory.quantityGiven;
        totalInventorySold += inventory.quantitySold;
        totalInventoryReturned += inventory.quantityReturned;
        
        if (inventory.product?.productionCost) {
          totalInventoryValue += inventory.product.productionCost * inventory.quantityGiven;
        }
      });

      // Calculate sales stats
      staffData.sales?.forEach(sale => {
        totalSalesAmount += sale.amount;
      });

      const averageSaleValue = totalSalesCount > 0 ? totalSalesAmount / totalSalesCount : 0;

      setSummary({
        totalInventoryGiven,
        totalInventorySold,
        totalInventoryReturned,
        totalInventoryValue,
        totalSalesAmount,
        totalSalesCount,
        averageSaleValue
      });
    }
  };

  // Calculate sale status from payments
  const calculateSaleStatus = (sale: Sale) => {
    // If API already provides status, use it
    if (sale.status) return sale.status;
    
    // Otherwise calculate from payments
    if (!sale.payment || sale.payment.length === 0) {
      return "UNPAID";
    }
    
    const totalPaid = sale.payment
      .filter(p => p.status === "CLEARED" || p.status === "COMPLETED")
      .reduce((sum, p) => sum + p.amount, 0);
    
    const pendingPayments = sale.payment.filter(p => 
      p.status === "PENDING" || p.status === "BOUNCED"
    );
    
    if (totalPaid >= sale.amount && pendingPayments.length === 0) {
      return "PAID";
    } else if (totalPaid > 0 || pendingPayments.length > 0) {
      return "PARTIAL";
    }
    
    return "UNPAID";
  };

  // Handle date filter changes
  const handleDateFilter = () => {
    if (!staffId) return;
    
    setLoadingData(true);
    // You can implement filtered API calls here
    setTimeout(() => {
      setLoadingData(false);
    }, 1000);
  };

  // Delete assigned inventory
  const handleDeleteInventory = async (inventoryId: number) => {
    if (!confirm("Are you sure you want to delete this inventory assignment? This action cannot be undone.")) {
      return;
    }

    setDeletingInventory(inventoryId);
    setError(null);

    try {
      const response = await fetch(`/api/staff-inventory?id=${inventoryId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete inventory assignment");
      }

      setSuccess("Inventory assignment deleted successfully!");
      
      // Refresh staff data
      setTimeout(() => {
        fetchStaffDetails();
        setSuccess(null);
      }, 2000);

    } catch (err: any) {
      console.error("Error deleting inventory:", err);
      setError(err.message || "Failed to delete inventory assignment");
      setTimeout(() => setError(null), 5000);
    } finally {
      setDeletingInventory(null);
    }
  };

  // Export staff report as CSV
  const exportReport = async (format: 'csv' | 'pdf' = 'csv') => {
    if (!staff) return;

    try {
      const response = await fetch(`/api/staff/${staffId}/export?format=${format}`);
      
      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `staff-report-${staff.name}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else if (format === 'pdf') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } catch (err) {
      console.error("Error exporting report:", err);
      setError("Failed to export report");
    }
  };

  // Calculate remaining inventory
  const calculateRemainingInventory = (inventory: StaffInventory) => {
    return inventory.quantityGiven - inventory.quantitySold - inventory.quantityReturned;
  };

  // Get inventory status
  const getInventoryStatus = (inventory: StaffInventory) => {
    const remaining = calculateRemainingInventory(inventory);
    if (remaining <= 0) return { text: "Completed", color: "bg-green-100 text-green-800" };
    if (inventory.quantitySold > 0) return { text: "In Progress", color: "bg-blue-100 text-blue-800" };
    return { text: "Assigned", color: "bg-gray-100 text-gray-800" };
  };

  // Toggle mobile inventory view
  const toggleInventoryExpansion = (inventoryId: number) => {
    setExpandedInventoryId(expandedInventoryId === inventoryId ? null : inventoryId);
  };

  // Format month-year for display
  const formatMonthYear = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-KE', { month: 'short', year: 'numeric' });
  };

  // Filter sales by search term
  const filteredSales = staff?.sales?.filter(sale => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      sale.id.toString().includes(searchLower) ||
      sale.customer?.name?.toLowerCase().includes(searchLower) ||
      sale.paymentMethod?.toLowerCase().includes(searchLower) ||
      sale.createdBy?.toLowerCase().includes(searchLower)
    );
  }) || [];

  // Initial load
  useEffect(() => {
    fetchStaffDetails();
  }, [fetchStaffDetails]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('KES', 'KSh ');
  };

  // Format date
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Format time
  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString('en-KE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Get sales linked via
  const getSaleLinkType = (sale: Sale) => {
    if (sale.createdById === staff?.id) {
      return { type: "Direct", color: "bg-blue-100 text-blue-800" };
    }
    if (staff?.email && sale.createdBy === staff.email) {
      return { type: "Email", color: "bg-purple-100 text-purple-800" };
    }
    return { type: "Other", color: "bg-gray-100 text-gray-800" };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-2 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <div className="mt-4 text-gray-900">Loading staff details...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !staff) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-2 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg sm:rounded-xl p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-red-800 text-sm sm:text-base">Error Loading Staff Details</div>
                <div className="text-red-700 mt-1 text-xs sm:text-sm">{error}</div>
                <button
                  onClick={() => router.push('/admin/staff')}
                  className="mt-4 inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm"
                >
                  <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                  Back to Staff Management
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-2 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg sm:rounded-xl p-6 sm:p-8 text-center">
            <User className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-400 mx-auto mb-4" />
            <div className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Staff Not Found</div>
            <div className="text-gray-700 mb-6 text-sm sm:text-base">The staff member you're looking for doesn't exist or has been removed.</div>
            <button
              onClick={() => router.push('/admin/staff')}
              className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              Back to Staff Management
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-2 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Debug Mode Toggle */}
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setDebugMode(!debugMode)}
            className="px-3 py-1 bg-gray-800 text-white text-xs rounded-lg hover:bg-gray-900"
          >
            {debugMode ? 'Hide Debug' : 'Debug Mode'}
          </button>
        </div>

        {/* Debug Panel */}
        {debugMode && apiResponse && (
          <div className="mb-4 bg-gray-900 text-white p-4 rounded-lg">
            <div className="font-bold mb-2">🔍 DEBUG INFO:</div>
            <div className="text-xs space-y-2">
              <div><strong>API Response Structure:</strong></div>
              <pre className="bg-gray-800 p-3 rounded overflow-auto max-h-60">
                {JSON.stringify({
                  staffId: apiResponse.id,
                  staffName: apiResponse.name,
                  salesCount: apiResponse.sales?.length,
                  salesArray: apiResponse.sales?.slice(0, 3), // Show first 3 sales
                  stats: apiResponse.stats,
                  hasSales: !!apiResponse.sales,
                  salesType: Array.isArray(apiResponse.sales) ? 'Array' : typeof apiResponse.sales
                }, null, 2)}
              </pre>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-900 p-2 rounded">
                  <div className="font-bold">Direct Sales:</div>
                  <div>{apiResponse.stats?.performance?.salesSources?.directRelation || 0}</div>
                </div>
                <div className="bg-purple-900 p-2 rounded">
                  <div className="font-bold">Email Sales:</div>
                  <div>{apiResponse.stats?.performance?.salesSources?.emailMatched || 0}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
              <X size={16} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-start gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        {/* Header - Mobile Optimized */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <Link
              href="/admin/staff"
              className="inline-flex items-center gap-1 sm:gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm sm:text-base"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Back to Staff</span>
              <span className="sm:hidden">Back</span>
            </Link>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportReport('csv')}
                className="hidden sm:inline-flex items-center gap-2 px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm"
              >
                <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>Export</span>
              </button>
              <button
                onClick={fetchStaffDetails}
                disabled={loadingData}
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-xs sm:text-sm"
              >
                <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${loadingData ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
                <span className="sm:hidden">Reload</span>
              </button>
            </div>
          </div>

          {/* Staff Info Card - Mobile Optimized */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">{staff.name}</div>
                  <div className="flex flex-wrap gap-2 sm:gap-3 text-gray-700">
                    {staff.email && (
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Mail className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                        <div className="font-medium text-xs sm:text-sm truncate max-w-[150px] sm:max-w-none">{staff.email}</div>
                      </div>
                    )}
                    {staff.phone && (
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Phone className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                        <div className="font-medium text-xs sm:text-sm">{staff.phone}</div>
                      </div>
                    )}
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Hash className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                      <div className="font-medium text-xs sm:text-sm">ID: {staff.id}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1 sm:gap-2 text-gray-700">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                    <div className="font-medium text-xs sm:text-sm">Joined {formatDate(staff.createdAt)}</div>
                  </div>
                  
                  {/* Sales Link Info */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span>Direct Sales: {staff.stats?.performance?.salesSources?.directRelation || 0}</span>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                      <span>Email Sales: {staff.stats?.performance?.salesSources?.emailMatched || 0}</span>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span>Total Sales: {staff.stats?.sales?.total || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mt-3 sm:mt-0">
                <div className="text-xs sm:text-sm font-medium text-blue-800 mb-1 sm:mb-2">Status</div>
                <div className="flex items-center gap-1 sm:gap-2">
                  {summary.totalInventoryGiven > 0 ? (
                    <>
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                      <div className="font-semibold text-green-700 text-sm sm:text-base">Active</div>
                      <div className="text-xs sm:text-sm text-green-600">({summary.totalInventoryGiven} items)</div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                      <div className="font-semibold text-gray-700 text-sm sm:text-base">No Inventory</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Filter Toggle */}
        <button
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="sm:hidden w-full mb-4 px-4 py-2 bg-white border border-gray-300 rounded-lg flex items-center justify-between text-gray-700 text-sm"
        >
          <span>Filter Options</span>
          {showMobileFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Date Filter - Responsive */}
        <div className={`bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 mb-4 sm:mb-6 ${showMobileFilters ? 'block' : 'hidden sm:block'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-gray-900 text-sm sm:text-base">Filter Data</div>
              <div className="text-gray-700 text-xs sm:text-sm">Filter by date range</div>
            </div>
            
            <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2">
              <div className="w-full">
                <div className="block text-xs font-medium text-gray-700 mb-1">From</div>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              
              <div className="w-full">
                <div className="block text-xs font-medium text-gray-700 mb-1">To</div>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              
              <div className="col-span-2 sm:w-auto">
                <button
                  onClick={handleDateFilter}
                  disabled={loadingData}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm h-[42px]"
                >
                  Apply Filter
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Stats - Mobile Optimized */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-900 font-medium">Inventory Value</div>
                <div className="text-base sm:text-lg font-bold text-gray-900 mt-1">
                  {formatCurrency(summary.totalInventoryValue)}
                </div>
                <div className="text-xs text-gray-700 mt-1">Production cost</div>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-900 font-medium">Total Sales</div>
                <div className="text-base sm:text-lg font-bold text-gray-900 mt-1">
                  {formatCurrency(summary.totalSalesAmount)}
                </div>
                <div className="text-xs text-gray-700 mt-1">{summary.totalSalesCount} sales</div>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-900 font-medium">Items Assigned</div>
                <div className="text-base sm:text-lg font-bold text-gray-900 mt-1">{summary.totalInventoryGiven}</div>
                <div className="flex gap-1 text-xs text-gray-700 mt-1">
                  <div>{summary.totalInventorySold} sold</div>
                  <div>•</div>
                  <div>{summary.totalInventoryReturned} returned</div>
                </div>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <Warehouse className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-900 font-medium">Avg Sale</div>
                <div className="text-base sm:text-lg font-bold text-gray-900 mt-1">
                  {formatCurrency(summary.averageSaleValue)}
                </div>
                <div className="text-xs text-gray-700 mt-1">Per transaction</div>
              </div>
              <div className="p-2 bg-orange-100 rounded-lg">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Performance Analytics Section */}
        {staff.stats && (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 mb-4 sm:mb-6">
            <div className="mb-4">
              <div className="text-base sm:text-lg font-semibold text-gray-900">Performance Analytics</div>
              <div className="text-gray-700 text-xs sm:text-sm">Detailed performance breakdown</div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Sales Sources */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <PieChart className="w-4 h-4 text-blue-600" />
                  <div className="text-sm font-medium text-gray-900">Sales Sources</div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <div className="text-sm text-gray-700">Direct Relation</div>
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {staff.stats.performance.salesSources.directRelation}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                      <div className="text-sm text-gray-700">Email Match</div>
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {staff.stats.performance.salesSources.emailMatched}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-900">Total</div>
                      <div className="text-sm font-bold text-gray-900">
                        {staff.stats.performance.salesSources.total}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Sales by Payment Method */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-4 h-4 text-green-600" />
                  <div className="text-sm font-medium text-gray-900">Sales by Payment Method</div>
                </div>
                <div className="space-y-2">
                  {staff.stats.performance.salesByMethod.map((method, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="text-sm text-gray-700">{method.method}</div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-gray-500">{method.count}</div>
                        <div className="text-sm font-medium text-green-600">
                          {formatCurrency(method.amount)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Recent Monthly Sales */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-orange-600" />
                  <div className="text-sm font-medium text-gray-900">Recent Monthly Sales</div>
                </div>
                <div className="space-y-2">
                  {staff.stats.performance.salesByMonth.map((month, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="text-sm text-gray-700">{formatMonthYear(month.month)}</div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-gray-500">{month.count} sales</div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(month.amount)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sales Section - Mobile Optimized */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-lg sm:text-xl font-semibold text-gray-900">Sales History</div>
                <div className="text-gray-700 text-sm">
                  Showing {filteredSales.length} of {staff.sales?.length || 0} sales
                  {staff.stats?.performance?.salesSources && (
                    <span className="ml-2 text-xs">
                      (Direct: {staff.stats.performance.salesSources.directRelation}, 
                      Email: {staff.stats.performance.salesSources.emailMatched})
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search sales..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-64"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Data Status Alert */}
          {debugMode && (
            <div className="bg-yellow-50 border-b border-yellow-200 p-3">
              <div className="text-xs text-yellow-800">
                <strong>Data Status:</strong> Staff has {staff.sales?.length || 0} sales in state | 
                Displaying {filteredSales.length} sales | 
                API returned {apiResponse?.sales?.length || 0} sales
              </div>
            </div>
          )}

          {staff.sales && staff.sales.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      Sale ID
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      Linked Via
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider hidden sm:table-cell">
                      Customer
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider hidden md:table-cell">
                      Payment
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredSales.length > 0 ? (
                    filteredSales.map((sale) => {
                      const saleStatus = calculateSaleStatus(sale);
                      const linkType = getSaleLinkType(sale);
                      
                      return (
                        <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 sm:px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="font-mono font-bold text-gray-900 text-sm">#{sale.id}</div>
                              {debugMode && (
                                <div className="text-xs text-gray-500">
                                  (ID: {sale.createdById || 'none'})
                                </div>
                              )}
                            </div>
                            {sale.createdBy && (
                              <div className="text-xs text-gray-500 mt-1 truncate max-w-[120px]">
                                By: {sale.createdBy}
                              </div>
                            )}
                          </td>
                          <td className="px-4 sm:px-6 py-4">
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${linkType.color}`}>
                              {linkType.type}
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4">
                            <div className="text-gray-900 text-sm">{formatDate(sale.date)}</div>
                            <div className="text-xs text-gray-700">
                              {formatTime(sale.date)}
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 hidden sm:table-cell">
                            <div className="text-gray-900 font-medium text-sm">
                              {sale.customer?.name || 'Walk-in Customer'}
                            </div>
                            {sale.customer?.phone && (
                              <div className="text-xs text-gray-700">{sale.customer.phone}</div>
                            )}
                          </td>
                          <td className="px-4 sm:px-6 py-4">
                            <div className="font-bold text-green-600 text-sm sm:text-base">
                              {formatCurrency(sale.amount)}
                            </div>
                            {sale.payment && sale.payment.length > 0 && (
                              <div className="text-xs text-gray-700">
                                Paid: {formatCurrency(sale.payment.reduce((sum, p) => sum + p.amount, 0))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                            <div className={`px-3 py-1 rounded text-xs font-medium ${
                              sale.paymentMethod === 'CASH' 
                                ? 'bg-green-100 text-green-800' 
                                : sale.paymentMethod === 'MPESA'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {sale.paymentMethod}
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4">
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              saleStatus === 'PAID' 
                                ? 'bg-green-100 text-green-800'
                                : saleStatus === 'PARTIAL'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {saleStatus}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 sm:px-6 py-8 text-center">
                        <div className="text-gray-700">No sales match your search criteria</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 sm:px-6 py-12 text-center">
              <ShoppingCart className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
              <div className="text-lg sm:text-xl font-medium text-gray-900 mb-2">No Sales Recorded</div>
              <div className="text-gray-700 max-w-md mx-auto mb-6">
                This staff member hasn't made any sales yet, or sales are not properly linked.
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <div>• Check if sales have <code>createdById</code> set to staff ID</div>
                <div>• Verify staff email matches sales <code>createdBy</code> field</div>
                <div>• Ensure sales API is linking staff correctly</div>
              </div>
            </div>
          )}
        </div>

        {/* Inventory Section - Mobile Optimized */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg sm:text-xl font-semibold text-gray-900">Inventory Assigned</div>
                <div className="text-gray-700 text-sm">All items assigned to this staff</div>
              </div>
              <div className="text-gray-700 text-sm">
                {staff.staffInventories?.length || 0} items
              </div>
            </div>
          </div>

          {staff.staffInventories && staff.staffInventories.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider hidden sm:table-cell">
                      Status
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {staff.staffInventories.map((inventory) => {
                    const remaining = calculateRemainingInventory(inventory);
                    const status = getInventoryStatus(inventory);
                    
                    return (
                      <tr key={inventory.id} className="hover:bg-gray-50">
                        <td className="px-4 sm:px-6 py-4">
                          <div className="font-medium text-gray-900">{inventory.product?.name || 'Unknown'}</div>
                          {inventory.product?.category && (
                            <div className="text-xs text-gray-700">{inventory.product.category}</div>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          <div className="text-gray-900 font-medium">{inventory.quantityGiven}</div>
                          <div className="text-xs text-gray-700">
                            <span className="text-green-600">Sold: {inventory.quantitySold}</span>
                            <span className="mx-1">•</span>
                            <span className="text-orange-600">Returned: {inventory.quantityReturned}</span>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 hidden sm:table-cell">
                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                            {status.text}
                          </div>
                          <div className="text-xs text-gray-700 mt-1">
                            Remaining: {remaining}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          <button
                            onClick={() => handleDeleteInventory(inventory.id)}
                            disabled={deletingInventory === inventory.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 text-xs"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 sm:px-6 py-12 text-center">
              <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
              <div className="text-lg sm:text-xl font-medium text-gray-900 mb-2">No Inventory Assigned</div>
              <div className="text-gray-700 max-w-md mx-auto mb-6">
                This staff member hasn't been assigned any inventory yet.
              </div>
              <button
                onClick={() => router.push(`/admin/staff/inventory?staffId=${staff.id}`)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Package className="w-4 h-4" />
                Assign Inventory
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-700 text-sm">
          <div>Staff Details • {staff.name} • Last updated {formatDate(staff.updatedAt)}</div>
          <div className="mt-2 flex items-center justify-center gap-4">
            <button
              onClick={() => exportReport('csv')}
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <div className="text-gray-400">•</div>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 text-gray-700 hover:text-gray-900 text-sm"
            >
              <Printer className="w-4 h-4" />
              Print Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDetailsPage;