// app/admin/reconciliation/page.tsx
"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Users, Package, TrendingUp, TrendingDown, AlertCircle, CheckCircle,
  Search, Filter, Download, RefreshCw, Eye, ChevronDown, ChevronUp,
  Moon, Sun, LogOut, LayoutDashboard, ShoppingCart, Receipt,
  BarChart3, User, Calendar, DollarSign, FileText, Printer,
  AlertTriangle, X, Plus, Clock, Minus, Equal, ArrowRight,
  Menu, Home, CreditCard, CalendarDays, Flag, CheckSquare, Square,
  RotateCcw, FileSpreadsheet, ChevronLeft, ChevronRight, Edit2, Trash2, Save, UserPlus
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

// ==================== INTERFACES ====================

interface Staff {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  productionCost?: number;
  category?: string;
}

interface StaffInventory {
  id: number;
  staffId: number;
  productId: number;
  quantityGiven: number;
  quantitySold: number;
  quantityReturned: number;
  weekStartDate?: string;
  weekEndDate?: string;
  staff: Staff;
  product: Product;
  saleItems?: SaleItemDetail[];
  createdAt: string;
  updatedAt: string;
}

interface SaleItemDetail {
  id: number;
  quantity: number;
  price: number;
  total: number;
  productId: number;
  saleId: number;
  saleDate: string;
  customerName: string;
  customerId: number;
  saleStatus: string;
  staffName: string;
  staffInventoryId?: number | null;
}

interface ReconciliationItem {
  productId: number;
  productName: string;
  productCategory: string;
  totalAssigned: number;
  totalSold: number;
  totalReturned: number;
  discrepancy: number;
  staffInventoryId: number;
  assignedToStaff: string;
  assignedDate: string;
  lastSoldDate: string;
  status: 'matched' | 'discrepancy' | 'carried_forward';
  saleItems: SaleItemDetail[];
  staffName: string;
  weekStartDate?: string;
  weekEndDate?: string;
  staffId: number;
}

interface WeekSummary {
  weekStart: string;
  weekEnd: string;
  totalStaff: number;
  totalProducts: number;
  totalAssigned: number;
  totalSold: number;
  totalReturned: number;
  totalRevenue: number;
  discrepanciesCount: number;
}

// ==================== THEME CONTEXT ====================
const ThemeContext = React.createContext({ theme: 'light', toggleTheme: () => {} });

function useTheme() {
  return React.useContext(ThemeContext);
}

// ==================== NAVIGATION COMPONENT ====================
function NavigationBar({ activePage }: { activePage: string }) {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
    { id: 'products-sold', label: 'Products Sold', icon: Package, path: '/admin/productssoldreport' },
    { id: 'restock', label: 'Restock', icon: ShoppingCart, path: '/admin/restock' },
    { id: 'reconciliation', label: 'Reconciliation', icon: BarChart3, path: '/admin/reconciliation' },
    { id: 'creditors', label: 'Creditors', icon: CreditCard, path: '/admin/creditors' },
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
export default function ReconciliationPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const router = useRouter();
  
  // Data states
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [staffInventories, setStaffInventories] = useState<StaffInventory[]>([]);
  const [allSaleItems, setAllSaleItems] = useState<SaleItemDetail[]>([]);
  const [reconciliationData, setReconciliationData] = useState<ReconciliationItem[]>([]);
  const [weekSummary, setWeekSummary] = useState<WeekSummary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ReconciliationItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCloseWeekModal, setShowCloseWeekModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ReconciliationItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    quantityGiven: 0,
    quantitySold: 0,
    quantityReturned: 0
  });
  const [closeWeekNotes, setCloseWeekNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "matched" | "discrepancy">("all");
  const [sortBy, setSortBy] = useState<"productName" | "discrepancy">("discrepancy");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'staff'>('all');
  const [availableWeeks, setAvailableWeeks] = useState<{start: string, end: string}[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [assignData, setAssignData] = useState({
    staffId: 0,
    productId: 0,
    quantity: 0,
    notes: ''
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

  const formatDateTime = (dateString: string): string => {
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

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getWeekRange = (date: Date = new Date()): { start: Date; end: Date } => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  };

  // ==================== DATA FETCHING ====================
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Please log in to view reconciliation");
        setLoading(false);
        return;
      }

      const token = await user.getIdToken();

      // Fetch staff
      const staffRes = await fetch("/api/staff", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (staffRes.ok) {
        const data = await staffRes.json();
        setStaffList(Array.isArray(data) ? data : (data.staff || []));
      }

      // Fetch products
      const productsRes = await fetch("/api/products", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(Array.isArray(data) ? data : (data.products || []));
      }

      // Fetch staff inventory with full details
      const inventoryRes = await fetch("/api/staff-inventory", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (inventoryRes.ok) {
        const data = await inventoryRes.json();
        const inventories = Array.isArray(data) ? data : (data.inventory || []);
        setStaffInventories(inventories);
        
        // Update available weeks
        const weeks = new Set<string>();
        inventories.forEach((inv: any) => {
          if (inv.weekStartDate) {
            weeks.add(inv.weekStartDate);
          }
        });
        setAvailableWeeks(Array.from(weeks).sort().map(start => ({
          start,
          end: new Date(new Date(start).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString()
        })));
      }

      // Fetch sale items with full details
      const saleItemsRes = await fetch("/api/sale-items", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (saleItemsRes.ok) {
        const data = await saleItemsRes.json();
        const items = Array.isArray(data) ? data : (data.saleItems || []);
        setAllSaleItems(items);
      }

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
        setError("Please log in to view reconciliation");
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, []);

  // ==================== PROCESS RECONCILIATION ====================
  const processReconciliation = useCallback(() => {
    if (!selectedStaffId && viewMode === 'staff') {
      setReconciliationData([]);
      setWeekSummary(null);
      return;
    }

    try {
      // Filter inventory based on view mode and selected week
      let filteredInventory = [...staffInventories];
      
      if (viewMode === 'staff' && selectedStaffId) {
        filteredInventory = filteredInventory.filter(inv => inv.staffId === selectedStaffId);
      }
      
      if (selectedWeek) {
        filteredInventory = filteredInventory.filter(inv => inv.weekStartDate === selectedWeek);
      }

      if (filteredInventory.length === 0) {
        setReconciliationData([]);
        setWeekSummary(null);
        return;
      }

      const reconciliationItems: ReconciliationItem[] = [];

      for (const inventory of filteredInventory) {
        const productId = inventory.productId;
        const product = inventory.product || products.find(p => p.id === productId);
        
        // Find sale items for this product linked to this staff inventory
        const productSaleItems = allSaleItems.filter(item => 
          item.productId === productId && 
          item.staffInventoryId === inventory.id
        );
        
        // Also include sale items from this staff that might not have staffInventoryId set
        const staffSaleItems = allSaleItems.filter(item => 
          item.productId === productId && 
          item.staffName === inventory.staff?.name &&
          (!item.staffInventoryId || item.staffInventoryId === inventory.id)
        );

        // Combine and deduplicate
        const saleItemsMap = new Map<number, SaleItemDetail>();
        [...productSaleItems, ...staffSaleItems].forEach(item => {
          saleItemsMap.set(item.id, item);
        });
        
        const saleItems = Array.from(saleItemsMap.values());
        
        let totalSold = 0;
        saleItems.forEach(item => {
          totalSold += item.quantity;
        });

        // Calculate discrepancy
        const discrepancy = inventory.quantityGiven - totalSold;

        // Determine status
        let status: 'matched' | 'discrepancy' | 'carried_forward' = 'matched';
        if (discrepancy !== 0) {
          status = 'discrepancy';
        }

        // Find last sold date
        let lastSoldDate = inventory.createdAt;
        if (saleItems.length > 0) {
          const sorted = [...saleItems].sort((a, b) => 
            new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
          );
          lastSoldDate = sorted[0].saleDate;
        }

        reconciliationItems.push({
          productId,
          productName: product?.name || inventory.product?.name || `Product ID: ${productId}`,
          productCategory: product?.category || inventory.product?.category || 'Uncategorized',
          totalAssigned: inventory.quantityGiven,
          totalSold,
          totalReturned: inventory.quantityReturned || 0,
          discrepancy,
          staffInventoryId: inventory.id,
          assignedToStaff: inventory.staff?.name || 'Unknown',
          assignedDate: inventory.createdAt,
          lastSoldDate,
          status,
          saleItems,
          staffName: inventory.staff?.name || 'Unknown',
          weekStartDate: inventory.weekStartDate,
          weekEndDate: inventory.weekEndDate,
          staffId: inventory.staffId
        });
      }

      // Sort by discrepancy (highest first)
      reconciliationItems.sort((a, b) => Math.abs(b.discrepancy) - Math.abs(a.discrepancy));
      
      setReconciliationData(reconciliationItems);

      // Calculate summary
      const totalStaff = new Set(reconciliationItems.map(item => item.staffName)).size;
      const summaryData: WeekSummary = {
        weekStart: reconciliationItems[0]?.weekStartDate || '',
        weekEnd: reconciliationItems[0]?.weekEndDate || '',
        totalStaff,
        totalProducts: reconciliationItems.length,
        totalAssigned: reconciliationItems.reduce((sum, item) => sum + item.totalAssigned, 0),
        totalSold: reconciliationItems.reduce((sum, item) => sum + item.totalSold, 0),
        totalReturned: reconciliationItems.reduce((sum, item) => sum + item.totalReturned, 0),
        totalRevenue: reconciliationItems.reduce((sum, item) => {
          return sum + item.saleItems.reduce((s, i) => s + i.total, 0);
        }, 0),
        discrepanciesCount: reconciliationItems.filter(item => item.status === 'discrepancy').length
      };
      
      setWeekSummary(summaryData);
      setError(null);

    } catch (err: any) {
      console.error("Error processing reconciliation:", err);
      setError(err.message || "Failed to process reconciliation");
    }
  }, [selectedStaffId, staffInventories, allSaleItems, products, viewMode, selectedWeek]);

  useEffect(() => {
    processReconciliation();
  }, [selectedStaffId, staffInventories, allSaleItems, products, viewMode, selectedWeek, processReconciliation]);

  // ==================== EDIT INVENTORY ====================
  const handleEditInventory = (item: ReconciliationItem) => {
    setEditingItem(item);
    const inventory = staffInventories.find(inv => inv.id === item.staffInventoryId);
    if (inventory) {
      setEditFormData({
        quantityGiven: inventory.quantityGiven,
        quantitySold: inventory.quantitySold || 0,
        quantityReturned: inventory.quantityReturned || 0
      });
    }
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    
    setProcessing(true);
    setError(null);
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const token = await user.getIdToken();
      
      const response = await fetch("/api/staff-inventory", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: editingItem.staffInventoryId,
          quantityGiven: editFormData.quantityGiven,
          quantitySold: editFormData.quantitySold,
          quantityReturned: editFormData.quantityReturned
        })
      });

      if (!response.ok) {
        throw new Error("Failed to update inventory");
      }

      setSuccess("Inventory updated successfully!");
      setShowEditModal(false);
      setEditingItem(null);
      await fetchData();

    } catch (err: any) {
      console.error("Error updating inventory:", err);
      setError(err.message || "Failed to update inventory");
    } finally {
      setProcessing(false);
    }
  };

  // ==================== DELETE INVENTORY ====================
  const handleDeleteInventory = async (inventoryId: number) => {
    if (!confirm("Are you sure you want to delete this assignment? This action cannot be undone.")) return;
    
    setProcessing(true);
    setError(null);
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const token = await user.getIdToken();
      
      const response = await fetch(`/api/staff-inventory?id=${inventoryId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to delete inventory");
      }

      setSuccess("Inventory deleted successfully!");
      await fetchData();

    } catch (err: any) {
      console.error("Error deleting inventory:", err);
      setError(err.message || "Failed to delete inventory");
    } finally {
      setProcessing(false);
    }
  };

  // ==================== CLOSE WEEK ====================
  const closeWeek = async () => {
    setProcessing(true);
    setError(null);
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const token = await user.getIdToken();
      
      // Get all inventory items for the selected week and staff
      let inventoryToClose = staffInventories;
      if (selectedStaffId) {
        inventoryToClose = inventoryToClose.filter(inv => inv.staffId === selectedStaffId);
      }
      if (selectedWeek) {
        inventoryToClose = inventoryToClose.filter(inv => inv.weekStartDate === selectedWeek);
      }

      if (inventoryToClose.length === 0) {
        setError("No inventory found to close");
        setProcessing(false);
        return;
      }

      const nextWeek = getWeekRange(new Date(new Date(selectedWeek || Date.now()).getTime() + 7 * 24 * 60 * 60 * 1000));
      
      const carriedForwardItems = [];
      
      for (const inv of inventoryToClose) {
        const remainingItems = inv.quantityGiven - inv.quantitySold - inv.quantityReturned;
        
        if (remainingItems > 0) {
          // Create new inventory for next week for the same staff
          const response = await fetch("/api/staff-inventory", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              staffId: inv.staffId,
              productId: inv.productId,
              quantityGiven: remainingItems,
              weekStartDate: nextWeek.start.toISOString(),
              weekEndDate: nextWeek.end.toISOString(),
              notes: `Carried forward from week ${formatDate(inv.weekStartDate || '')} - ${closeWeekNotes || 'Week closure'}`
            })
          });

          if (response.ok) {
            const newInv = await response.json();
            carriedForwardItems.push({
              productId: inv.productId,
              quantity: remainingItems,
              staffName: inv.staff?.name,
              newInventoryId: newInv.id
            });
          }
        }
      }

      setSuccess(`Week closed successfully! Carried forward ${carriedForwardItems.length} items to next week.`);
      setShowCloseWeekModal(false);
      setCloseWeekNotes("");
      await fetchData();

    } catch (err: any) {
      console.error("Error closing week:", err);
      setError(err.message || "Failed to close week");
    } finally {
      setProcessing(false);
    }
  };

  // ==================== ASSIGN PRODUCTS TO STAFF ====================
  const handleAssignProducts = async () => {
    setProcessing(true);
    setError(null);
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const token = await user.getIdToken();
      
      const response = await fetch("/api/staff-inventory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          staffId: assignData.staffId,
          productId: assignData.productId,
          quantityGiven: assignData.quantity,
          weekStartDate: new Date().toISOString(),
          weekEndDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
          notes: assignData.notes || 'Initial assignment'
        })
      });

      if (!response.ok) {
        throw new Error("Failed to assign products");
      }

      setSuccess("Products assigned successfully!");
      setShowAssignModal(false);
      setAssignData({ staffId: 0, productId: 0, quantity: 0, notes: '' });
      await fetchData();

    } catch (err: any) {
      console.error("Error assigning products:", err);
      setError(err.message || "Failed to assign products");
    } finally {
      setProcessing(false);
    }
  };

  // ==================== REASSIGN TO DIFFERENT STAFF ====================
  const handleReassignProducts = async (inventoryId: number, newStaffId: number) => {
    setProcessing(true);
    setError(null);
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const token = await user.getIdToken();
      
      // Get the current inventory
      const inventory = staffInventories.find(inv => inv.id === inventoryId);
      if (!inventory) {
        throw new Error("Inventory not found");
      }

      // Update the inventory with new staff
      const response = await fetch("/api/staff-inventory", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: inventoryId,
          staffId: newStaffId,
          productId: inventory.productId,
          quantityGiven: inventory.quantityGiven,
          quantitySold: inventory.quantitySold || 0,
          quantityReturned: inventory.quantityReturned || 0
        })
      });

      if (!response.ok) {
        throw new Error("Failed to reassign products");
      }

      setSuccess("Products reassigned successfully!");
      await fetchData();

    } catch (err: any) {
      console.error("Error reassigning products:", err);
      setError(err.message || "Failed to reassign products");
    } finally {
      setProcessing(false);
    }
  };

  // ==================== GENERATE REPORT ====================
  const generateReport = () => {
    if (reconciliationData.length === 0) {
      setError("No data to generate report");
      return;
    }

    try {
      const reportData = {
        generatedAt: new Date().toISOString(),
        weekStart: weekSummary?.weekStart || '',
        weekEnd: weekSummary?.weekEnd || '',
        summary: weekSummary,
        items: reconciliationData.map(item => ({
          productName: item.productName,
          category: item.productCategory,
          assigned: item.totalAssigned,
          sold: item.totalSold,
          returned: item.totalReturned,
          discrepancy: item.discrepancy,
          status: item.status,
          staffName: item.staffName,
          sales: item.saleItems.map(sale => ({
            date: sale.saleDate,
            quantity: sale.quantity,
            total: sale.total,
            customer: sale.customerName,
            saleId: sale.saleId
          }))
        }))
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reconciliation_report_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);

      setSuccess("Report generated successfully!");

    } catch (err: any) {
      console.error("Error generating report:", err);
      setError(err.message || "Failed to generate report");
    }
  };

  // ==================== EXPORT CSV ====================
  const exportToCSV = () => {
    if (reconciliationData.length === 0) return;

    const csvData = reconciliationData.map(item => ({
      'Product': item.productName,
      'Category': item.productCategory,
      'Assigned': item.totalAssigned,
      'Sold': item.totalSold,
      'Returned': item.totalReturned,
      'Discrepancy': item.discrepancy,
      'Status': item.status.toUpperCase(),
      'Staff': item.staffName,
      'Assigned Date': formatDate(item.assignedDate),
      'Last Sold Date': formatDate(item.lastSoldDate)
    }));

    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => `"${String(row[h as keyof typeof row]).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const staffName = selectedStaffId ? staffList.find(s => s.id === selectedStaffId)?.name : 'all';
    link.setAttribute('href', url);
    link.setAttribute('download', `reconciliation_${staffName}_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  // ==================== VIEW DETAILS ====================
  const viewProductDetails = (item: ReconciliationItem) => {
    setSelectedProduct(item);
    setShowDetailModal(true);
  };

  // ==================== RENDER HELPERS ====================
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'matched': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'discrepancy': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'carried_forward': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'matched': return <CheckCircle size={16} className="text-green-500" />;
      case 'discrepancy': return <AlertTriangle size={16} className="text-red-500" />;
      case 'carried_forward': return <ArrowRight size={16} className="text-yellow-500" />;
      default: return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'matched': return 'Matched';
      case 'discrepancy': return 'Discrepancy';
      case 'carried_forward': return 'Carried Forward';
      default: return 'Unknown';
    }
  };

  // ==================== FILTERS & SEARCH ====================
  const filteredData = useMemo(() => {
    let data = [...reconciliationData];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter(item => 
        item.productName.toLowerCase().includes(term) ||
        item.productCategory.toLowerCase().includes(term) ||
        item.staffName.toLowerCase().includes(term)
      );
    }
    
    if (filterStatus !== "all") {
      data = data.filter(item => item.status === filterStatus);
    }
    
    data.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "productName":
          comparison = a.productName.localeCompare(b.productName);
          break;
        case "discrepancy":
          comparison = Math.abs(a.discrepancy) - Math.abs(b.discrepancy);
          break;
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });
    
    return data;
  }, [reconciliationData, searchTerm, filterStatus, sortBy, sortOrder]);

  // ==================== RENDER ====================
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={`min-h-screen transition-colors duration-200 ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        
        {/* Navigation Bar */}
        <NavigationBar activePage="reconciliation" />
        
        {/* Theme Toggle */}
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
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                  <BarChart3 size={24} />
                  Product Reconciliation
                </h1>
                <p className="text-xs text-gray-500 mt-1">Compare staff inventory against system sales</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-blue-700 transition-colors"
                >
                  <UserPlus size={16} />
                  Assign Products
                </button>
                <button
                  onClick={exportToCSV}
                  disabled={reconciliationData.length === 0}
                  className="bg-green-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <Download size={16} />
                  Export CSV
                </button>
                <button
                  onClick={generateReport}
                  disabled={reconciliationData.length === 0}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <FileSpreadsheet size={16} />
                  Generate Report
                </button>
                <button
                  onClick={() => setShowCloseWeekModal(true)}
                  disabled={reconciliationData.length === 0 || processing}
                  className="bg-red-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  <Flag size={16} />
                  Close Week
                </button>
                <button
                  onClick={fetchData}
                  className="bg-gray-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-gray-700 transition-colors"
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

          {/* Controls */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* View Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  View Mode
                </label>
                <div className="flex rounded-lg overflow-hidden border dark:border-gray-600">
                  <button
                    onClick={() => setViewMode('all')}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                      viewMode === 'all'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    All Staff
                  </button>
                  <button
                    onClick={() => setViewMode('staff')}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                      viewMode === 'staff'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    By Staff
                  </button>
                </div>
              </div>

              {/* Staff Selection */}
              {viewMode === 'staff' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Select Staff
                  </label>
                  <div className="relative">
                    <Users size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <select
                      value={selectedStaffId || ""}
                      onChange={(e) => setSelectedStaffId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                    >
                      <option value="">Select a staff member...</option>
                      {staffList.map(staff => (
                        <option key={staff.id} value={staff.id}>{staff.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Week Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Week Period
                </label>
                <div className="relative">
                  <CalendarDays size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <select
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                  >
                    <option value="">All Weeks</option>
                    {availableWeeks.map((week, index) => (
                      <option key={index} value={week.start}>
                        {formatDate(week.start)} - {formatDate(week.end)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quick Actions
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const now = new Date();
                      const week = getWeekRange(now);
                      setSelectedWeek(week.start.toISOString());
                    }}
                    className="flex-1 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    This Week
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date();
                      const week = getWeekRange(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
                      setSelectedWeek(week.start.toISOString());
                    }}
                    className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Last Week
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          {weekSummary && reconciliationData.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-blue-500">
                <div className="text-xs text-gray-500">Staff</div>
                <div className="text-xl font-bold text-blue-600">{weekSummary.totalStaff}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-green-500">
                <div className="text-xs text-gray-500">Products</div>
                <div className="text-xl font-bold text-green-600">{weekSummary.totalProducts}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-purple-500">
                <div className="text-xs text-gray-500">Assigned</div>
                <div className="text-xl font-bold text-purple-600">{weekSummary.totalAssigned}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-orange-500">
                <div className="text-xs text-gray-500">Sold</div>
                <div className="text-xl font-bold text-orange-600">{weekSummary.totalSold}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-yellow-500">
                <div className="text-xs text-gray-500">Revenue</div>
                <div className="text-xl font-bold text-yellow-600">KSh {formatCurrency(weekSummary.totalRevenue)}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-red-500">
                <div className="text-xs text-gray-500">Discrepancies</div>
                <div className={`text-xl font-bold ${weekSummary.discrepanciesCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {weekSummary.discrepanciesCount > 0 ? weekSummary.discrepanciesCount : '✓'}
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          {reconciliationData.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
              <div className="p-3 border-b dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-500" />
                  <span className="font-medium text-sm">Filters & Search</span>
                </div>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
                    <div className="relative">
                      <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Product, staff..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as any)}
                      className="w-full p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                    >
                      <option value="all">All</option>
                      <option value="matched">Matched</option>
                      <option value="discrepancy">Discrepancy</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Sort By</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="w-full p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                    >
                      <option value="discrepancy">Discrepancy</option>
                      <option value="productName">Product Name</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Order</label>
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as any)}
                      className="w-full p-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                    >
                      <option value="desc">Highest First</option>
                      <option value="asc">Lowest First</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
              <p className="text-gray-500">Loading data...</p>
            </div>
          )}

          {/* No Data State */}
          {!loading && reconciliationData.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center">
              <Package size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No data available</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or select a different staff member</p>
            </div>
          )}

          {/* Reconciliation Table */}
          {!loading && reconciliationData.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                    <tr>
                      <th className="text-left p-3 font-semibold">Product</th>
                      <th className="text-center p-3 font-semibold">Staff</th>
                      <th className="text-center p-3 font-semibold">Assigned</th>
                      <th className="text-center p-3 font-semibold">Sold</th>
                      <th className="text-center p-3 font-semibold">Returned</th>
                      <th className="text-center p-3 font-semibold">Discrepancy</th>
                      <th className="text-center p-3 font-semibold">Status</th>
                      <th className="text-center p-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {filteredData.map((item) => (
                      <React.Fragment key={`${item.productId}-${item.staffInventoryId}`}>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="p-3">
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">{item.productName}</div>
                              <div className="text-xs text-gray-500">{item.productCategory}</div>
                            </div>
                          </td>
                          <td className="p-3 text-center text-sm">{item.staffName}</td>
                          <td className="p-3 text-center font-semibold text-blue-600">{item.totalAssigned}</td>
                          <td className="p-3 text-center font-semibold text-purple-600">{item.totalSold}</td>
                          <td className="p-3 text-center font-semibold text-green-600">{item.totalReturned}</td>
                          <td className="p-3 text-center">
                            {item.discrepancy !== 0 ? (
                              <span className={`font-bold ${item.discrepancy > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {item.discrepancy > 0 ? `+${item.discrepancy}` : item.discrepancy}
                              </span>
                            ) : (
                              <span className="text-green-500">✓</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                              {getStatusIcon(item.status)}
                              {getStatusLabel(item.status)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => viewProductDetails(item)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition"
                                title="View Details"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => handleEditInventory(item)}
                                className="p-1.5 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition"
                                title="Edit Assignment"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete assignment for ${item.productName}?`)) {
                                    handleDeleteInventory(item.staffInventoryId);
                                  }
                                }}
                                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                                title="Delete Assignment"
                              >
                                <Trash2 size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  const newStaffId = prompt("Enter new staff ID for reassignment:");
                                  if (newStaffId && !isNaN(parseInt(newStaffId))) {
                                    handleReassignProducts(item.staffInventoryId, parseInt(newStaffId));
                                  }
                                }}
                                className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition"
                                title="Reassign to Different Staff"
                              >
                                <RotateCcw size={16} />
                              </button>
                              <button
                                onClick={() => setExpandedItem(expandedItem === item.productId ? null : item.productId)}
                                className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
                              >
                                {expandedItem === item.productId ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedItem === item.productId && (
                          <tr className="bg-gray-50 dark:bg-gray-800/50">
                            <td colSpan={8} className="p-4">
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <div className="bg-white dark:bg-gray-700 rounded p-2 text-center">
                                    <div className="text-xs text-gray-500">Assigned</div>
                                    <div className="text-lg font-bold text-blue-600">{item.totalAssigned}</div>
                                  </div>
                                  <div className="bg-white dark:bg-gray-700 rounded p-2 text-center">
                                    <div className="text-xs text-gray-500">Sold</div>
                                    <div className="text-lg font-bold text-purple-600">{item.totalSold}</div>
                                  </div>
                                  <div className="bg-white dark:bg-gray-700 rounded p-2 text-center">
                                    <div className="text-xs text-gray-500">Returned</div>
                                    <div className="text-lg font-bold text-green-600">{item.totalReturned}</div>
                                  </div>
                                  <div className={`bg-white dark:bg-gray-700 rounded p-2 text-center ${item.discrepancy !== 0 ? 'border-2 border-red-200 dark:border-red-800' : 'border-2 border-green-200 dark:border-green-800'}`}>
                                    <div className="text-xs text-gray-500">Discrepancy</div>
                                    <div className={`text-lg font-bold ${item.discrepancy !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {item.discrepancy !== 0 ? item.discrepancy : '✓ Matched'}
                                    </div>
                                  </div>
                                </div>
                                
                                {item.saleItems.length > 0 && (
                                  <div>
                                    <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Sales Details</h5>
                                    <div className="bg-white dark:bg-gray-700 rounded-lg overflow-x-auto">
                                      <table className="w-full text-xs">
                                        <thead className="bg-gray-50 dark:bg-gray-600/50">
                                          <tr>
                                            <th className="p-2 text-left">Sale ID</th>
                                            <th className="p-2 text-left">Date</th>
                                            <th className="p-2 text-center">Qty</th>
                                            <th className="p-2 text-right">Price</th>
                                            <th className="p-2 text-right">Total</th>
                                            <th className="p-2 text-left">Customer</th>
                                            <th className="p-2 text-center">Status</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-gray-600">
                                          {item.saleItems.map((sale, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-600/50">
                                              <td className="p-2 font-medium text-blue-600">#{sale.saleId}</td>
                                              <td className="p-2">{formatDate(sale.saleDate)}</td>
                                              <td className="p-2 text-center">{sale.quantity}</td>
                                              <td className="p-2 text-right">KSh {formatCurrency(sale.price)}</td>
                                              <td className="p-2 text-right font-semibold">KSh {formatCurrency(sale.total)}</td>
                                              <td className="p-2">{sale.customerName}</td>
                                              <td className="p-2 text-center">
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                  sale.saleStatus === 'PAID' ? 'bg-green-100 text-green-700' :
                                                  sale.saleStatus === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' :
                                                  'bg-red-100 text-red-700'
                                                }`}>
                                                  {sale.saleStatus}
                                                </span>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer Stats */}
          {reconciliationData.length > 0 && (
            <div className="mt-4 text-center text-xs text-gray-400">
              Showing {filteredData.length} of {reconciliationData.length} products
              {weekSummary && ` | Total discrepancy: ${weekSummary.discrepanciesCount > 0 ? weekSummary.discrepanciesCount : '✓ All matched'}`}
            </div>
          )}
          
        </div>
      </div>

      {/* ==================== DETAIL MODAL ==================== */}
      {showDetailModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-t-xl flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">{selectedProduct.productName}</h2>
                <p className="text-purple-100 text-sm">Reconciliation Details</p>
              </div>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Assigned</div>
                  <div className="text-xl font-bold text-blue-600">{selectedProduct.totalAssigned}</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Sold</div>
                  <div className="text-xl font-bold text-purple-600">{selectedProduct.totalSold}</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Returned</div>
                  <div className="text-xl font-bold text-green-600">{selectedProduct.totalReturned}</div>
                </div>
                <div className={`rounded-lg p-3 text-center ${selectedProduct.discrepancy !== 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                  <div className="text-xs text-gray-500">Status</div>
                  <div className={`text-lg font-bold ${selectedProduct.discrepancy !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {selectedProduct.discrepancy !== 0 ? `${selectedProduct.discrepancy} units off` : '✓ Matched'}
                  </div>
                </div>
              </div>

              {selectedProduct.saleItems.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                    <Package size={16} className="text-purple-600" />
                    Sales Details ({selectedProduct.saleItems.length})
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700/50 border-b">
                        <tr>
                          <th className="text-left p-2 font-semibold">Sale ID</th>
                          <th className="text-left p-2 font-semibold">Date</th>
                          <th className="text-center p-2 font-semibold">Qty</th>
                          <th className="text-right p-2 font-semibold">Price</th>
                          <th className="text-right p-2 font-semibold">Total</th>
                          <th className="text-left p-2 font-semibold">Customer</th>
                          <th className="text-center p-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedProduct.saleItems.map((sale, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="p-2 font-medium text-blue-600">#{sale.saleId}</td>
                            <td className="p-2">{formatDate(sale.saleDate)}</td>
                            <td className="p-2 text-center font-semibold">{sale.quantity}</td>
                            <td className="p-2 text-right">KSh {formatCurrency(sale.price)}</td>
                            <td className="p-2 text-right font-semibold text-green-600">KSh {formatCurrency(sale.total)}</td>
                            <td className="p-2">{sale.customerName}</td>
                            <td className="p-2 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                sale.saleStatus === 'PAID' ? 'bg-green-100 text-green-700' :
                                sale.saleStatus === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {sale.saleStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t">
                        <tr>
                          <td colSpan={4} className="p-2 text-right font-bold">Total:</td>
                          <td className="p-2 text-right font-bold text-purple-600">
                            KSh {formatCurrency(selectedProduct.saleItems.reduce((sum, s) => sum + s.total, 0))}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== EDIT MODAL ==================== */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full shadow-2xl">
            <div className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white p-4 rounded-t-xl flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Edit2 size={20} />
                  Edit Assignment
                </h2>
                <p className="text-yellow-100 text-sm">{editingItem.productName}</p>
              </div>
              <button 
                onClick={() => {
                  setShowEditModal(false);
                  setEditingItem(null);
                }}
                className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Assigned
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editFormData.quantityGiven}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, quantityGiven: parseInt(e.target.value) || 0 }))}
                    className="w-full p-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sold
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editFormData.quantitySold}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, quantitySold: parseInt(e.target.value) || 0 }))}
                    className="w-full p-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Returned
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editFormData.quantityReturned}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, quantityReturned: parseInt(e.target.value) || 0 }))}
                    className="w-full p-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition"
                  />
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <AlertTriangle size={16} className="inline mr-1" />
                  Changing these values will update the inventory record and affect reconciliation calculations.
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingItem(null);
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={processing}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CLOSE WEEK MODAL ==================== */}
      {showCloseWeekModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full shadow-2xl">
            <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-4 rounded-t-xl flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Flag size={20} />
                  Close Week
                </h2>
                <p className="text-red-100 text-sm">This will carry forward remaining items</p>
              </div>
              <button 
                onClick={() => setShowCloseWeekModal(false)}
                className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Week Notes
                </label>
                <textarea
                  value={closeWeekNotes}
                  onChange={(e) => setCloseWeekNotes(e.target.value)}
                  placeholder="Add notes about this week's closure..."
                  className="w-full p-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                  rows={3}
                />
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <AlertTriangle size={16} className="inline mr-1" />
                  This will close the current week and carry forward all unsold items to the next week for the same staff.
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCloseWeekModal(false);
                    setCloseWeekNotes("");
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  disabled={processing}
                >
                  Cancel
                </button>
                <button
                  onClick={closeWeek}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Closing...
                    </>
                  ) : (
                    <>
                      <Flag size={16} />
                      Close Week
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ASSIGN PRODUCTS MODAL ==================== */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full shadow-2xl">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-t-xl flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <UserPlus size={20} />
                  Assign Products
                </h2>
                <p className="text-blue-100 text-sm">Assign products to staff for the week</p>
              </div>
              <button 
                onClick={() => {
                  setShowAssignModal(false);
                  setAssignData({ staffId: 0, productId: 0, quantity: 0, notes: '' });
                }}
                className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Staff
                </label>
                <select
                  value={assignData.staffId}
                  onChange={(e) => setAssignData(prev => ({ ...prev, staffId: parseInt(e.target.value) }))}
                  className="w-full p-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                >
                  <option value={0}>Select staff...</option>
                  {staffList.map(staff => (
                    <option key={staff.id} value={staff.id}>{staff.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Product
                </label>
                <select
                  value={assignData.productId}
                  onChange={(e) => setAssignData(prev => ({ ...prev, productId: parseInt(e.target.value) }))}
                  className="w-full p-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                >
                  <option value={0}>Select product...</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={assignData.quantity || ''}
                  onChange={(e) => setAssignData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                  placeholder="Enter quantity"
                  className="w-full p-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={assignData.notes}
                  onChange={(e) => setAssignData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Assignment notes"
                  className="w-full p-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setAssignData({ staffId: 0, productId: 0, quantity: 0, notes: '' });
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignProducts}
                  disabled={!assignData.staffId || !assignData.productId || !assignData.quantity || processing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Assigning...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      Assign Products
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ThemeContext.Provider>
  );
}