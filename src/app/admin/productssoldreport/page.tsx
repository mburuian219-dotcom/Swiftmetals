// src/app/admin/productssoldreport/page.tsx
"use client";
import React, { useEffect, useState, useCallback } from "react";
import { 
  Download, Filter, X, User, Package, 
  TrendingUp, TrendingDown, Users, Clock, ChevronDown, ChevronUp, AlertCircle,
  Moon, Sun, RefreshCw, Search, Home, ShoppingCart, Receipt, BarChart3,
  Settings, LogOut, Menu, LayoutDashboard
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ==================== INTERFACES ====================

interface Product {
  id: number;
  name: string;
  price: number;
  category?: string;
}

interface Staff {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
}

interface StaffInventory {
  staff?: Staff;
  staffId?: number;
}

interface SaleItemDetail {
  id: number;
  quantity: number;
  price: number;
  total: number;
  product: Product;
  staffInventory?: StaffInventory;
}

interface SaleWithItems {
  id: number;
  date: string;
  amount: number;
  status: string;
  customer: Customer | null;
  assignedStaff?: Staff | null;
  createdBy?: string;
  createdById?: number | null;
  saleitems: SaleItemDetail[];
}

interface ProductSoldReport {
  productId: number;
  productName: string;
  productCategory: string;
  totalQuantitySold: number;
  totalRevenue: number;
  averagePrice: number;
  saleCount: number;
  uniqueCustomers: number;
  staffNames: string[];
  staffIds: number[];
  lastSoldDate: string;
}

interface StaffPerformance {
  staffId: number;
  staffName: string;
  totalProductsSold: number;
  totalRevenue: number;
  saleCount: number;
  uniqueProducts: number;
  topProduct: string;
}

interface ProductSaleDetail {
  saleId: number;
  saleDate: string;
  customerName: string;
  customerId: number;
  quantity: number;
  price: number;
  total: number;
  staffName: string;
  staffId: number;
  status: string;
}

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
    { id: 'products-sold', label: 'Products Sold', icon: Package, path: '/admin/productssoldreport' },
    { id: 'restock', label: 'Restock', icon: ShoppingCart, path: '/admin/restock' },
    { id: 'reconcilliation', label: 'Sales', icon: Receipt, path: '/admin/reconciliation' },
    { id: 'assigned', label: 'Assigned History', icon: BarChart3, path: '/admin/assignhistory' }
  ];

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-50">
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

export default function ProductsSoldReportPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const router = useRouter();
  
  // Data states
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  
  // Filter states
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "quarter" | "year" | "custom">("week");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchProduct, setSearchProduct] = useState("");
  const [sortBy, setSortBy] = useState<"quantity" | "revenue" | "salesCount" | "productName">("revenue");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  
  // UI states
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProductDetails, setSelectedProductDetails] = useState<ProductSaleDetail[]>([]);
  const [showProductDetailModal, setShowProductDetailModal] = useState(false);
  const [selectedProductName, setSelectedProductName] = useState("");
  
  // Available categories
  const [categories, setCategories] = useState<string[]>([]);
  
  // Report data
  const [reportData, setReportData] = useState<ProductSoldReport[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([]);
  const [summary, setSummary] = useState({
    totalProductsSold: 0,
    totalRevenue: 0,
    uniqueProducts: 0,
    totalTransactions: 0,
    averageOrderValue: 0,
    topProduct: "",
    topProductRevenue: 0,
    topPerformingStaff: "",
    topStaffRevenue: 0
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

  // ==================== HELPER FUNCTIONS ====================
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

  const formatCompactNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // Helper to check if a sale is associated with a staff member
  const isSaleAssociatedWithStaff = (sale: SaleWithItems, staffId: number): boolean => {
    if (sale.assignedStaff?.id === staffId) return true;
    if (sale.createdById === staffId) return true;
    for (const item of sale.saleitems) {
      if (item.staffInventory?.staff?.id === staffId) return true;
      if (item.staffInventory?.staffId === staffId) return true;
    }
    return false;
  };

  // Get all staff associated with a sale
  const getSaleStaffNames = (sale: SaleWithItems, staffMap: Map<number, Staff>): string[] => {
    const staffIds = new Set<number>();
    const names: string[] = [];
    
    if (sale.assignedStaff?.id) {
      staffIds.add(sale.assignedStaff.id);
      names.push(sale.assignedStaff.name);
    }
    if (sale.createdById && !staffIds.has(sale.createdById)) {
      const staff = staffMap.get(sale.createdById);
      if (staff) {
        staffIds.add(sale.createdById);
        names.push(staff.name);
      }
    }
    for (const item of sale.saleitems) {
      const invStaffId = item.staffInventory?.staff?.id || item.staffInventory?.staffId;
      const invStaffName = item.staffInventory?.staff?.name;
      if (invStaffId && !staffIds.has(invStaffId)) {
        staffIds.add(invStaffId);
        if (invStaffName) {
          names.push(invStaffName);
        } else {
          const staff = staffMap.get(invStaffId);
          if (staff) names.push(staff.name);
        }
      }
    }
    return names;
  };

  // Get all staff IDs associated with a sale
  const getSaleStaffIds = (sale: SaleWithItems): number[] => {
    const staffIds = new Set<number>();
    
    if (sale.assignedStaff?.id) staffIds.add(sale.assignedStaff.id);
    if (sale.createdById) staffIds.add(sale.createdById);
    for (const item of sale.saleitems) {
      const invStaffId = item.staffInventory?.staff?.id || item.staffInventory?.staffId;
      if (invStaffId) staffIds.add(invStaffId);
    }
    return Array.from(staffIds);
  };

  // Get date range based on selection
  const getDateRange = useCallback(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    
    switch (dateRange) {
      case "today":
        start = new Date();
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
        break;
      case "week":
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        break;
      case "month":
        start = new Date(now);
        start.setMonth(now.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        break;
      case "quarter":
        start = new Date(now);
        start.setMonth(now.getMonth() - 3);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        break;
      case "year":
        start = new Date(now);
        start.setFullYear(now.getFullYear() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        break;
      case "custom":
        if (customStartDate && customEndDate) {
          start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
        } else {
          start = new Date(now);
          start.setDate(now.getDate() - 7);
          start.setHours(0, 0, 0, 0);
          end = new Date(now);
          end.setHours(23, 59, 59, 999);
        }
        break;
    }
    
    return { start, end };
  }, [dateRange, customStartDate, customEndDate]);

  // Get detailed sales for a specific product
  const getProductSaleDetails = (productId: number): ProductSaleDetail[] => {
    const { start, end } = getDateRange();
    const staffMap = new Map<number, Staff>();
    for (const staff of staffList) {
      staffMap.set(staff.id, staff);
    }
    
    const details: ProductSaleDetail[] = [];
    
    const filteredSales = sales.filter(sale => {
      const saleDate = new Date(sale.date);
      return saleDate >= start && saleDate <= end;
    });
    
    for (const sale of filteredSales) {
      for (const item of sale.saleitems) {
        if (item.product?.id === productId) {
          const staffNames = getSaleStaffNames(sale, staffMap);
          details.push({
            saleId: sale.id,
            saleDate: sale.date,
            customerName: sale.customer?.name || 'Unknown Customer',
            customerId: sale.customer?.id || 0,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
            staffName: staffNames.length > 0 ? staffNames.join(', ') : 'Unassigned',
            staffId: staffNames.length > 0 ? sale.assignedStaff?.id || 0 : 0,
            status: sale.status
          });
        }
      }
    }
    
    return details.sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());
  };

  // Process sales data into product report
  const processReportData = useCallback(() => {
    const { start, end } = getDateRange();
    
    // Create a map of staff by ID for quick lookup
    const staffMap = new Map<number, Staff>();
    for (const staff of staffList) {
      staffMap.set(staff.id, staff);
    }
    
    // Filter sales by date range
    const filteredSales = sales.filter(sale => {
      const saleDate = new Date(sale.date);
      return saleDate >= start && saleDate <= end;
    });
    
    // Further filter by staff
    let finalSales = filteredSales;
    if (selectedStaffId) {
      const staffIdNum = Number(selectedStaffId);
      finalSales = filteredSales.filter(sale => isSaleAssociatedWithStaff(sale, staffIdNum));
    }
    
    // Filter by customer
    if (selectedCustomerId) {
      finalSales = finalSales.filter(sale => sale.customer?.id === Number(selectedCustomerId));
    }
    
    setDebugInfo(`Total sales in date range: ${filteredSales.length}, After staff filter: ${finalSales.length}`);
    
    // Process products sold
    const productMap = new Map<number, ProductSoldReport>();
    
    for (const sale of finalSales) {
      const staffNamesForSale = getSaleStaffNames(sale, staffMap);
      const staffIdsForSale = getSaleStaffIds(sale);
      
      for (const item of sale.saleitems) {
        const product = item.product;
        if (!product) continue;
        
        const existing = productMap.get(product.id);
        
        if (existing) {
          existing.totalQuantitySold += item.quantity;
          existing.totalRevenue += item.total;
          existing.saleCount++;
          for (const staffName of staffNamesForSale) {
            if (!existing.staffNames.includes(staffName)) {
              existing.staffNames.push(staffName);
            }
          }
          for (const staffId of staffIdsForSale) {
            if (!existing.staffIds.includes(staffId)) {
              existing.staffIds.push(staffId);
            }
          }
          const saleDate = new Date(sale.date);
          if (saleDate > new Date(existing.lastSoldDate)) {
            existing.lastSoldDate = sale.date;
          }
        } else {
          productMap.set(product.id, {
            productId: product.id,
            productName: product.name,
            productCategory: product.category || "Uncategorized",
            totalQuantitySold: item.quantity,
            totalRevenue: item.total,
            averagePrice: item.price,
            saleCount: 1,
            uniqueCustomers: 0,
            staffNames: [...staffNamesForSale],
            staffIds: [...staffIdsForSale],
            lastSoldDate: sale.date
          });
        }
      }
    }
    
    // Calculate unique customers for each product
    for (const [productId, report] of productMap) {
      const uniqueCustomersSet = new Set<number>();
      for (const sale of finalSales) {
        for (const item of sale.saleitems) {
          if (item.product?.id === productId && sale.customer?.id) {
            uniqueCustomersSet.add(sale.customer.id);
          }
        }
      }
      report.uniqueCustomers = uniqueCustomersSet.size;
      if (report.totalQuantitySold > 0) {
        report.averagePrice = report.totalRevenue / report.totalQuantitySold;
      }
    }
    
    // Convert to array and apply filters
    let reportArray = Array.from(productMap.values());
    
    if (selectedCategory) {
      reportArray = reportArray.filter(p => p.productCategory === selectedCategory);
    }
    
    if (searchProduct) {
      const searchLower = searchProduct.toLowerCase();
      reportArray = reportArray.filter(p => 
        p.productName.toLowerCase().includes(searchLower) ||
        p.productCategory.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort
    reportArray.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "quantity":
          comparison = a.totalQuantitySold - b.totalQuantitySold;
          break;
        case "revenue":
          comparison = a.totalRevenue - b.totalRevenue;
          break;
        case "salesCount":
          comparison = a.saleCount - b.saleCount;
          break;
        case "productName":
          comparison = a.productName.localeCompare(b.productName);
          break;
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });
    
    setReportData(reportArray);
    
    // Calculate summary
    const totalProductsSold = reportArray.reduce((sum, p) => sum + p.totalQuantitySold, 0);
    const totalRevenue = reportArray.reduce((sum, p) => sum + p.totalRevenue, 0);
    const uniqueProducts = reportArray.length;
    const totalTransactions = finalSales.length;
    
    let topProduct = "";
    let topProductRevenue = 0;
    for (const p of reportArray) {
      if (p.totalRevenue > topProductRevenue) {
        topProductRevenue = p.totalRevenue;
        topProduct = p.productName;
      }
    }
    
    setSummary({
      totalProductsSold,
      totalRevenue,
      uniqueProducts,
      totalTransactions,
      averageOrderValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
      topProduct,
      topProductRevenue,
      topPerformingStaff: "",
      topStaffRevenue: 0
    });
    
    // Calculate staff performance
    const staffPerfMap = new Map<number, StaffPerformance>();
    
    for (const sale of finalSales) {
      const associatedStaffIds = getSaleStaffIds(sale);
      
      for (const staffId of associatedStaffIds) {
        const staff = staffMap.get(staffId);
        if (!staff) continue;
        
        if (!staffPerfMap.has(staffId)) {
          staffPerfMap.set(staffId, {
            staffId: staffId,
            staffName: staff.name,
            totalProductsSold: 0,
            totalRevenue: 0,
            saleCount: 0,
            uniqueProducts: 0,
            topProduct: ""
          });
        }
        
        const perf = staffPerfMap.get(staffId)!;
        perf.saleCount++;
        perf.totalRevenue += sale.amount;
        
        const productSet = new Set<number>();
        for (const item of sale.saleitems) {
          perf.totalProductsSold += item.quantity;
          if (item.product) productSet.add(item.product.id);
        }
        perf.uniqueProducts = Math.max(perf.uniqueProducts, productSet.size);
      }
    }
    
    for (const [staffId, perf] of staffPerfMap) {
      let maxRevenue = 0;
      let topProductName = "";
      for (const product of reportArray) {
        if (product.staffIds.includes(staffId)) {
          if (product.totalRevenue > maxRevenue) {
            maxRevenue = product.totalRevenue;
            topProductName = product.productName;
          }
        }
      }
      perf.topProduct = topProductName || "None";
    }
    
    const staffArray = Array.from(staffPerfMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
    setStaffPerformance(staffArray);
    
    if (staffArray.length > 0) {
      setSummary(prev => ({
        ...prev,
        topPerformingStaff: staffArray[0].staffName,
        topStaffRevenue: staffArray[0].totalRevenue
      }));
    }
  }, [sales, getDateRange, selectedStaffId, selectedCustomerId, selectedCategory, searchProduct, sortBy, sortOrder, staffList]);

  // ==================== DATA FETCHING ====================
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Please log in to view reports");
        setLoading(false);
        return;
      }
      
      const salesRes = await fetch("/api/sales?includeDeleted=false&limit=1000");
      if (!salesRes.ok) throw new Error("Failed to fetch sales");
      const salesData = await salesRes.json();
      
      const staffRes = await fetch("/api/staff");
      let staffData: Staff[] = [];
      if (staffRes.ok) {
        const data = await staffRes.json();
        staffData = Array.isArray(data) ? data : (data.staff || []);
        setStaffList(staffData);
      }
      
      const customersRes = await fetch("/api/customers");
      let customersData: Customer[] = [];
      if (customersRes.ok) {
        const data = await customersRes.json();
        customersData = Array.isArray(data) ? data : (data.customers || []);
        setCustomers(customersData);
      }
      
      const staffMap = new Map<number, Staff>();
      for (const staff of staffData) {
        staffMap.set(staff.id, staff);
      }
      
      const processedSales: SaleWithItems[] = (Array.isArray(salesData) ? salesData : (salesData.sales || salesData.data || []))
        .filter((s: any) => !s.isDeleted)
        .map((sale: any) => ({
          id: sale.id,
          date: sale.date,
          amount: sale.amount,
          status: sale.status,
          customer: sale.customer || null,
          assignedStaff: sale.assignedStaff || (sale.assignedStaffId ? staffMap.get(sale.assignedStaffId) : null),
          createdBy: sale.createdBy,
          createdById: sale.createdById,
          saleitems: (sale.saleitems || []).map((item: any) => ({
            id: item.id,
            quantity: item.quantity || 0,
            price: item.price || 0,
            total: (item.quantity || 0) * (item.price || 0),
            product: item.product || { id: item.productId, name: `Product ID: ${item.productId}`, price: 0, category: "Unknown" },
            staffInventory: item.staffInventory || null
          }))
        }));
      
      setSales(processedSales);
      
      const uniqueCategories = new Set<string>();
      for (const sale of processedSales) {
        for (const item of sale.saleitems) {
          if (item.product?.category) {
            uniqueCategories.add(item.product.category);
          }
        }
      }
      setCategories(Array.from(uniqueCategories).sort());
      
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchData();
      } else {
        setError("Please log in to view reports");
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, []);
  
  useEffect(() => {
    if (sales.length > 0 && staffList.length > 0) {
      processReportData();
    }
  }, [sales, processReportData, staffList]);
  
  // Handle product click to show details
  const handleProductClick = (productId: number, productName: string) => {
    const details = getProductSaleDetails(productId);
    setSelectedProductDetails(details);
    setSelectedProductName(productName);
    setShowProductDetailModal(true);
  };
  
  // ==================== EXPORT TO CSV ====================
  const exportToCSV = () => {
    if (reportData.length === 0) return;
    
    const csvData = reportData.map(product => ({
      'Product Name': product.productName,
      'Category': product.productCategory,
      'Quantity Sold': product.totalQuantitySold,
      'Total Revenue (KSh)': product.totalRevenue.toFixed(2),
      'Average Price (KSh)': product.averagePrice.toFixed(2),
      'Number of Sales': product.saleCount,
      'Unique Customers': product.uniqueCustomers,
      'Staff Who Sold': product.staffNames.join(', '),
      'Last Sold Date': formatDate(product.lastSoldDate)
    }));
    
    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => `"${String(row[h as keyof typeof row]).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const { start, end } = getDateRange();
    link.setAttribute('href', url);
    link.setAttribute('download', `products_sold_report_${formatDate(start.toISOString())}_to_${formatDate(end.toISOString())}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };
  
  // ==================== CLEAR FILTERS ====================
  const clearFilters = () => {
    setSelectedStaffId("");
    setSelectedCustomerId("");
    setSelectedCategory("");
    setSearchProduct("");
    setDateRange("week");
    setCustomStartDate("");
    setCustomEndDate("");
    setSortBy("revenue");
    setSortOrder("desc");
  };
  
  // ==================== RENDER ====================
  const isFilterActive = selectedStaffId || selectedCustomerId || selectedCategory || searchProduct;
  
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={`min-h-screen transition-colors duration-200 ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        
        {/* Navigation Bar - Fixed position with high z-index */}
        <NavigationBar activePage="products-sold" />
        
        {/* Theme Toggle - Moved to a better position with higher z-index */}
        <button
          onClick={toggleTheme}
          className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all"
        >
          {theme === 'light' ? <Moon size={20} className="text-gray-700" /> : <Sun size={20} className="text-yellow-500" />}
        </button>
        
        <div className="p-3 sm:p-6 max-w-7xl mx-auto pt-4">
          
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                  <Package size={24} />
                  Products Sold Report
                </h1>
                <p className="text-xs text-gray-500 mt-1">Track product sales performance and staff productivity</p>
                {debugInfo && (
                  <p className="text-xs text-gray-400 mt-1">{debugInfo}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={exportToCSV}
                  disabled={reportData.length === 0}
                  className="bg-green-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <Download size={16} />
                  Export CSV
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
          
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl mb-4 flex justify-between items-center">
              <div className="flex items-center gap-2"><AlertCircle size={18} />{error}</div>
              <button onClick={() => setError(null)} className="text-red-700">×</button>
            </div>
          )}
          
          {/* Summary Cards */}
          {!loading && reportData.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-blue-500">
                <div className="text-xs text-gray-500">Total Products Sold</div>
                <div className="text-xl font-bold text-blue-600">{formatCompactNumber(summary.totalProductsSold)}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-green-500">
                <div className="text-xs text-gray-500">Total Revenue</div>
                <div className="text-xl font-bold text-green-600">KSh {formatCurrency(summary.totalRevenue)}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-purple-500">
                <div className="text-xs text-gray-500">Unique Products</div>
                <div className="text-xl font-bold text-purple-600">{summary.uniqueProducts}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-orange-500">
                <div className="text-xs text-gray-500">Transactions</div>
                <div className="text-xl font-bold text-orange-600">{summary.totalTransactions}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-indigo-500">
                <div className="text-xs text-gray-500">Avg Order Value</div>
                <div className="text-xl font-bold text-indigo-600">KSh {formatCurrency(summary.averageOrderValue)}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-yellow-500">
                <div className="text-xs text-gray-500">Top Staff</div>
                <div className="text-sm font-bold text-yellow-600 truncate">{summary.topPerformingStaff || "-"}</div>
                <div className="text-[10px] text-gray-500">KSh {formatCurrency(summary.topStaffRevenue)}</div>
              </div>
            </div>
          )}
          
          {/* Filters Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
            <div className="p-3 border-b dark:border-gray-700 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-500" />
                <span className="font-medium text-sm">Filters & Options</span>
                {isFilterActive && (
                  <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full">Active</span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowFilters(!showFilters)} className="text-gray-500 text-sm sm:hidden">
                  {showFilters ? "Hide" : "Show"}
                </button>
                {isFilterActive && (
                  <button onClick={clearFilters} className="text-red-600 text-xs flex items-center gap-1">
                    <X size={12} /> Clear
                  </button>
                )}
              </div>
            </div>
            
            <div className={`p-3 space-y-3 ${showFilters ? 'block' : 'hidden sm:block'}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Date Range */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date Range</label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value as any)}
                    className="w-full p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="today">Today</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                    <option value="quarter">Last 3 Months</option>
                    <option value="year">Last Year</option>
                    <option value="custom">Custom Range</option>
                  </select>
                  {dateRange === "custom" && (
                    <div className="flex gap-1 mt-1">
                      <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="flex-1 p-1 text-xs border rounded" placeholder="Start" />
                      <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="flex-1 p-1 text-xs border rounded" placeholder="End" />
                    </div>
                  )}
                </div>
                
                {/* Staff Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Sales Person</label>
                  <select
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="w-full p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="">All Staff</option>
                    {staffList.map(staff => (
                      <option key={staff.id} value={staff.id}>{staff.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">Filters sales where staff is assigned, created, or involved</p>
                </div>
                
                {/* Customer Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Customer</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="">All Customers</option>
                    {customers.slice(0, 50).map(customer => (
                      <option key={customer.id} value={customer.id}>{customer.name}</option>
                    ))}
                  </select>
                </div>
                
                {/* Category Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Product Search */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Search Product</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Product name or category..."
                      value={searchProduct}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      className="w-full pl-8 p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                </div>
                
                {/* Sort Options */}
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Sort by:</span>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="p-1 text-xs border rounded bg-white dark:bg-gray-700">
                      <option value="revenue">Revenue</option>
                      <option value="quantity">Quantity</option>
                      <option value="salesCount">Sales Count</option>
                      <option value="productName">Product Name</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Order:</span>
                    <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)} className="p-1 text-xs border rounded bg-white dark:bg-gray-700">
                      <option value="desc">Highest First</option>
                      <option value="asc">Lowest First</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Loading State */}
          {loading && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
              <p className="text-gray-500">Loading sales data...</p>
            </div>
          )}
          
          {/* No Data State */}
          {!loading && reportData.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center">
              <Package size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No products sold in the selected period</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or date range</p>
            </div>
          )}
          
          {/* Products Sold Table */}
          {!loading && reportData.length > 0 && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                      <tr>
                        <th className="text-left p-3 font-semibold">Product</th>
                        <th className="text-center p-3 font-semibold">Category</th>
                        <th className="text-center p-3 font-semibold">Qty Sold</th>
                        <th className="text-right p-3 font-semibold">Revenue</th>
                        <th className="text-center p-3 font-semibold">Avg Price</th>
                        <th className="text-center p-3 font-semibold">Sales</th>
                        <th className="text-center p-3 font-semibold">Customers</th>
                        <th className="text-center p-3 font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {reportData.map((product) => (
                        <React.Fragment key={product.productId}>
                          <tr 
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" 
                            onClick={() => handleProductClick(product.productId, product.productName)}
                          >
                            <td className="p-3 font-medium text-blue-600 dark:text-blue-400 hover:underline">
                              {product.productName}
                            </td>
                            <td className="p-3 text-center">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                {product.productCategory}
                              </span>
                            </td>
                            <td className="p-3 text-center font-semibold text-blue-600">{product.totalQuantitySold}</td>
                            <td className="p-3 text-right font-semibold text-green-600">KSh {formatCurrency(product.totalRevenue)}</td>
                            <td className="p-3 text-center text-gray-600">KSh {formatCurrency(product.averagePrice)}</td>
                            <td className="p-3 text-center">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                {product.saleCount} sales
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                {product.uniqueCustomers} customers
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className="text-xs text-blue-600 hover:underline">View Details</span>
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Staff Performance Section */}
              {staffPerformance.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="p-3 border-b dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20">
                    <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                      <Users size={16} />
                      Staff Performance Summary
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Breakdown by sales person (includes assigned, created, and involved)</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                        <tr>
                          <th className="text-left p-3 font-semibold">Staff Member</th>
                          <th className="text-center p-3 font-semibold">Products Sold</th>
                          <th className="text-right p-3 font-semibold">Revenue Generated</th>
                          <th className="text-center p-3 font-semibold">Transactions</th>
                          <th className="text-center p-3 font-semibold">Unique Products</th>
                          <th className="text-left p-3 font-semibold">Top Product</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-gray-700">
                        {staffPerformance.map((staff) => (
                          <tr key={staff.staffId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="p-3 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                              <User size={14} className="text-indigo-500" />
                              {staff.staffName}
                            </td>
                            <td className="p-3 text-center font-semibold text-blue-600">{staff.totalProductsSold}</td>
                            <td className="p-3 text-right font-semibold text-green-600">KSh {formatCurrency(staff.totalRevenue)}</td>
                            <td className="p-3 text-center">{staff.saleCount}</td>
                            <td className="p-3 text-center">{staff.uniqueProducts}</td>
                            <td className="p-3 text-left text-sm text-gray-600">{staff.topProduct}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Footer Stats */}
          {!loading && reportData.length > 0 && (
            <div className="mt-4 text-center text-xs text-gray-400">
              Showing {reportData.length} products | Total items sold: {summary.totalProductsSold} | Total revenue: KSh {formatCurrency(summary.totalRevenue)}
            </div>
          )}
          
        </div>
      </div>

      {/* Product Detail Modal */}
      {showProductDetailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-t-xl flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">{selectedProductName}</h2>
                <p className="text-blue-100 text-sm">Product Sale Details</p>
              </div>
              <button 
                onClick={() => setShowProductDetailModal(false)}
                className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6">
              {/* Summary stats for this product */}
              {selectedProductDetails.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">Total Sold</div>
                    <div className="text-xl font-bold text-blue-600">
                      {selectedProductDetails.reduce((sum, d) => sum + d.quantity, 0)}
                    </div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">Total Revenue</div>
                    <div className="text-xl font-bold text-green-600">
                      KSh {formatCurrency(selectedProductDetails.reduce((sum, d) => sum + d.total, 0))}
                    </div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">Unique Customers</div>
                    <div className="text-xl font-bold text-purple-600">
                      {new Set(selectedProductDetails.map(d => d.customerId)).size}
                    </div>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">Transactions</div>
                    <div className="text-xl font-bold text-yellow-600">
                      {selectedProductDetails.length}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Detailed sales table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                    <tr>
                      <th className="text-left p-2 font-semibold">Sale ID</th>
                      <th className="text-left p-2 font-semibold">Date</th>
                      <th className="text-left p-2 font-semibold">Customer</th>
                      <th className="text-center p-2 font-semibold">Qty</th>
                      <th className="text-right p-2 font-semibold">Price</th>
                      <th className="text-right p-2 font-semibold">Total</th>
                      <th className="text-left p-2 font-semibold">Sold By</th>
                      <th className="text-center p-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {selectedProductDetails.map((detail, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="p-2 font-medium text-blue-600">#{detail.saleId}</td>
                        <td className="p-2 text-gray-600">{formatDate(detail.saleDate)}</td>
                        <td className="p-2 font-medium">{detail.customerName}</td>
                        <td className="p-2 text-center font-semibold">{detail.quantity}</td>
                        <td className="p-2 text-right">KSh {formatCurrency(detail.price)}</td>
                        <td className="p-2 text-right font-semibold text-green-600">KSh {formatCurrency(detail.total)}</td>
                        <td className="p-2 text-sm text-gray-600">{detail.staffName}</td>
                        <td className="p-2 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            detail.status === 'PAID' ? 'bg-green-100 text-green-700' :
                            detail.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {detail.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {selectedProductDetails.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No sales found for this product in the selected period
                </div>
              )}
              
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowProductDetailModal(false)}
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