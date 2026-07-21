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
  CheckCircle,
  AlertCircle,
  X,
  RefreshCw,
  Trash2,
  Eye,
  Plus,
  PackageX,
  Download,
  Printer,
  CalendarDays,
  Hash,
  TrendingUp,
  TrendingDown,
  CheckSquare,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Percent,
  Search,
  Filter,
  BarChart3,
  FileText,
  ListChecks,
  ExternalLink,
  Grid,
  List,
  Archive,
  FileSpreadsheet,
  ClipboardCheck,
  History,
  Box,
  AlertOctagon,
  Tag,
  FileDigit,
  CheckCheck,
  FileBarChart,
  ClipboardList,
  Edit,
  Save,
  Check,
  Users,
  ChevronDown,
  Upload,
  Minus,
  Package2,
  ShoppingBag,
  Layers,
  TrendingUp as TrendingUpIcon,
  AlertTriangle as AlertTriangleIcon,
  Download as DownloadIcon,
  Shield,
  Lock,
  Unlock,
  Key,
  EyeOff
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
}

interface StaffInventory {
  id: number;
  staffId: number;
  productId: number;
  weekStartDate: Date | null;
  weekEndDate: Date | null;
  quantityGiven: number;
  quantitySold: number;
  quantityReturned: number;
  createdAt: Date;
  updatedAt: Date;
  product: Product;
  staff: Staff;
  saleItems?: SaleItem[];
}

interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  productionCost?: number;
  category?: string;
  image?: string;
  inStock?: boolean;
  stock?: Stock[];
}

interface Stock {
  id: number;
  productId: number;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  product?: Product;
}

interface Sale {
  id: number;
  amount: number;
  date: Date;
  paymentMethod: string;
  status: string;
  createdAt: Date;
  createdById?: number;
  saleitem?: SaleItem[];
  customer?: Customer;
  customerId?: number;
}

interface SaleItem {
  id: number;
  quantity: number;
  price: number;
  total: number;
  productId: number;
  product: Product;
  staffInventoryId?: number;
}

interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

interface WeeklyPerformance {
  week: string;
  weekStart: Date;
  weekEnd: Date;
  totalGiven: number;
  totalSold: number;
  totalReturned: number;
  remaining: number;
  sellThroughRate: number;
  status: 'active' | 'completed' | 'upcoming';
  inventory: StaffInventory[];
  sales: Sale[];
  totalRevenue: number;
}

interface ReturnItem {
  productName: string;
  productCategory: string;
  quantityReturned: number;
  reason?: string;
  returnedAt: Date;
  weekStart: Date;
  weekEnd: Date;
  staffName: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface StockAdjustment {
  type: 'add' | 'remove' | 'return';
  quantity: number;
  productId: number;
  staffInventoryId: number;
  reason?: string;
}

const StaffDetailsPage = () => {
  const router = useRouter();
  const params = useParams();
  const staffId = params.staffId as string;

  // States
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingCloseWeek, setLoadingCloseWeek] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [stockData, setStockData] = useState<Stock[]>([]);
  
  // Data states
  const [weeklyPerformance, setWeeklyPerformance] = useState<WeeklyPerformance[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<WeeklyPerformance | null>(null);
  const [showWeekDetails, setShowWeekDetails] = useState(false);
  
  // Edit states
  const [editingItem, setEditingItem] = useState<StaffInventory | null>(null);
  const [editForm, setEditForm] = useState({
    quantityGiven: '',
    quantitySold: '',
    quantityReturned: '',
    weekStartDate: '',
    weekEndDate: ''
  });
  const [availableStock, setAvailableStock] = useState(0);
  const [stockError, setStockError] = useState<string | null>(null);
  
  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchProductQuery, setSearchProductQuery] = useState("");
  
  // Return modal states
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<StaffInventory | null>(null);
  const [returnQuantity, setReturnQuantity] = useState('');
  const [returnReason, setReturnReason] = useState('');
  
  // Add/Remove modal states
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add');
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  
  // Restock modal states
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockQuantity, setRestockQuantity] = useState('');
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockInventoryId, setRestockInventoryId] = useState<number | null>(null);
  
  // Close week modal states
  const [showCloseWeekModal, setShowCloseWeekModal] = useState(false);
  const [weekToClose, setWeekToClose] = useState<WeeklyPerformance | null>(null);
  
  // Filter states
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Get current week dates
  const getCurrentWeekDates = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    let diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return { weekStartDate: monday, weekEndDate: sunday };
  };

  // Check if date is in week
  const isDateInWeek = (date: Date, weekStart: Date, weekEnd: Date) => {
    const checkDate = new Date(date);
    return checkDate >= weekStart && checkDate <= weekEnd;
  };

  // Format week range
  const formatWeekRange = (startDate: Date, endDate: Date) => {
    return `${startDate.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })} - ${endDate.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })}`;
  };

  // Format date with time
  const formatDateTime = (date: Date | string | null) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Enhanced error handler
  const handleError = (err: any, customMessage?: string) => {
    console.error("Error:", err);
    
    let errorMessage = customMessage || "An error occurred";
    
    if (err instanceof Error) {
      errorMessage = err.message;
    } else if (typeof err === 'string') {
      errorMessage = err;
    } else if (err?.message) {
      errorMessage = err.message;
    } else if (err?.error) {
      errorMessage = err.error;
    }
    
    setError(errorMessage);
    
    setTimeout(() => {
      setError(null);
    }, 5000);
  };

  // Fetch staff details
  const fetchStaffDetails = useCallback(async () => {
    if (!staffId) return;

    setLoading(true);
    setError(null);
    setStockError(null);

    try {
      console.log(`Fetching staff details for ID: ${staffId}`);
      
      const endpoints = [
        `/api/staff/${staffId}/inventory`,
        `/api/staff/${staffId}?include=inventories,sales`
      ];

      let response = null;
      let data = null;

      for (const endpoint of endpoints) {
        try {
          console.log(`Trying endpoint: ${endpoint}`);
          response = await fetch(endpoint);
          
          if (response.ok) {
            data = await response.json();
            console.log(`Success with endpoint ${endpoint}:`, data);
            break;
          }
        } catch (err) {
          console.log(`Endpoint ${endpoint} failed:`, err);
          continue;
        }
      }

      if (!response || !response.ok) {
        throw new Error("Failed to fetch staff inventory");
      }

      let staffData: Staff | null = null;
      let inventories: StaffInventory[] = [];
      let sales: Sale[] = [];

      if (data.success === false) {
        throw new Error(data.error || "API returned error");
      }

      if (data.data) {
        const responseData = data.data;
        staffData = responseData.staff || responseData;
        inventories = responseData.inventories || responseData.staffInventories || [];
        sales = responseData.sales || [];
      } else if (data.staff) {
        staffData = data.staff;
        inventories = data.staff.staffInventories || [];
        sales = data.staff.sales || [];
      } else {
        staffData = data;
        inventories = data.staffInventories || [];
        sales = data.sales || [];
      }

      if (!staffData) {
        staffData = {
          id: parseInt(staffId),
          name: "Staff Member",
          email: "",
          phone: "",
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }

      console.log("Processed staff data:", staffData);
      console.log("Processed inventories:", inventories);
      console.log("Processed sales:", sales);

      setStaff(staffData);
      
      processWeeklyData(inventories, sales);

    } catch (err: any) {
      console.error("Error in fetchStaffDetails:", err);
      handleError(err, "Failed to load staff details");
      
      setStaff({
        id: parseInt(staffId),
        name: "Staff Member",
        email: "",
        phone: "",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      setWeeklyPerformance([]);
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  // Fetch product stock
  const fetchProductStock = async (productId: number): Promise<number> => {
    try {
      console.log(`Fetching stock for product ID: ${productId}`);
      
      const stockItem = stockData.find(stock => stock.productId === productId);
      if (stockItem) {
        console.log(`Found stock in local state: ${stockItem.quantity}`);
        return stockItem.quantity;
      }
      
      try {
        const response = await fetch(`/api/stock?productId=${productId}`);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            const productStock = data.find((s: any) => s.productId === productId);
            if (productStock?.quantity !== undefined) {
              return productStock.quantity;
            }
          } else if (data?.quantity !== undefined) {
            return data.quantity;
          } else if (data?.data?.quantity !== undefined) {
            return data.data.quantity;
          }
        }
      } catch (stockError) {
        console.log("Direct stock API failed");
      }
      
      try {
        const response = await fetch(`/api/products/${productId}`);
        if (response.ok) {
          const data = await response.json();
          const stockQuantity = 
            data?.stock?.[0]?.quantity ||
            data?.data?.stock?.[0]?.quantity ||
            data?.quantity ||
            data?.data?.quantity ||
            data?.availableStock ||
            data?.data?.availableStock ||
            0;
          if (stockQuantity > 0) {
            return stockQuantity;
          }
        }
      } catch (productError) {
        console.log("Products API failed");
      }
      
      return 0;
      
    } catch (err) {
      console.error('Error fetching stock:', err);
      return 0;
    }
  };

  // Fetch all stock data
  const fetchAllStockData = async () => {
    try {
      console.log("Fetching all stock data...");
      
      const endpoints = ['/api/stock', '/api/products/stock', '/api/inventory'];
      let stockDataResult: Stock[] = [];
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint);
          
          if (response.ok) {
            const data = await response.json();
            
            if (Array.isArray(data)) {
              stockDataResult = data.map((item: any) => ({
                id: item.id,
                productId: item.productId,
                quantity: item.quantity || 0,
                costPrice: item.costPrice || 0,
                sellingPrice: item.sellingPrice || 0,
                product: item.product
              }));
              break;
            } else if (data.data && Array.isArray(data.data)) {
              stockDataResult = data.data.map((item: any) => ({
                id: item.id,
                productId: item.productId,
                quantity: item.quantity || 0,
                costPrice: item.costPrice || 0,
                sellingPrice: item.sellingPrice || 0,
                product: item.product
              }));
              break;
            } else if (data.stock && Array.isArray(data.stock)) {
              stockDataResult = data.stock;
              break;
            }
          }
        } catch (err) {
          console.log(`Endpoint ${endpoint} failed:`, err);
          continue;
        }
      }
      
      if (staff && weeklyPerformance.length > 0) {
        const allInventoryItems = weeklyPerformance.flatMap(week => week.inventory);
        const stockFromInventory: Stock[] = [];
        
        allInventoryItems.forEach(item => {
          if (item.product && item.product.stock && item.product.stock.length > 0) {
            const stockItem = item.product.stock[0];
            if (!stockDataResult.find(s => s.productId === stockItem.productId)) {
              stockFromInventory.push(stockItem);
            }
          }
        });
        
        stockDataResult = [...stockDataResult, ...stockFromInventory];
      }
      
      console.log("Final stock data to set:", stockDataResult);
      setStockData(stockDataResult);
      
      if (editingItem) {
        const stockItem = stockDataResult.find(stock => stock.productId === editingItem.productId);
        setAvailableStock(stockItem ? stockItem.quantity : 0);
      }
      
    } catch (error) {
      console.error('Error fetching stock data:', error);
      setStockData([]);
    }
  };

  // Get available stock
  const getAvailableStock = (productId: number): number => {
    const stockItem = stockData.find(stock => stock.productId === productId);
    return stockItem ? stockItem.quantity : 0;
  };

  // Process weekly data
  const processWeeklyData = (inventories: StaffInventory[], sales: Sale[]) => {
    console.log("Processing weekly data with inventories:", inventories);
    
    if (!inventories || inventories.length === 0) {
      setWeeklyPerformance([]);
      return;
    }

    const weeklyMap = new Map<string, WeeklyPerformance>();
    const now = new Date();
    
    inventories.forEach((inventory) => {
      if (!inventory) return;

      let weekStartDate: Date;
      let weekEndDate: Date;
      
      if (inventory.weekStartDate && inventory.weekEndDate) {
        weekStartDate = new Date(inventory.weekStartDate);
        weekEndDate = new Date(inventory.weekEndDate);
      } else {
        const currentWeek = getCurrentWeekDates();
        weekStartDate = currentWeek.weekStartDate;
        weekEndDate = currentWeek.weekEndDate;
      }
      
      const weekKey = `${weekStartDate.toISOString().split('T')[0]}_${weekEndDate.toISOString().split('T')[0]}`;
      
      if (!weeklyMap.has(weekKey)) {
        const isActive = now >= weekStartDate && now <= weekEndDate;
        const isCompleted = now > weekEndDate;
        
        weeklyMap.set(weekKey, {
          week: `Week ${formatDateShort(weekStartDate)}`,
          weekStart: weekStartDate,
          weekEnd: weekEndDate,
          totalGiven: 0,
          totalSold: 0,
          totalReturned: 0,
          remaining: 0,
          sellThroughRate: 0,
          status: isActive ? 'active' : isCompleted ? 'completed' : 'upcoming',
          inventory: [],
          sales: [],
          totalRevenue: 0
        });
      }
      
      const weekData = weeklyMap.get(weekKey)!;
      weekData.totalGiven += inventory.quantityGiven || 0;
      weekData.totalSold += inventory.quantitySold || 0;
      weekData.totalReturned += inventory.quantityReturned || 0;
      weekData.inventory.push(inventory);
    });
    
    if (sales && Array.isArray(sales)) {
      sales.forEach(sale => {
        if (!sale || !sale.date) return;
        
        const saleDate = new Date(sale.date);
        
        for (const [, weekData] of weeklyMap) {
          if (isDateInWeek(saleDate, weekData.weekStart, weekData.weekEnd)) {
            weekData.sales.push(sale);
            weekData.totalRevenue += sale.amount || 0;
            break;
          }
        }
      });
    }
    
    weeklyMap.forEach(weekData => {
      weekData.remaining = weekData.totalGiven - weekData.totalSold - weekData.totalReturned;
      weekData.sellThroughRate = weekData.totalGiven > 0 
        ? (weekData.totalSold / weekData.totalGiven) * 100 
        : 0;
    });
    
    const weeklyArray = Array.from(weeklyMap.values()).sort((a, b) => 
      b.weekStart.getTime() - a.weekStart.getTime()
    );
    
    console.log("Processed weekly performance:", weeklyArray);
    setWeeklyPerformance(weeklyArray);
  };

  // Handle edit click
  const handleEditClick = async (item: StaffInventory) => {
    console.log("Edit clicked for item:", item);
    setEditingItem(item);
    setEditForm({
      quantityGiven: (item.quantityGiven || 0).toString(),
      quantitySold: (item.quantitySold || 0).toString(),
      quantityReturned: (item.quantityReturned || 0).toString(),
      weekStartDate: item.weekStartDate ? new Date(item.weekStartDate).toISOString().split('T')[0] : '',
      weekEndDate: item.weekEndDate ? new Date(item.weekEndDate).toISOString().split('T')[0] : ''
    });
    
    try {
      const stock = await fetchProductStock(item.productId);
      setAvailableStock(stock);
      setStockError(null);
      
      if (stock === 0) {
        await fetchAllStockData();
      }
    } catch (err) {
      console.error("Error fetching stock:", err);
      setStockError("Unable to fetch stock information");
      setAvailableStock(0);
    }
  };

  // Handle restock items
  const handleRestockClick = (inventory: StaffInventory) => {
    setRestockProduct(inventory.product);
    setRestockInventoryId(inventory.id);
    setRestockQuantity('');
    setShowRestockModal(true);
  };

  // Process restock
  const handleProcessRestock = async () => {
    if (!restockInventoryId || !restockProduct) return;
    
    const quantity = parseInt(restockQuantity);
    if (quantity <= 0) {
      setError("Please enter a valid quantity");
      return;
    }
    
    setActionLoading(true);
    
    try {
      const response = await fetch('/api/staff-inventory/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryId: restockInventoryId,
          productId: restockProduct.id,
          quantity: quantity,
          reason: "Restock"
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to restock');
      }
      
      setSuccess(`Successfully restocked ${quantity} ${restockProduct.name}(s)`);
      setShowRestockModal(false);
      setRestockProduct(null);
      setRestockInventoryId(null);
      setRestockQuantity('');
      
      await Promise.all([
        fetchStaffDetails(),
        fetchAllStockData()
      ]);
      
    } catch (err: any) {
      console.error("Error restocking:", err);
      handleError(err, 'Failed to restock items');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editingItem) return;

    try {
      setActionLoading(true);
      setError(null);
      setStockError(null);

      const newQuantityGiven = parseInt(editForm.quantityGiven) || 0;
      const newQuantitySold = parseInt(editForm.quantitySold) || 0;
      const newQuantityReturned = parseInt(editForm.quantityReturned) || 0;
      
      const currentGiven = editingItem.quantityGiven || 0;
      const quantityGivenDiff = newQuantityGiven - currentGiven;

      if (newQuantitySold > newQuantityGiven) {
        setStockError("Sold quantity cannot exceed assigned quantity");
        return;
      }

      if (newQuantityReturned > newQuantityGiven - newQuantitySold) {
        setStockError("Returned quantity cannot exceed remaining quantity");
        return;
      }

      if (quantityGivenDiff > 0) {
        const currentStock = await fetchProductStock(editingItem.productId);
        if (quantityGivenDiff > currentStock) {
          setStockError(`Cannot add ${quantityGivenDiff} items. Only ${currentStock} available in stock.`);
          return;
        }
      }

      const updateData = {
        id: editingItem.id,
        quantityGiven: newQuantityGiven,
        quantitySold: newQuantitySold,
        quantityReturned: newQuantityReturned,
        weekStartDate: editForm.weekStartDate || editingItem.weekStartDate,
        weekEndDate: editForm.weekEndDate || editingItem.weekEndDate
      };

      const response = await fetch(`/api/staff-inventory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to update assignment');
      }

      setSuccess('Assignment updated successfully!');
      setEditingItem(null);
      
      await Promise.all([
        fetchStaffDetails(),
        fetchAllStockData()
      ]);

    } catch (err: any) {
      console.error("Error in handleSaveEdit:", err);
      handleError(err, 'Failed to update assignment');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle delete assignment
  const handleDeleteAssignment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this assignment? This will return items to stock.')) {
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/staff-inventory?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete assignment');
      }

      setSuccess(`Assignment deleted successfully! Items returned to stock.`);
      
      await Promise.all([
        fetchStaffDetails(),
        fetchAllStockData()
      ]);

    } catch (err: any) {
      console.error("Error in handleDeleteAssignment:", err);
      handleError(err, 'Failed to delete assignment');
    } finally {
      setActionLoading(false);
    }
  };

  // Get filtered inventory
  const getFilteredInventory = () => {
    if (!selectedWeek) return [];
    
    const weekInventory = selectedWeek.inventory.filter(inv => {
      const invWeekStart = inv.weekStartDate ? new Date(inv.weekStartDate) : null;
      const invWeekEnd = inv.weekEndDate ? new Date(inv.weekEndDate) : null;
      
      if (!invWeekStart || !invWeekEnd) return false;
      
      return invWeekStart.getTime() === selectedWeek.weekStart.getTime() &&
             invWeekEnd.getTime() === selectedWeek.weekEnd.getTime();
    });
    
    if (!searchProductQuery) return weekInventory;
    
    const query = searchProductQuery.toLowerCase();
    return weekInventory.filter(inv => 
      inv.product?.name?.toLowerCase().includes(query) ||
      inv.product?.category?.toLowerCase().includes(query)
    );
  };

  // Handle return items
  const handleReturnItems = async () => {
    if (!selectedInventory || !returnQuantity) {
      setError("Please select inventory and enter return quantity");
      return;
    }

    const returnQty = parseInt(returnQuantity);
    const currentGiven = selectedInventory.quantityGiven || 0;
    const currentSold = selectedInventory.quantitySold || 0;
    const currentReturned = selectedInventory.quantityReturned || 0;
    const remaining = currentGiven - currentSold - currentReturned;
    
    if (returnQty > remaining) {
      setError(`Cannot return more than ${remaining} items`);
      return;
    }

    try {
      const newQuantityReturned = currentReturned + returnQty;
      
      const updateData = {
        id: selectedInventory.id,
        quantityReturned: newQuantityReturned,
        returnReason: returnReason || "Defective/Damaged"
      };

      const response = await fetch(`/api/staff-inventory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to process return');
      }

      setSuccess(`${returnQty} items returned successfully!`);
      setShowReturnModal(false);
      setSelectedInventory(null);
      setReturnQuantity('');
      setReturnReason('');
      
      await Promise.all([
        fetchStaffDetails(),
        fetchAllStockData()
      ]);

    } catch (error: any) {
      console.error("Error in handleReturnItems:", error);
      handleError(error, 'Failed to process return');
    }
  };

  // Handle add/remove items
  const handleAdjustItems = async () => {
    if (!selectedInventory || !adjustQuantity) {
      setError("Please enter quantity");
      return;
    }

    const adjustQty = parseInt(adjustQuantity);
    if (adjustQty <= 0) {
      setError("Quantity must be greater than 0");
      return;
    }

    try {
      const availableStockFromServer = await fetchProductStock(selectedInventory.productId);
      
      if (adjustType === 'add' && adjustQty > availableStockFromServer) {
        setError(`Cannot add ${adjustQty} items. Only ${availableStockFromServer} available in stock.`);
        await fetchAllStockData();
        return;
      }

      const currentGiven = selectedInventory.quantityGiven || 0;
      const currentSold = selectedInventory.quantitySold || 0;
      const currentReturned = selectedInventory.quantityReturned || 0;
      const remaining = currentGiven - currentSold - currentReturned;
      
      if (adjustType === 'remove' && adjustQty > remaining) {
        setError(`Cannot remove ${adjustQty} items. Only ${remaining} remaining.`);
        return;
      }

      const updateData = {
        id: selectedInventory.id,
        adjustType,
        adjustQuantity: adjustQty,
        adjustReason: adjustReason || undefined
      };

      const response = await fetch(`/api/staff-inventory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || `Failed to adjust inventory`);
      }

      setSuccess(`${adjustType === 'add' ? 'Added' : 'Removed'} ${adjustQty} items successfully!`);
      setShowAdjustModal(false);
      setSelectedInventory(null);
      setAdjustQuantity('');
      setAdjustReason('');
      
      await Promise.all([
        fetchStaffDetails(),
        fetchAllStockData()
      ]);

    } catch (error: any) {
      console.error("Error in handleAdjustItems:", error);
      handleError(error, 'Failed to adjust inventory');
    }
  };

  // Handle close week
  const handleCloseWeek = async () => {
    if (!weekToClose) return;
    
    setLoadingCloseWeek(weekToClose.week);
    
    try {
      const response = await fetch(`/api/staff/${staffId}/close-week`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart: weekToClose.weekStart.toISOString(),
          weekEnd: weekToClose.weekEnd.toISOString(),
          autoReturnRemaining: true,
          returnReason: "Week closure - remaining items",
          addToStock: true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to close week');
      }

      const data = await response.json();
      
      if (data.success === false) {
        throw new Error(data.error || 'Failed to close week');
      }

      const totalItemsReturned = data.totalItemsReturned || data.closedAssignments?.length || 0;
      setSuccess(`Week closed successfully! ${totalItemsReturned} items marked as returned.`);
      setShowCloseWeekModal(false);
      setWeekToClose(null);
      
      if (data.closedAssignments && data.closedAssignments.length > 0) {
        generateReturnItemsCSV(data.closedAssignments, weekToClose);
      }
      
      await Promise.all([
        fetchStaffDetails(),
        fetchAllStockData()
      ]);

    } catch (error: any) {
      console.error("Error in handleCloseWeek:", error);
      handleError(error, 'Failed to close week');
    } finally {
      setLoadingCloseWeek(null);
    }
  };

  // Generate CSV for returned items
  const generateReturnItemsCSV = (returnedItems: any[], week: WeeklyPerformance) => {
    if (!staff || !returnedItems.length) return;
    
    const csvContent = [
      ['Staff Return Items Report'],
      ['Staff Name', staff.name],
      ['Staff Email', staff.email || ''],
      ['Staff Phone', staff.phone || ''],
      ['Week', `${formatDate(week.weekStart)} - ${formatDate(week.weekEnd)}`],
      ['Closed Date', new Date().toLocaleDateString('en-KE')],
      [],
      ['Product Name', 'Quantity Given', 'Quantity Sold', 'Quantity Returned', 'Return Date', 'Week Start', 'Week End']
    ];
    
    returnedItems.forEach((item: any) => {
      csvContent.push([
        item.productName || 'Unknown',
        (item.quantityGiven || 0).toString(),
        (item.quantitySold || 0).toString(),
        (item.quantityReturnedNow || item.quantityReturned || 0).toString(),
        new Date().toLocaleDateString('en-KE'),
        formatDate(week.weekStart),
        formatDate(week.weekEnd)
      ]);
    });
    
    const csvString = csvContent.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `returned-items-${staff.name.replace(/\s+/g, '-')}-${formatDate(week.weekStart).replace(/\s+/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Export weekly report
  const exportWeeklyReport = (week: WeeklyPerformance) => {
    if (!staff) return;
    
    const csvContent = [
      ['Staff Weekly Performance Report'],
      ['Staff Name', staff.name],
      ['Staff Email', staff.email || ''],
      ['Week', `${formatDate(week.weekStart)} - ${formatDate(week.weekEnd)}`],
      ['Status', week.status.charAt(0).toUpperCase() + week.status.slice(1)],
      [],
      ['Summary'],
      ['Total Assigned', week.totalGiven.toString()],
      ['Total Sold', week.totalSold.toString()],
      ['Total Returned', week.totalReturned.toString()],
      ['Remaining', week.remaining.toString()],
      ['Sell-through Rate', `${week.sellThroughRate.toFixed(1)}%`],
      ['Total Revenue', formatCurrency(week.totalRevenue)],
      [],
      ['Inventory Details (This Week Only)'],
      ['Product Name', 'Category', 'Assigned', 'Sold', 'Returned', 'Remaining', 'Sell-through %']
    ];
    
    const weekInventory = week.inventory.filter(inv => {
      const invWeekStart = inv.weekStartDate ? new Date(inv.weekStartDate) : null;
      const invWeekEnd = inv.weekEndDate ? new Date(inv.weekEndDate) : null;
      return invWeekStart && invWeekEnd && 
             invWeekStart.getTime() === week.weekStart.getTime() &&
             invWeekEnd.getTime() === week.weekEnd.getTime();
    });
    
    weekInventory.forEach((inventory) => {
      const quantityGiven = inventory.quantityGiven || 0;
      const quantitySold = inventory.quantitySold || 0;
      const quantityReturned = inventory.quantityReturned || 0;
      const sellThrough = quantityGiven > 0 ? (quantitySold / quantityGiven) * 100 : 0;
      
      csvContent.push([
        inventory.product?.name || 'Unknown',
        inventory.product?.category || 'N/A',
        quantityGiven.toString(),
        quantitySold.toString(),
        quantityReturned.toString(),
        (quantityGiven - quantitySold - quantityReturned).toString(),
        `${sellThrough.toFixed(1)}%`
      ]);
    });
    
    const csvString = csvContent.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-report-${staff.name.replace(/\s+/g, '-')}-${formatDate(week.weekStart).replace(/\s+/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

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
  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Not set';
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return 'Invalid date';
    return dateObj.toLocaleDateString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Format short date
  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-KE', {
      day: '2-digit',
      month: 'short'
    });
  };

  // Filter weekly performance
  const filteredWeeklyPerformance = weeklyPerformance.filter(week => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return week.week.toLowerCase().includes(query) ||
        week.inventory.some(inv => 
          inv.product?.name?.toLowerCase().includes(query) ||
          inv.product?.category?.toLowerCase().includes(query)
        );
    }
    
    if (filterStatus !== "all") {
      return week.status === filterStatus;
    }
    
    return true;
  });

  // Calculate total stats
  const calculateTotalStats = () => {
    return weeklyPerformance.reduce((acc, week) => ({
      totalGiven: acc.totalGiven + week.totalGiven,
      totalSold: acc.totalSold + week.totalSold,
      totalReturned: acc.totalReturned + week.totalReturned,
      totalRevenue: acc.totalRevenue + week.totalRevenue
    }), { totalGiven: 0, totalSold: 0, totalReturned: 0, totalRevenue: 0 });
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchStaffDetails(),
        fetchAllStockData()
      ]);
    };
    
    loadData();
  }, [fetchStaffDetails]);

  const totalStats = calculateTotalStats();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <div className="mt-4 text-black">Loading staff details...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-8 text-center shadow-sm">
            <User className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <div className="text-xl font-semibold text-black mb-2">Staff Not Found</div>
            <button
              onClick={() => router.push('/admin/staff')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Staff Management
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:p-4">
      <div className="max-w-6xl mx-auto">
        {/* Alerts */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2 shadow-sm animate-fadeIn">
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
          <div className="mb-4 bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-lg flex items-start gap-2 shadow-sm animate-fadeIn">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-auto">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/admin/staff"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Staff</span>
            </Link>
            
            <div className="flex items-center gap-2">
              <button
                onClick={fetchStaffDetails}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm shadow-sm"
              >
                <RefreshCw className="w-3 h-3" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              
              <Link
                href="/admin/inventory/assign"
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm shadow-sm"
              >
                <Plus className="w-3 h-3" />
                <span className="hidden sm:inline">Assign New</span>
              </Link>
            </div>
          </div>

          {/* Staff Info Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex items-center gap-3 sm:flex-col sm:items-start">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-md">
                  <User className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <div className="sm:hidden">
                  <div className="text-lg font-bold text-black">{staff.name}</div>
                  <div className="text-xs text-black">ID: {staff.id}</div>
                </div>
              </div>
              
              <div className="flex-1">
                <div className="hidden sm:block">
                  <div className="text-xl font-bold text-black mb-1">{staff.name}</div>
                  <div className="text-sm text-black mb-3">ID: {staff.id}</div>
                </div>
                
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 text-black text-sm">
                  {staff.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3 h-3 text-black" />
                      <div className="truncate">{staff.email}</div>
                    </div>
                  )}
                  {staff.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3 text-black" />
                      <div className="font-medium">{staff.phone}</div>
                    </div>
                  )}
                  <div className="col-span-2 flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-black" />
                    <div className="font-medium">Joined {formatDate(staff.createdAt)}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:flex sm:flex-col gap-2">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <div className="text-xs font-medium text-blue-800 mb-1">Active Weeks</div>
                  <div className="text-lg font-bold text-blue-600">{weeklyPerformance.filter(w => w.status === 'active').length}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                  <div className="text-xs font-medium text-emerald-800 mb-1">Total Sales</div>
                  <div className="text-lg font-bold text-emerald-600">KSh {totalStats.totalRevenue.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-black">Total Weeks</div>
                <div className="text-xl font-bold text-black mt-1">{weeklyPerformance.length}</div>
              </div>
              <CalendarDays className="w-6 h-6 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-black">Total Assigned</div>
                <div className="text-xl font-bold text-black mt-1">{totalStats.totalGiven}</div>
              </div>
              <Package className="w-6 h-6 text-emerald-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-black">Total Returned</div>
                <div className="text-xl font-bold text-black mt-1">{totalStats.totalReturned}</div>
              </div>
              <PackageX className="w-6 h-6 text-orange-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-black">Sell-through</div>
                <div className="text-xl font-bold text-black mt-1">
                  {weeklyPerformance.length > 0 
                    ? (weeklyPerformance.reduce((sum, week) => sum + week.sellThroughRate, 0) / weeklyPerformance.length).toFixed(0) 
                    : 0}%
                </div>
              </div>
              <Percent className="w-6 h-6 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Restock Modal */}
        {showRestockModal && restockProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold text-black">Restock Items</div>
                  <button
                    onClick={() => {
                      setShowRestockModal(false);
                      setRestockProduct(null);
                      setRestockQuantity('');
                    }}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 sm:p-6">
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="text-sm font-medium text-black mb-1">Product</div>
                    <div className="text-lg font-bold text-black">{restockProduct.name}</div>
                    <div className="text-xs text-black mt-1">Category: {restockProduct.category || 'N/A'}</div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Quantity to Restock
                    </label>
                    <input
                      type="number"
                      value={restockQuantity}
                      onChange={(e) => setRestockQuantity(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                      placeholder="Enter quantity"
                      min="1"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Items will be added to current assignment
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowRestockModal(false);
                    setRestockProduct(null);
                    setRestockQuantity('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-black rounded-lg hover:bg-gray-50 transition-colors text-sm"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcessRestock}
                  disabled={!restockQuantity || actionLoading}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  {actionLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2 inline-block"></div>
                      Restocking...
                    </>
                  ) : (
                    <>
                      <Package className="w-3 h-3 inline-block mr-1" />
                      Restock
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Weekly Performance Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-lg sm:text-xl font-semibold text-black">Assigned Inventory</div>
                <div className="text-xs sm:text-sm text-black">
                  {weeklyPerformance.length > 0 
                    ? `${weeklyPerformance.length} week(s) found • Tap any week for details`
                    : 'No inventory assigned yet'}
                </div>
              </div>
              
              {weeklyPerformance.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-2 ${viewMode === "grid" ? "bg-blue-50 text-blue-600" : "text-gray-600"}`}
                    >
                      <Grid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`p-2 ${viewMode === "list" ? "bg-blue-50 text-blue-600" : "text-gray-600"}`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search and Filter */}
          {weeklyPerformance.length > 0 && (
            <div className="px-4 sm:px-6 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search weeks, products, or categories..."
                      className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder-gray-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Weeks List/Grid */}
          {weeklyPerformance.length > 0 ? (
            filteredWeeklyPerformance.length > 0 ? (
              <div className="p-3 sm:p-4">
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredWeeklyPerformance.map((week, index) => (
                      <div 
                        key={index}
                        className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => {
                          setSelectedWeek(week);
                          setShowWeekDetails(true);
                        }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="font-semibold text-black">{week.week}</div>
                            <div className="text-xs text-black mt-1">
                              {formatDate(week.weekStart)} - {formatDate(week.weekEnd)}
                            </div>
                          </div>
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                            week.status === 'active' 
                              ? 'bg-emerald-100 text-emerald-800'
                              : week.status === 'completed'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {week.status.charAt(0).toUpperCase() + week.status.slice(1)}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-black">Assigned:</span>
                            <span className="font-semibold">{week.totalGiven}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-black">Sold:</span>
                            <span className="font-semibold text-emerald-600">{week.totalSold}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-black">Returned:</span>
                            <span className="font-semibold text-orange-600">{week.totalReturned}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-black">Remaining:</span>
                            <span className={`font-semibold ${week.remaining > 0 ? 'text-blue-600' : 'text-gray-600'}`}>
                              {week.remaining}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-black">Rate:</span>
                            <span className={`font-semibold ${
                              week.sellThroughRate >= 70 ? 'text-emerald-600' :
                              week.sellThroughRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {week.sellThroughRate.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex items-center justify-between text-xs text-black">
                            <span>Sales: {week.sales.length}</span>
                            <span>{formatCurrency(week.totalRevenue)}</span>
                          </div>
                        </div>

                        {/* Buttons - Always visible to everyone */}
                        <div className="mt-3 flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedWeek(week);
                                setShowWeekDetails(true);
                              }}
                              className="flex-1 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs font-medium flex items-center justify-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              Details
                            </button>
                            
                            {/* Close Week Button - Always Visible to Everyone */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (week.remaining <= 0) {
                                  setError("This week has no remaining items to close.");
                                  setTimeout(() => setError(null), 3000);
                                  return;
                                }
                                setWeekToClose(week);
                                setShowCloseWeekModal(true);
                              }}
                              className="flex-1 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-xs font-medium flex items-center justify-center gap-1"
                              title={week.remaining <= 0 ? "No items to return" : "Close Week"}
                            >
                              <Archive className="w-3 h-3" />
                              Close Week
                            </button>
                          </div>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              exportWeeklyReport(week);
                            }}
                            className="w-full py-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors text-xs font-medium flex items-center justify-center gap-1"
                          >
                            <FileSpreadsheet className="w-3 h-3" />
                            Export CSV
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredWeeklyPerformance.map((week, index) => (
                      <div 
                        key={index}
                        className="bg-white border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedWeek(week);
                          setShowWeekDetails(true);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-black truncate">{week.week}</div>
                              <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                week.status === 'active' 
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : week.status === 'completed'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {week.status.charAt(0).toUpperCase() + week.status.slice(1)}
                              </div>
                            </div>
                            <div className="text-xs text-black mt-1">
                              {formatDate(week.weekStart)} - {formatDate(week.weekEnd)}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 ml-3">
                            <div className="text-right">
                              <div className="font-semibold text-black">{week.totalSold}/{week.totalGiven}</div>
                              <div className={`text-xs ${
                                week.sellThroughRate >= 70 ? 'text-emerald-600' :
                                week.sellThroughRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {week.sellThroughRate.toFixed(0)}%
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedWeek(week);
                                  setShowWeekDetails(true);
                                }}
                                className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                title="View Details"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              {/* Close Week Button - Always Visible in List View */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (week.remaining <= 0) {
                                    setError("This week has no remaining items to close.");
                                    setTimeout(() => setError(null), 3000);
                                    return;
                                  }
                                  setWeekToClose(week);
                                  setShowCloseWeekModal(true);
                                }}
                                className="p-1.5 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors"
                                title={week.remaining <= 0 ? "No items to return" : "Close Week"}
                              >
                                <Archive className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="px-4 sm:px-6 py-8 text-center">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <div className="text-lg font-medium text-black mb-2">No Results Found</div>
                <div className="text-sm text-black max-w-md mx-auto mb-4">
                  No weeks match your search criteria. Try a different search term or filter.
                </div>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setFilterStatus("all");
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-black rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  Clear Filters
                </button>
              </div>
            )
          ) : (
            <div className="px-4 sm:px-6 py-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <div className="text-lg font-medium text-black mb-2">No Inventory Assigned</div>
              <div className="text-sm text-black max-w-md mx-auto mb-6">
                This staff member doesn't have any inventory assigned yet. Assign inventory to track their performance.
              </div>
              <Link
                href="/admin/inventory/assign"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Assign Inventory
              </Link>
            </div>
          )}
        </div>

        {/* Edit Assignment Modal */}
        {editingItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold text-black">Edit Assignment</div>
                    <div className="text-sm text-black">{editingItem.product?.name || 'Unknown Product'}</div>
                  </div>
                  <button
                    onClick={() => setEditingItem(null)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 sm:p-6">
                <div className="space-y-4">
                  {/* Staff and Product Info */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-medium text-black mb-1">Staff</div>
                        <div className="text-sm font-semibold text-black">{editingItem.staff?.name || 'Unknown Staff'}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-black mb-1">Product</div>
                        <div className="text-sm font-semibold text-black">{editingItem.product?.name || 'Unknown Product'}</div>
                        <div className="text-xs text-black">{editingItem.product?.category || 'N/A'}</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <div className="text-xs text-black">Current</div>
                        <div className="text-sm font-bold">{editingItem.quantityGiven || 0}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-black">Sold</div>
                        <div className="text-sm font-bold text-emerald-600">{editingItem.quantitySold || 0}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-black">Returned</div>
                        <div className="text-sm font-bold text-orange-600">{editingItem.quantityReturned || 0}</div>
                      </div>
                    </div>
                    
                    {/* Available Stock Info */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-black">Available in Stock:</div>
                        <div className={`text-sm font-bold ${availableStock > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {availableStock} items
                        </div>
                      </div>
                      {availableStock <= 0 && (
                        <div className="text-xs text-red-600 mt-1">
                          Warning: No stock available. Cannot add more items.
                        </div>
                      )}
                    </div>
                  </div>

                  {stockError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-red-700">{stockError}</div>
                      </div>
                    </div>
                  )}

                  {/* Quantity Fields */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Assigned Quantity
                      </label>
                      <input
                        type="number"
                        value={editForm.quantityGiven}
                        onChange={(e) => setEditForm({...editForm, quantityGiven: e.target.value})}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                        min="0"
                      />
                      <div className="text-xs text-black mt-1">
                        Max: {(editingItem.quantityGiven || 0) + availableStock}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Sold Quantity
                      </label>
                      <input
                        type="number"
                        value={editForm.quantitySold}
                        onChange={(e) => setEditForm({...editForm, quantitySold: e.target.value})}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                        min="0"
                        max={parseInt(editForm.quantityGiven)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Returned Quantity
                      </label>
                      <input
                        type="number"
                        value={editForm.quantityReturned}
                        onChange={(e) => setEditForm({...editForm, quantityReturned: e.target.value})}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                        min="0"
                        max={parseInt(editForm.quantityGiven) - parseInt(editForm.quantitySold)}
                      />
                    </div>
                  </div>

                  {/* Week Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Week Start Date
                      </label>
                      <input
                        type="date"
                        value={editForm.weekStartDate}
                        onChange={(e) => setEditForm({...editForm, weekStartDate: e.target.value})}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Week End Date
                      </label>
                      <input
                        type="date"
                        value={editForm.weekEndDate}
                        onChange={(e) => setEditForm({...editForm, weekEndDate: e.target.value})}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                      />
                    </div>
                  </div>

                  {/* Stock Impact Warning */}
                  {(parseInt(editForm.quantityGiven) > (editingItem.quantityGiven || 0) || 
                    parseInt(editForm.quantityReturned) > (editingItem.quantityReturned || 0)) && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-yellow-700">
                          Changing these quantities will update the main inventory stock levels.
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Quick Actions */}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="text-xs font-medium text-black mb-2">Quick Actions</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedInventory(editingItem);
                          setAdjustType('add');
                          setAdjustQuantity('');
                          setAdjustReason('');
                          setShowAdjustModal(true);
                          setEditingItem(null);
                        }}
                        disabled={availableStock <= 0}
                        className="flex-1 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-3 h-3" />
                        Add Items
                      </button>
                      <button
                        onClick={() => {
                          setSelectedInventory(editingItem);
                          setAdjustType('remove');
                          setAdjustQuantity('');
                          setAdjustReason('');
                          setShowAdjustModal(true);
                          setEditingItem(null);
                        }}
                        className="flex-1 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors text-xs font-medium flex items-center justify-center gap-1"
                      >
                        <Minus className="w-3 h-3" />
                        Remove Items
                      </button>
                      <button
                        onClick={() => handleRestockClick(editingItem)}
                        className="flex-1 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-xs font-medium flex items-center justify-center gap-1"
                      >
                        <Package className="w-3 h-3" />
                        Restock
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
                <button
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 border border-gray-300 text-black rounded-lg hover:bg-gray-50 transition-colors text-sm"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {actionLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2 inline-block"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-3 h-3 inline-block mr-1" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Week Details Modal */}
        {showWeekDetails && selectedWeek && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold text-black">Week Details</div>
                    <div className="text-sm text-black">
                      {formatDate(selectedWeek.weekStart)} - {formatDate(selectedWeek.weekEnd)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => exportWeeklyReport(selectedWeek)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-black rounded-lg hover:bg-gray-200 transition-colors text-sm"
                    >
                      <FileSpreadsheet className="w-3 h-3" />
                      Export CSV
                    </button>
                    <button
                      onClick={() => setShowWeekDetails(false)}
                      className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
                {/* Week Stats */}
                <div className="p-4 sm:p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                      <div className="text-xs font-medium text-blue-800">Assigned</div>
                      <div className="text-xl font-bold text-black mt-1">{selectedWeek.totalGiven}</div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <div className="text-xs font-medium text-emerald-800">Sold</div>
                      <div className="text-xl font-bold text-black mt-1">{selectedWeek.totalSold}</div>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                      <div className="text-xs font-medium text-orange-800">Returned</div>
                      <div className="text-xl font-bold text-black mt-1">{selectedWeek.totalReturned}</div>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                      <div className="text-xs font-medium text-purple-800">Rate</div>
                      <div className="text-xl font-bold text-black mt-1">{selectedWeek.sellThroughRate.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>

                {/* Search Bar for Assigned Items */}
                {getFilteredInventory().length > 0 && (
                  <div className="px-4 sm:px-6 pb-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="text"
                          value={searchProductQuery}
                          onChange={(e) => setSearchProductQuery(e.target.value)}
                          placeholder="Search assigned items by product name or category..."
                          className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder-gray-500"
                        />
                        {searchProductQuery && (
                          <button
                            onClick={() => setSearchProductQuery("")}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-black mt-2">
                        {getFilteredInventory().length} items assigned this week
                      </div>
                    </div>
                  </div>
                )}

                {/* Inventory Section */}
                <div className="px-4 sm:px-6 pb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-lg font-semibold text-black">Assigned Items (This Week)</div>
                    <div className="text-sm text-black">
                      {getFilteredInventory().length} products
                    </div>
                  </div>
                  
                  {getFilteredInventory().length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <div className="text-black font-medium">No items assigned for this week</div>
                      <div className="text-sm text-black mt-1">
                        All items have been processed or returned
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {getFilteredInventory().map((inventory) => {
                        const quantityGiven = inventory.quantityGiven || 0;
                        const quantitySold = inventory.quantitySold || 0;
                        const quantityReturned = inventory.quantityReturned || 0;
                        const remaining = quantityGiven - quantitySold - quantityReturned;
                        const sellThroughRate = quantityGiven > 0 
                          ? (quantitySold / quantityGiven) * 100 
                          : 0;
                        const stockAvailable = getAvailableStock(inventory.productId);
                        
                        return (
                          <div key={inventory.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:bg-gray-100 transition-colors">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="font-medium text-black text-sm">{inventory.product?.name || 'Unknown Product'}</div>
                                <div className="text-xs text-black mt-1">
                                  Category: {inventory.product?.category || 'N/A'} | 
                                  Price: {formatCurrency(inventory.product?.price || 0)}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 ml-2">
                                {remaining > 0 && selectedWeek.status === 'active' && (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedInventory(inventory);
                                        setReturnQuantity('');
                                        setReturnReason('');
                                        setShowReturnModal(true);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs hover:bg-orange-200 transition-colors"
                                      title="Return Items"
                                    >
                                      <PackageX className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedInventory(inventory);
                                        setAdjustType('add');
                                        setAdjustQuantity('');
                                        setAdjustReason('');
                                        setShowAdjustModal(true);
                                      }}
                                      disabled={stockAvailable <= 0}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs hover:bg-emerald-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Add Items"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedInventory(inventory);
                                        setAdjustType('remove');
                                        setAdjustQuantity('');
                                        setAdjustReason('');
                                        setShowAdjustModal(true);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs hover:bg-red-200 transition-colors"
                                      title="Remove Items"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRestockClick(inventory);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs hover:bg-blue-200 transition-colors"
                                      title="Restock Items"
                                    >
                                      <Package className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditClick(inventory);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs hover:bg-blue-200 transition-colors"
                                  title="Edit Assignment"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-5 gap-2">
                              <div className="text-center">
                                <div className="text-xs text-black">Assigned</div>
                                <div className="font-bold">{quantityGiven}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-black">Sold</div>
                                <div className="font-bold text-emerald-600">{quantitySold}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-black">Returned</div>
                                <div className="font-bold text-orange-600">{quantityReturned}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-black">Remaining</div>
                                <div className={`font-bold ${remaining > 0 ? 'text-blue-600' : 'text-gray-600'}`}>
                                  {remaining}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-black">Rate</div>
                                <div className={`font-bold ${
                                  sellThroughRate >= 70 ? 'text-emerald-600' :
                                  sellThroughRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {sellThroughRate.toFixed(0)}%
                                </div>
                              </div>
                            </div>
                            
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-black">
                                  Updated: {formatDate(inventory.updatedAt)}
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm("Delete this assignment and return items to stock?")) {
                                      handleDeleteAssignment(inventory.id);
                                    }
                                  }}
                                  className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Returned Items Summary */}
                {selectedWeek.totalReturned > 0 && (
                  <div className="px-4 sm:px-6 pb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-lg font-semibold text-black">Returned Items (This Week)</div>
                      <div className="text-sm text-black">
                        {selectedWeek.totalReturned} items returned
                      </div>
                    </div>
                    
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <div className="space-y-3">
                        {getFilteredInventory()
                          .filter(inv => (inv.quantityReturned || 0) > 0)
                          .map((inventory) => (
                            <div key={inventory.id} className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-black text-sm">{inventory.product?.name || 'Unknown Product'}</div>
                                <div className="text-xs text-black">{inventory.product?.category || 'N/A'}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-orange-600">{inventory.quantityReturned || 0} items</div>
                                <div className="text-xs text-black">
                                  Last update: {formatDate(inventory.updatedAt)}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sales Section */}
                {selectedWeek.sales.length > 0 && (
                  <div className="px-4 sm:px-6 pb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-lg font-semibold text-black">Sales (This Week)</div>
                      <div className="text-sm text-black">
                        {selectedWeek.sales.length} transactions
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {selectedWeek.sales.slice(0, 5).map((sale) => (
                        <div key={sale.id} className="bg-white border border-gray-200 rounded-xl p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-black text-sm">Sale #{sale.id}</div>
                              <div className="text-xs text-black mt-1">
                                {formatDate(sale.date)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-emerald-600 text-sm">
                                {formatCurrency(sale.amount || 0)}
                              </div>
                              <div className={`text-xs mt-1 px-2 py-0.5 rounded-full inline-block ${
                                sale.status === 'PAID' 
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {sale.status || 'UNKNOWN'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {selectedWeek.sales.length > 5 && (
                        <div className="text-center pt-2">
                          <div className="text-sm text-black">
                            +{selectedWeek.sales.length - 5} more sales
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Modal Footer - Always show Close button */}
              <div className="border-t border-gray-200 px-4 sm:px-6 py-4 bg-gray-50 flex justify-between gap-3">
                <button
                  onClick={() => {
                    if (selectedWeek.remaining <= 0) {
                      setError("This week has no remaining items to close.");
                      setTimeout(() => setError(null), 3000);
                      return;
                    }
                    setShowWeekDetails(false);
                    setWeekToClose(selectedWeek);
                    setShowCloseWeekModal(true);
                  }}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium flex items-center gap-1"
                  title={selectedWeek.remaining <= 0 ? "No items to return" : "Close Week"}
                >
                  <Archive className="w-3 h-3" />
                  Close Week
                </button>
                <button
                  onClick={() => setShowWeekDetails(false)}
                  className="px-4 py-2 bg-gray-200 text-black rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Return Modal */}
        {showReturnModal && selectedInventory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold text-black">Return Items</div>
                  <button
                    onClick={() => {
                      setShowReturnModal(false);
                      setSelectedInventory(null);
                      setReturnQuantity('');
                      setReturnReason('');
                    }}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 sm:p-6">
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="text-sm font-medium text-black mb-1">Product</div>
                    <div className="text-lg font-bold text-black">{selectedInventory.product?.name || 'Unknown Product'}</div>
                    
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="text-center">
                        <div className="text-xs text-black">Assigned</div>
                        <div className="text-lg font-bold">{selectedInventory.quantityGiven || 0}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-black">Sold</div>
                        <div className="text-lg font-bold text-emerald-600">{selectedInventory.quantitySold || 0}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-black">Returned</div>
                        <div className="text-lg font-bold text-orange-600">{selectedInventory.quantityReturned || 0}</div>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-black">Remaining:</div>
                        <div className="text-lg font-bold text-blue-600">
                          {(selectedInventory.quantityGiven || 0) - (selectedInventory.quantitySold || 0) - (selectedInventory.quantityReturned || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Quantity to Return
                    </label>
                    <input
                      type="number"
                      value={returnQuantity}
                      onChange={(e) => setReturnQuantity(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                      placeholder="Enter quantity"
                      min="1"
                      max={(selectedInventory.quantityGiven || 0) - (selectedInventory.quantitySold || 0) - (selectedInventory.quantityReturned || 0)}
                    />
                    <div className="text-xs text-black mt-1">
                      Max: {(selectedInventory.quantityGiven || 0) - (selectedInventory.quantitySold || 0) - (selectedInventory.quantityReturned || 0)} items
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Reason for Return
                    </label>
                    <select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                    >
                      <option value="">Select reason</option>
                      <option value="Defective">Defective</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Expired">Expired</option>
                      <option value="Wrong Item">Wrong Item</option>
                      <option value="Customer Return">Customer Return</option>
                      <option value="Week Closure">Week Closure</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowReturnModal(false);
                    setSelectedInventory(null);
                    setReturnQuantity('');
                    setReturnReason('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-black rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReturnItems}
                  disabled={!returnQuantity}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  Process Return
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Remove Modal */}
        {showAdjustModal && selectedInventory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold text-black">
                    {adjustType === 'add' ? 'Add Items' : 'Remove Items'}
                  </div>
                  <button
                    onClick={() => {
                      setShowAdjustModal(false);
                      setSelectedInventory(null);
                      setAdjustQuantity('');
                      setAdjustReason('');
                    }}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 sm:p-6">
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="text-sm font-medium text-black mb-1">Product</div>
                    <div className="text-lg font-bold text-black">{selectedInventory.product?.name || 'Unknown Product'}</div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="text-center">
                        <div className="text-xs text-black">Current</div>
                        <div className="text-lg font-bold">{selectedInventory.quantityGiven || 0}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-black">Remaining</div>
                        <div className="text-lg font-bold text-blue-600">
                          {(selectedInventory.quantityGiven || 0) - (selectedInventory.quantitySold || 0) - (selectedInventory.quantityReturned || 0)}
                        </div>
                      </div>
                    </div>
                    
                    {adjustType === 'add' && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-black">Available in Stock:</div>
                          <div className={`text-sm font-bold ${availableStock > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {availableStock} items
                          </div>
                        </div>
                        {availableStock <= 0 && (
                          <div className="text-xs text-red-600 mt-1">
                            No stock available. Cannot add items.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Quantity to {adjustType === 'add' ? 'Add' : 'Remove'}
                    </label>
                    <input
                      type="number"
                      value={adjustQuantity}
                      onChange={(e) => setAdjustQuantity(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                      placeholder={`Enter quantity to ${adjustType}`}
                      min="1"
                      max={adjustType === 'add' ? availableStock : ((selectedInventory.quantityGiven || 0) - (selectedInventory.quantitySold || 0) - (selectedInventory.quantityReturned || 0))}
                    />
                    <div className="text-xs text-black mt-1">
                      {adjustType === 'add' 
                        ? `Max: ${availableStock} items available in stock`
                        : `Max: ${(selectedInventory.quantityGiven || 0) - (selectedInventory.quantitySold || 0) - (selectedInventory.quantityReturned || 0)} items remaining`
                      }
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Reason (Optional)
                    </label>
                    <input
                      type="text"
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                      placeholder={`Reason for ${adjustType}ing items`}
                    />
                  </div>
                </div>
              </div>
              
              <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAdjustModal(false);
                    setSelectedInventory(null);
                    setAdjustQuantity('');
                    setAdjustReason('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-black rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustItems}
                  disabled={!adjustQuantity}
                  className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 ${
                    adjustType === 'add' 
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                      : 'bg-orange-500 text-white hover:bg-orange-600'
                  }`}
                >
                  {adjustType === 'add' ? 'Add Items' : 'Remove Items'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Close Week Modal */}
        {showCloseWeekModal && weekToClose && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold text-black">
                    {weekToClose.status === 'active' ? 'Close Week' : 'Close Overdue Week'}
                  </div>
                  <button
                    onClick={() => {
                      setShowCloseWeekModal(false);
                      setWeekToClose(null);
                    }}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 sm:p-6">
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-yellow-800">Important Notice</div>
                        <div className="text-xs text-yellow-700 mt-1">
                          Closing a week will mark all remaining inventory as returned. This action cannot be undone.
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="text-sm font-medium text-black mb-2">Week Details</div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-black">Week:</span>
                        <span className="font-medium">{weekToClose.week}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-black">Period:</span>
                        <span className="font-medium">{formatDate(weekToClose.weekStart)} - {formatDate(weekToClose.weekEnd)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-black">Status:</span>
                        <span className={`font-medium ${weekToClose.status === 'active' ? 'text-blue-600' : 'text-red-600'}`}>
                          {weekToClose.status === 'active' ? 'Active' : 'Overdue'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-black">Remaining Items:</span>
                        <span className="font-medium text-blue-600">{weekToClose.remaining}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-black">Items to be Returned:</span>
                        <span className="font-medium text-orange-600">{weekToClose.remaining}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-black">
                    <p>A CSV file will be automatically downloaded with details of all returned items.</p>
                  </div>
                </div>
              </div>
              
              <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCloseWeekModal(false);
                    setWeekToClose(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-black rounded-lg hover:bg-gray-50 transition-colors text-sm"
                  disabled={loadingCloseWeek !== null}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCloseWeek}
                  disabled={loadingCloseWeek !== null}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {loadingCloseWeek ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2 inline-block"></div>
                      Closing...
                    </>
                  ) : (
                    <>
                      <Archive className="w-3 h-3 inline-block mr-1" />
                      {weekToClose.status === 'active' ? 'Close Week' : 'Close Overdue Week'} & Download CSV
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="text-xs text-black mb-2">
            Staff Details • {staff.name} • Inventory Management System
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 text-black hover:text-gray-900 text-xs"
            >
              <Printer className="w-3 h-3" />
              Print Report
            </button>
            {weeklyPerformance.length > 0 && (
              <button
                onClick={() => {
                  const csvContent = `Staff,${staff.name}\nEmail,${staff.email || ''}\nPhone,${staff.phone || ''}\n\nWeek,Start Date,End Date,Status,Assigned,Sold,Returned,Remaining,Rate%,Revenue\n${weeklyPerformance.map(w => `${w.week},${formatDate(w.weekStart)},${formatDate(w.weekEnd)},${w.status},${w.totalGiven},${w.totalSold},${w.totalReturned},${w.remaining},${w.sellThroughRate.toFixed(1)}%,${formatCurrency(w.totalRevenue)}`).join('\n')}`;
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `staff-${staff.name.replace(/\s+/g, '-')}-complete-report.csv`;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                }}
                className="inline-flex items-center gap-1 text-black hover:text-gray-900 text-xs"
              >
                <FileSpreadsheet className="w-3 h-3" />
                Export Complete Report
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDetailsPage;