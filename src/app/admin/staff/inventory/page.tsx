"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Search,
  Plus,
  Package,
  User,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  X,
  Filter,
  Download,
  CheckSquare,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Menu,
  ShoppingBag,
  AlertTriangle,
  ShoppingCart,
  Users,
  ClipboardList,
  Trash2,
  Edit,
  Eye,
  Clock,
  Layers,
  BarChart3,
  Check,
  XCircle,
  MoreVertical,
  Hash,
  CreditCard,
  Truck,
  Warehouse,
  Store,
  Percent,
  Target,
  AlertOctagon,
  CheckCheck,
  RotateCcw,
  ShieldCheck,
  ExternalLink,
  Grid,
  List,
  SortAsc,
  SortDesc,
  FilterX,
  Zap,
  Battery,
  BatteryCharging,
  BatteryFull,
  Thermometer,
  Wifi,
  Bluetooth,
  Cpu,
  HardDrive,
  MemoryStick,
  Phone as PhoneIcon,
  Laptop,
  Headphones,
  Speaker,
  Keyboard,
  Mouse,
  Monitor as MonitorIcon,
  Printer,
  Scan,
  Server,
  Router,
  Camera,
  Video,
  Mic,
  Gamepad,
  Watch,
  Tablet as TabletIcon,
  Book,
  BookOpen,
  BookMarked,
  BookCopy,
  BookCheck,
  BookX,
  BookPlus,
  BookMinus,
  BookOpenCheck,
  BookKey,
  BookLock,
  BookUp,
  BookDown,
  BookHeart,
  TrendingUp
} from "lucide-react";
import Link from "next/link";

// Define interfaces
interface Stock {
  id: number;
  name: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  supplier?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  productId: number;
}

interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  category?: string;
  productionCost?: number;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  image?: string | null;
  inStock: boolean;
  stock: Stock[];
  stockQuantity: number;
  avgCostPrice: number;
  sku?: string;
  brand?: string;
  model?: string;
  color?: string;
  weight?: number;
  dimensions?: string;
}

interface Staff {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  department?: string;
  avatar?: string;
}

// UPDATED: Added weekly fields to StaffInventory
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
  createdAt: string;
  updatedAt: string;
  status: 'ACTIVE' | 'COMPLETED' | 'OVERDUE' | 'PENDING';
  totalSalesAmount: number;
  notes?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  // Weekly specific fields
  weekIdentifier?: string;
  isCurrentWeek?: boolean;
  remainingQuantity?: number;
  sellThroughRate?: number;
}

interface AssignmentItem {
  productId: string;
  quantity: string;
  product?: Product;
}

// UPDATED: Added weekly date fields to AssignmentForm
interface AssignmentForm {
  staffId: string;
  items: AssignmentItem[];
  weekStartDate: string;
  weekEndDate: string;
  notes?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

// FIXED: Updated to accept string | null
interface ReturnForm {
  items: {
    assignmentId: number;
    quantityReturned: string;
    productName: string;
    productId: number;
    maxReturnable: number;
    weekStartDate?: string | null;
    weekEndDate?: string | null;
  }[];
  notes?: string;
}

interface AssignmentStats {
  totalAssignments: number;
  totalItemsGiven: number;
  totalItemsSold: number;
  totalItemsReturned: number;
  totalItemsRemaining: number;
  totalSalesValue: number;
  activeAssignments: number;
  completedAssignments: number;
  overdueAssignments: number;
  pendingAssignments: number;
  staffWithInventory: number;
  totalProductsAssigned: number;
  averageCompletionRate: number;
  totalCostValue: number;
  totalProfit: number;
  // Weekly stats
  currentWeekAssignments: number;
  currentWeekSales: number;
  currentWeekReturns: number;
  weeklyPerformance: Array<{
    weekStart: string;
    weekEnd: string;
    totalGiven: number;
    totalSold: number;
    totalReturned: number;
    sellThroughRate: number;
  }>;
}

interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: Product) => void;
  products: Product[];
  excludedIds?: number[];
}

// Helper: Get current week dates (Monday to Sunday)
const getCurrentWeekDates = () => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { 
    weekStartDate: monday.toISOString().split('T')[0], 
    weekEndDate: sunday.toISOString().split('T')[0] 
  };
};

// Helper: Format week range for display
const formatWeekRange = (startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  const isCurrent = now >= start && now <= end;
  
  let prefix = '';
  if (isCurrent) prefix = '📅 Current: ';
  
  return `${prefix}${start.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}`;
};

// Helper: Check if date is in current week
const isCurrentWeek = (startDate: string | null, endDate: string | null) => {
  if (!startDate || !endDate) return false;
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  return now >= start && now <= end;
};

// Helper: Calculate remaining days in week
const getDaysRemainingInWeek = (endDate: string) => {
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Enhanced Product Search Modal Component
const ProductSearchModal: React.FC<ProductSearchModalProps> = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  products,
  excludedIds = []
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'category'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean) as string[]);
    return Array.from(cats);
  }, [products]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    let result = products.filter(product => 
      !excludedIds.includes(product.id)
    );

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(product =>
        product.name.toLowerCase().includes(term) ||
        product.description?.toLowerCase().includes(term) ||
        product.sku?.toLowerCase().includes(term) ||
        product.category?.toLowerCase().includes(term) ||
        product.brand?.toLowerCase().includes(term) ||
        product.model?.toLowerCase().includes(term)
      );
    }

    // Apply category filter
    if (selectedCategory !== "all") {
      result = result.filter(product => product.category === selectedCategory);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch(sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'price':
          aVal = a.price;
          bVal = b.price;
          break;
        case 'stock':
          aVal = a.stockQuantity || 0;
          bVal = b.stockQuantity || 0;
          break;
        case 'category':
          aVal = a.category?.toLowerCase() || '';
          bVal = b.category?.toLowerCase() || '';
          break;
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredProducts(result);
  }, [searchTerm, selectedCategory, sortBy, sortOrder, products, excludedIds]);

  const getProductIcon = (category?: string) => {
    if (!category) return <Package className="w-4 h-4" />;
    
    const cat = category.toLowerCase();
    if (cat.includes('phone') || cat.includes('mobile')) return <PhoneIcon className="w-4 h-4" />;
    if (cat.includes('laptop') || cat.includes('computer')) return <Laptop className="w-4 h-4" />;
    if (cat.includes('tablet')) return <TabletIcon className="w-4 h-4" />;
    if (cat.includes('monitor') || cat.includes('screen')) return <MonitorIcon className="w-4 h-4" />;
    if (cat.includes('headphone') || cat.includes('earphone')) return <Headphones className="w-4 h-4" />;
    if (cat.includes('speaker')) return <Speaker className="w-4 h-4" />;
    if (cat.includes('keyboard')) return <Keyboard className="w-4 h-4" />;
    if (cat.includes('mouse')) return <Mouse className="w-4 h-4" />;
    if (cat.includes('printer')) return <Printer className="w-4 h-4" />;
    if (cat.includes('camera')) return <Camera className="w-4 h-4" />;
    if (cat.includes('book')) return <Book className="w-4 h-4" />;
    return <Package className="w-4 h-4" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-2 md:p-4 z-[100]">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 md:p-5 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Search className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Search Products</h2>
                <p className="text-blue-100 text-sm">Select products to assign for the week</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by name, SKU, category, brand, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-base placeholder-slate-500"
              autoFocus
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-sm"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {sortBy === 'name' && <SortAsc className="w-4 h-4 text-slate-500" />}
              {sortBy === 'price' && <DollarSign className="w-4 h-4 text-slate-500" />}
              {sortBy === 'stock' && <Package className="w-4 h-4 text-slate-500" />}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-sm"
              >
                <option value="name">Sort by Name</option>
                <option value="price">Sort by Price</option>
                <option value="stock">Sort by Stock</option>
                <option value="category">Sort by Category</option>
              </select>
            </div>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              {sortOrder === 'asc' ? (
                <SortAsc className="w-4 h-4 text-slate-600" />
              ) : (
                <SortDesc className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {(searchTerm || selectedCategory !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("all");
                }}
                className="flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 text-sm"
              >
                <FilterX className="w-4 h-4" />
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No products found</h3>
              <p className="text-slate-500 mb-4">Try a different search term or category</p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  onClick={() => {
                    onSelect(product);
                    onClose();
                  }}
                  className="group cursor-pointer border-2 border-slate-200 rounded-xl p-4 hover:border-blue-500 hover:shadow-lg transition-all duration-200 bg-white hover:bg-blue-50/50"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                        {getProductIcon(product.category)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 text-sm truncate group-hover:text-blue-700">
                        {product.name}
                      </h4>
                      {product.category && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600 mt-1">
                          {product.category}
                        </div>
                      )}
                      {product.sku && (
                        <div className="text-xs text-slate-500 font-mono mt-1">
                          SKU: {product.sku}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 text-sm">Price:</span>
                      <span className="font-bold text-green-600">
                        KES {product.price.toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 text-sm">Stock:</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${product.stockQuantity > 10 ? 'text-green-600' : product.stockQuantity > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                          {product.stockQuantity || 0}
                        </span>
                        <div className={`w-2 h-2 rounded-full ${product.stockQuantity > 10 ? 'bg-green-500' : product.stockQuantity > 0 ? 'bg-orange-500' : 'bg-red-500'}`}></div>
                      </div>
                    </div>

                    {product.brand && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 text-sm">Brand:</span>
                        <span className="font-medium text-slate-700">{product.brand}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <button className="w-full py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center gap-2 text-sm">
                      <Plus className="w-4 h-4" />
                      Add to Weekly Assignment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4 bg-slate-50 rounded-b-2xl">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <div>
              Showing <span className="font-bold">{filteredProducts.length}</span> of{" "}
              <span className="font-bold">{products.length}</span> products
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced Product Search Input Component
const ProductSearchInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onSearchClick: () => void;
  placeholder?: string;
  disabled?: boolean;
  showAvailableStock?: boolean;
  availableStock?: number;
}> = ({ 
  value, 
  onChange, 
  onSearchClick, 
  placeholder = "Select product...", 
  disabled = false,
  showAvailableStock = false,
  availableStock = 0
}) => {
  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full pl-10 pr-3 py-2.5 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm bg-white disabled:bg-slate-50 disabled:cursor-not-allowed"
          />
        </div>
        <button
          type="button"
          onClick={onSearchClick}
          disabled={disabled}
          className="px-3 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Search className="w-4 h-4" />
          <span className="hidden sm:inline">Browse</span>
        </button>
      </div>
      
      {showAvailableStock && availableStock > 0 && (
        <div className="mt-1 flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-3 h-3" />
            <span>Available: {availableStock}</span>
          </div>
          <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div 
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${Math.min((availableStock / 50) * 100, 100)}%` }}
            ></div>
          </div>
        </div>
      )}
      
      {showAvailableStock && availableStock === 0 && (
        <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="w-3 h-3" />
          <span>Out of stock</span>
        </div>
      )}
    </div>
  );
};

// Enhanced Product Selection Card
const ProductSelectionCard: React.FC<{
  product: Product;
  onRemove?: () => void;
  quantity?: number;
  onQuantityChange?: (quantity: number) => void;
  availableStock: number;
}> = ({ product, onRemove, quantity = 1, onQuantityChange, availableStock }) => {
  const handleQuantityChange = (newQty: number) => {
    if (newQty < 1) return;
    if (newQty > availableStock) return;
    onQuantityChange?.(newQty);
  };

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-gradient-to-br from-white to-slate-50/50 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0">
            <Package className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-slate-900 text-sm truncate">{product.name}</h4>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {product.category && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600">
                  {product.category}
                </span>
              )}
              {product.sku && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 rounded text-xs text-blue-700 font-mono">
                  <Hash className="w-3 h-3" />
                  {product.sku}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-slate-600 mb-1">Price</div>
          <div className="text-lg font-bold text-green-600">
            KES {product.price.toLocaleString()}
          </div>
        </div>
        
        <div>
          <div className="text-sm text-slate-600 mb-1">Quantity</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleQuantityChange(quantity - 1)}
              disabled={quantity <= 1}
              className="w-8 h-8 flex items-center justify-center border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-lg">-</span>
            </button>
            <input
              type="number"
              min="1"
              max={availableStock}
              value={quantity}
              onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
              className="w-16 text-center py-1 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
            />
            <button
              onClick={() => handleQuantityChange(quantity + 1)}
              disabled={quantity >= availableStock}
              className="w-8 h-8 flex items-center justify-center border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-lg">+</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Total:</span>
          <span className="font-bold text-slate-900">
            KES {(product.price * quantity).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs mt-1">
          <span className="text-slate-500">Available stock:</span>
          <span className={`font-medium ${availableStock > 10 ? 'text-green-600' : 'text-orange-600'}`}>
            {availableStock} units
          </span>
        </div>
      </div>
    </div>
  );
};

// NEW: Week View Component
const WeekViewComponent: React.FC<{
  weekStart: string;
  weekEnd: string;
  assignments: StaffInventory[];
  onCloseWeek?: (staffId?: number) => void;
}> = ({ weekStart, weekEnd, assignments, onCloseWeek }) => {
  if (!weekStart || !weekEnd) return null;
  
  const formattedWeek = formatWeekRange(weekStart, weekEnd);
  const now = new Date();
  const endDate = new Date(weekEnd);
  const isCurrentWeek = now >= new Date(weekStart) && now <= endDate;
  const isPastWeek = now > endDate;
  
  const totalGiven = assignments.reduce((sum, a) => sum + a.quantityGiven, 0);
  const totalSold = assignments.reduce((sum, a) => sum + a.quantitySold, 0);
  const totalReturned = assignments.reduce((sum, a) => sum + a.quantityReturned, 0);
  const remaining = totalGiven - totalSold - totalReturned;
  const sellThroughRate = totalGiven > 0 ? (totalSold / totalGiven) * 100 : 0;
  
  return (
    <div className={`border rounded-xl p-4 mb-4 ${isCurrentWeek ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-900">{formattedWeek}</h3>
          <p className="text-sm text-slate-600">
            {isCurrentWeek ? 'Current Week' : isPastWeek ? 'Past Week' : 'Upcoming Week'}
          </p>
        </div>
        {isCurrentWeek && remaining > 0 && onCloseWeek && (
          <button
            onClick={() => onCloseWeek()}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all text-sm font-medium"
          >
            Close Week
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-sm text-slate-600">Assigned</div>
          <div className="text-xl font-bold text-slate-900">{totalGiven}</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-slate-600">Sold</div>
          <div className="text-xl font-bold text-green-600">{totalSold}</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-slate-600">Returned</div>
          <div className="text-xl font-bold text-orange-600">{totalReturned}</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-slate-600">Rate</div>
          <div className={`text-xl font-bold ${sellThroughRate >= 70 ? 'text-green-600' : sellThroughRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
            {sellThroughRate.toFixed(1)}%
          </div>
        </div>
      </div>
      
      <div className="text-sm text-slate-600">
        <span className="font-medium">{assignments.length}</span> assignments • 
        <span className={`ml-2 font-medium ${remaining > 0 ? 'text-blue-600' : 'text-slate-600'}`}>
          {remaining} items remaining
        </span>
      </div>
    </div>
  );
};

// Main Enhanced Component
export default function StaffInventoryManagementPage() {
  // States
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryAssignments, setInventoryAssignments] = useState<StaffInventory[]>([]);
  const [filteredAssignments, setFilteredAssignments] = useState<StaffInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  
  // UPDATED: Using weekly dates
  const currentWeek = getCurrentWeekDates();
  const [form, setForm] = useState<AssignmentForm>({
    staffId: "",
    items: [],
    weekStartDate: currentWeek.weekStartDate,
    weekEndDate: currentWeek.weekEndDate,
    notes: "",
    priority: 'MEDIUM'
  });
  
  const [returnForm, setReturnForm] = useState<ReturnForm>({
    items: [],
    notes: ""
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'completed' | 'overdue' | 'pending'>('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'staff' | 'week' | 'totalValue' | 'priority'>('week');
  const [viewMode, setViewMode] = useState<'list' | 'cards' | 'grid' | 'weeks'>('weeks');
  const [selectedAssignment, setSelectedAssignment] = useState<StaffInventory | null>(null);
  const [quickActions, setQuickActions] = useState<number[]>([]);
  const [bulkSelect, setBulkSelect] = useState<number[]>([]);
  const [statsTimeRange, setStatsTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('week');

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [staffRes, productsRes, inventoryRes] = await Promise.allSettled([
        fetch("/api/staff"),
        fetch("/api/products"),
        fetch("/api/staff-inventory")
      ]);

      let staffData: Staff[] = [];
      let productsData: Product[] = [];
      let inventoryData: StaffInventory[] = [];

      if (staffRes.status === 'fulfilled' && staffRes.value.ok) {
        staffData = await staffRes.value.json();
      }

      if (productsRes.status === 'fulfilled' && productsRes.value.ok) {
        const data = await productsRes.value.json();
        productsData = Array.isArray(data) ? data : [];
      }

      if (inventoryRes.status === 'fulfilled' && inventoryRes.value.ok) {
        const rawData = await inventoryRes.value.json();
        
        inventoryData = rawData.map((assignment: any) => {
          const remaining = (assignment.quantityGiven || 0) - 
                          (assignment.quantitySold || 0) - 
                          (assignment.quantityReturned || 0);
          const sellThroughRate = assignment.quantityGiven > 0 
            ? ((assignment.quantitySold || 0) / assignment.quantityGiven) * 100 
            : 0;
          
          return {
            ...assignment,
            status: calculateAssignmentStatus(assignment),
            totalSalesAmount: (assignment.quantitySold || 0) * (assignment.product?.price || 0),
            priority: assignment.priority || 'MEDIUM',
            isCurrentWeek: isCurrentWeek(assignment.weekStartDate, assignment.weekEndDate),
            remainingQuantity: remaining,
            sellThroughRate: sellThroughRate
          };
        });
      }

      setStaffList(staffData);
      setProducts(productsData);
      setInventoryAssignments(inventoryData);
      setFilteredAssignments(inventoryData);

    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Helper to calculate assignment status based on weekly system
  const calculateAssignmentStatus = (assignment: any): StaffInventory['status'] => {
    const remaining = (assignment.quantityGiven || 0) - 
                     (assignment.quantitySold || 0) - 
                     (assignment.quantityReturned || 0);
    
    if (remaining === 0) return 'COMPLETED';
    
    const now = new Date();
    const weekEnd = assignment.weekEndDate ? new Date(assignment.weekEndDate) : null;
    
    // Check if week is over
    if (weekEnd && now > weekEnd) {
      // Week is over but items remain - this should be rare (means week wasn't closed properly)
      return 'OVERDUE';
    }
    
    if (assignment.quantitySold === 0) return 'PENDING';
    return 'ACTIVE';
  };

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter and sort assignments
  useEffect(() => {
    let filtered = [...inventoryAssignments];

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(assignment =>
        assignment.staff?.name?.toLowerCase().includes(term) ||
        assignment.product?.name?.toLowerCase().includes(term) ||
        assignment.product?.sku?.toLowerCase().includes(term) ||
        (assignment.product?.category?.toLowerCase() || '').includes(term) ||
        (assignment.staff?.phone || '').includes(term)
      );
    }

    // Apply status filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(assignment => 
        assignment.status === activeFilter.toUpperCase()
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch(sortBy) {
        case 'staff':
          aVal = a.staff?.name?.toLowerCase() || '';
          bVal = b.staff?.name?.toLowerCase() || '';
          break;
        case 'week':
          const aWeekStart = a.weekStartDate || '';
          const bWeekStart = b.weekStartDate || '';
          aVal = new Date(aWeekStart).getTime();
          bVal = new Date(bWeekStart).getTime();
          break;
        case 'totalValue':
          aVal = a.totalSalesAmount || 0;
          bVal = b.totalSalesAmount || 0;
          break;
        case 'priority':
          const priorityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          aVal = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
          bVal = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
          break;
        default:
          const aDate = a.weekStartDate || '';
          const bDate = b.weekStartDate || '';
          aVal = new Date(aDate).getTime();
          bVal = new Date(bDate).getTime();
      }

      return bVal - aVal; // Newest first
    });

    setFilteredAssignments(filtered);
  }, [searchTerm, activeFilter, inventoryAssignments, sortBy]);

  // Calculate comprehensive stats with weekly data
  const calculateStats = (): AssignmentStats => {
    const assignments = inventoryAssignments;
    const totalItemsGiven = assignments.reduce((sum, inv) => sum + (inv.quantityGiven || 0), 0);
    const totalItemsSold = assignments.reduce((sum, inv) => sum + (inv.quantitySold || 0), 0);
    const totalItemsReturned = assignments.reduce((sum, inv) => sum + (inv.quantityReturned || 0), 0);
    const totalItemsRemaining = totalItemsGiven - totalItemsSold - totalItemsReturned;
    const totalSalesValue = assignments.reduce((sum, inv) => sum + (inv.totalSalesAmount || 0), 0);
    const totalCostValue = assignments.reduce((sum, inv) => sum + ((inv.product?.avgCostPrice || 0) * inv.quantitySold), 0);
    
    const activeAssignments = assignments.filter(inv => inv.status === 'ACTIVE');
    const completedAssignments = assignments.filter(inv => inv.status === 'COMPLETED');
    const overdueAssignments = assignments.filter(inv => inv.status === 'OVERDUE');
    const pendingAssignments = assignments.filter(inv => inv.status === 'PENDING');
    
    // Count current week assignments
    const currentWeekAssignments = assignments.filter(inv => inv.isCurrentWeek).length;
    const currentWeekSales = assignments
      .filter(inv => inv.isCurrentWeek)
      .reduce((sum, inv) => sum + inv.quantitySold, 0);
    const currentWeekReturns = assignments
      .filter(inv => inv.isCurrentWeek)
      .reduce((sum, inv) => sum + inv.quantityReturned, 0);
    
    // Count unique staff and products
    const staffIds = new Set(assignments.map(inv => inv.staffId));
    const productIds = new Set(assignments.map(inv => inv.productId));

    // Calculate average completion rate
    const completionRates = assignments
      .filter(inv => inv.quantityGiven > 0)
      .map(inv => ((inv.quantitySold + inv.quantityReturned) / inv.quantityGiven) * 100);
    const averageCompletionRate = completionRates.length > 0 
      ? completionRates.reduce((sum, rate) => sum + rate, 0) / completionRates.length 
      : 0;

    // Group by week for weekly performance
    const weeklyMap = new Map<string, { weekStart: string; weekEnd: string; totalGiven: number; totalSold: number; totalReturned: number; }>();
    
    assignments.forEach(assignment => {
      if (!assignment.weekStartDate || !assignment.weekEndDate) return;
      
      const weekKey = `${assignment.weekStartDate}_${assignment.weekEndDate}`;
      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, {
          weekStart: assignment.weekStartDate,
          weekEnd: assignment.weekEndDate,
          totalGiven: 0,
          totalSold: 0,
          totalReturned: 0
        });
      }
      
      const weekData = weeklyMap.get(weekKey)!;
      weekData.totalGiven += assignment.quantityGiven;
      weekData.totalSold += assignment.quantitySold;
      weekData.totalReturned += assignment.quantityReturned;
    });
    
    const weeklyPerformance = Array.from(weeklyMap.values())
      .map(week => ({
        ...week,
        sellThroughRate: week.totalGiven > 0 ? (week.totalSold / week.totalGiven) * 100 : 0
      }))
      .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());

    return { 
      totalAssignments: assignments.length,
      totalItemsGiven, 
      totalItemsSold, 
      totalItemsReturned, 
      totalItemsRemaining,
      totalSalesValue,
      totalCostValue,
      totalProfit: totalSalesValue - totalCostValue,
      activeAssignments: activeAssignments.length,
      completedAssignments: completedAssignments.length,
      overdueAssignments: overdueAssignments.length,
      pendingAssignments: pendingAssignments.length,
      staffWithInventory: staffIds.size,
      totalProductsAssigned: productIds.size,
      averageCompletionRate,
      currentWeekAssignments,
      currentWeekSales,
      currentWeekReturns,
      weeklyPerformance
    };
  };

  // Get available stock for a product
  const getAvailableStock = (productId: number): number => {
    const product = products.find(p => p.id === productId);
    return product?.stockQuantity || 0;
  };

  // Get remaining stock after considering current weekly assignments
  const getRemainingStockAfterAssignments = (productId: number, weekStartDate?: string): number => {
    const now = new Date();
    const targetWeekStart = weekStartDate || form.weekStartDate;
    
    const totalAssigned = inventoryAssignments
      .filter(inv => {
        if (inv.productId !== productId) return false;
        if (inv.status === 'COMPLETED') return false;
        
        // If we have a target week, only count assignments for that week
        if (targetWeekStart && inv.weekStartDate) {
          return inv.weekStartDate === targetWeekStart;
        }
        
        // Otherwise count all active assignments (including current week)
        const weekEnd = inv.weekEndDate ? new Date(inv.weekEndDate) : null;
        return weekEnd && now <= weekEnd;
      })
      .reduce((sum, inv) => {
        const remaining = (inv.quantityGiven || 0) - (inv.quantitySold || 0) - (inv.quantityReturned || 0);
        return sum + remaining;
      }, 0);

    const availableStock = getAvailableStock(productId);
    return Math.max(0, availableStock - totalAssigned);
  };

  // Handle product selection from search modal
  const handleProductSelect = (product: Product) => {
    const existingIndex = form.items.findIndex(item => item.productId === product.id.toString());
    
    if (existingIndex >= 0) {
      const newItems = [...form.items];
      const newQty = parseInt(newItems[existingIndex].quantity) + 1;
      newItems[existingIndex].quantity = newQty.toString();
      setForm({ ...form, items: newItems });
      setSuccess(`Increased quantity for ${product.name}`);
    } else {
      const newItem: AssignmentItem = {
        productId: product.id.toString(),
        quantity: "1",
        product: product
      };
      setForm({ ...form, items: [...form.items, newItem] });
      setSuccess(`Added ${product.name} to weekly assignment`);
    }

    setTimeout(() => setSuccess(null), 3000);
  };

  // Update product quantity in form
  const updateItemQuantity = (index: number, newQuantity: number) => {
    const newItems = [...form.items];
    newItems[index].quantity = newQuantity.toString();
    setForm({ ...form, items: newItems });
  };

  // Remove product from form
  const removeItemFromForm = (index: number) => {
    const newItems = form.items.filter((_, i) => i !== index);
    setForm({ ...form, items: newItems });
  };

  // Get staff assignments grouped by staff
  const getStaffAssignments = () => {
    const grouped = new Map<number, { staff: Staff, assignments: StaffInventory[], totalValue: number }>();
    
    inventoryAssignments.forEach(assignment => {
      if (!grouped.has(assignment.staffId)) {
        grouped.set(assignment.staffId, {
          staff: assignment.staff,
          assignments: [],
          totalValue: 0
        });
      }
      
      const group = grouped.get(assignment.staffId)!;
      group.assignments.push(assignment);
      group.totalValue += assignment.totalSalesAmount;
    });
    
    return Array.from(grouped.values());
  };

  // Validate assignment form
  const validateAssignment = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!form.staffId) errors.push("Please select a staff member");
    if (!form.weekStartDate || !form.weekEndDate) errors.push("Please select week dates");
    
    let hasValidItems = false;
    let totalValue = 0;
    
    form.items.forEach((item, index) => {
      if (item.productId && item.quantity) {
        const quantity = parseInt(item.quantity);
        if (isNaN(quantity) || quantity <= 0) {
          errors.push(`Item ${index + 1}: Quantity must be a positive number`);
        } else {
          const availableStock = getRemainingStockAfterAssignments(parseInt(item.productId), form.weekStartDate);
          if (quantity > availableStock) {
            errors.push(`Item ${index + 1}: Only ${availableStock} units available for this week`);
          } else {
            hasValidItems = true;
            totalValue += (item.product?.price || 0) * quantity;
          }
        }
      }
    });

    if (!hasValidItems) errors.push("Please add at least one item with quantity");
    if (totalValue === 0) errors.push("Total value must be greater than 0");

    return { isValid: errors.length === 0, errors };
  };

  // Handle form submission - Assign weekly inventory
  const handleAssignInventory = async () => {
    const validation = validateAssignment();
    if (!validation.isValid) {
      setError(validation.errors.join(". "));
      setTimeout(() => setError(null), 3000);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const validItems = form.items
        .filter(item => item.productId && item.quantity)
        .map(item => ({
          productId: parseInt(item.productId),
          quantityGiven: parseInt(item.quantity)
        }));

      // Send assignments to weekly API
      const results = [];
      for (const item of validItems) {
        const response = await fetch("/api/staff-inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staffId: parseInt(form.staffId),
            productId: item.productId,
            quantityGiven: item.quantityGiven,
            weekStartDate: form.weekStartDate,
            weekEndDate: form.weekEndDate,
            notes: form.notes,
            priority: form.priority
          })
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to assign item with product ID ${item.productId}`);
        }

        const data = await response.json();
        results.push(data);
      }

      // Reset form and close modal
      setForm({ 
        staffId: "", 
        items: [],
        weekStartDate: currentWeek.weekStartDate,
        weekEndDate: currentWeek.weekEndDate,
        notes: "",
        priority: 'MEDIUM'
      });
      setShowAssignModal(false);
      setSuccess(`✅ Successfully assigned ${results.length} items for the week!`);

      // Refresh data
      setTimeout(() => {
        fetchData();
        setSuccess(null);
      }, 2000);

    } catch (err: any) {
      console.error("Error assigning inventory:", err);
      setError(err.message || "Failed to assign inventory");
      setTimeout(() => setError(null), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle inventory return
  const handleReturnInventory = async () => {
    const validItems = returnForm.items.filter(item => item.quantityReturned && parseInt(item.quantityReturned) > 0);
    
    if (validItems.length === 0) {
      setError("Please select items to return");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Send multiple individual return requests
      for (const item of validItems) {
        const response = await fetch(`/api/staff-inventory/${item.assignmentId}/return`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantityReturned: parseInt(item.quantityReturned)
          })
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to return item ${item.productName}`);
        }
      }

      // Reset and refresh
      setReturnForm({ items: [], notes: "" });
      setShowReturnModal(false);
      setSelectedStaff(null);
      setSuccess(`Successfully returned ${validItems.length} items!`);

      setTimeout(() => {
        fetchData();
        setSuccess(null);
      }, 2000);

    } catch (err: any) {
      console.error("Error returning inventory:", err);
      setError(err.message || "Failed to return inventory");
      setTimeout(() => setError(null), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle complete assignment (mark all as returned)
  const handleCompleteAssignment = async (assignmentId: number) => {
    if (!confirm("Are you sure you want to complete this assignment? This will mark all remaining inventory as returned for this week.")) return;

    try {
      // First get the assignment details
      const assignment = inventoryAssignments.find(a => a.id === assignmentId);
      if (!assignment) {
        throw new Error("Assignment not found");
      }

      // Calculate remaining quantity
      const remaining = assignment.quantityGiven - assignment.quantitySold - assignment.quantityReturned;
      
      if (remaining > 0) {
        // Return all remaining items
        const response = await fetch(`/api/staff-inventory/${assignmentId}/return`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantityReturned: remaining
          })
        });

        if (!response.ok) {
          throw new Error("Failed to complete assignment");
        }
      }

      setSuccess("Assignment completed successfully!");
      setTimeout(() => {
        fetchData();
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to complete assignment");
      setTimeout(() => setError(null), 5000);
    }
  };

  // Handle close week for all assignments
  const handleCloseWeek = async (staffId?: number) => {
    let message = "Close current week?";
    if (staffId) {
      const staff = staffList.find(s => s.id === staffId);
      message = `Close current week for ${staff?.name}?`;
    } else {
      message = "Close current week for all staff?";
    }
    
    if (!confirm(`${message} This will mark all remaining inventory as returned for the current week.`)) return;

    try {
      let url = "/api/staff/close-week";
      if (staffId) {
        url = `/api/staff/${staffId}/close-week`;
      }

      const response = await fetch(url, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to close week');
      }

      const data = await response.json();
      setSuccess(data.message || 'Week closed successfully!');
      
      setTimeout(() => {
        fetchData();
        setSuccess(null);
      }, 2000);

    } catch (error: any) {
      setError(error.message || 'Failed to close week');
      setTimeout(() => setError(null), 5000);
    }
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'ACTIVE': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'COMPLETED': return 'bg-green-100 text-green-800 border border-green-200';
      case 'OVERDUE': return 'bg-red-100 text-red-800 border border-red-200';
      case 'PENDING': return 'bg-amber-100 text-amber-800 border border-amber-200';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  // Get priority badge color
  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border border-orange-200';
      case 'MEDIUM': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'LOW': return 'bg-slate-100 text-slate-800 border border-slate-200';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  // Calculate sales progress percentage
  const calculateSalesProgress = (assignment: StaffInventory) => {
    const total = assignment.quantityGiven || 0;
    const sold = assignment.quantitySold || 0;
    if (total === 0) return 0;
    return (sold / total) * 100;
  };

  // Open return modal for a staff
  const openReturnModal = (staff: Staff) => {
    setSelectedStaff(staff);
    
    const staffAssignments = inventoryAssignments.filter(
      inv => inv.staffId === staff.id && inv.status !== 'COMPLETED' && inv.isCurrentWeek
    );
    
    // FIXED: Using nullish coalescing to convert null to undefined
    const returnItems = staffAssignments.map(assignment => {
      const remaining = (assignment.quantityGiven || 0) - 
                       (assignment.quantitySold || 0) - 
                       (assignment.quantityReturned || 0);
      
      return {
        assignmentId: assignment.id,
        quantityReturned: "0",
        productName: assignment.product?.name || 'Product',
        productId: assignment.productId,
        maxReturnable: remaining,
        weekStartDate: assignment.weekStartDate ?? undefined,
        weekEndDate: assignment.weekEndDate ?? undefined
      };
    }).filter(item => item.maxReturnable > 0);
    
    if (returnItems.length === 0) {
      setError("No inventory to return for this staff in the current week");
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    setReturnForm({
      items: returnItems,
      notes: `Return for ${staff.name} - Current Week`
    });
    setShowReturnModal(true);
  };

  // Get excluded product IDs (products already in form)
  const excludedProductIds = useMemo(() => {
    return form.items.map(item => parseInt(item.productId)).filter(id => !isNaN(id));
  }, [form.items]);

  // Group assignments by week
  const getAssignmentsByWeek = () => {
    const weekMap = new Map<string, StaffInventory[]>();
    
    filteredAssignments.forEach(assignment => {
      if (!assignment.weekStartDate || !assignment.weekEndDate) return;
      
      const weekKey = `${assignment.weekStartDate}_${assignment.weekEndDate}`;
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }
      weekMap.get(weekKey)!.push(assignment);
    });
    
    return Array.from(weekMap.entries())
      .map(([weekKey, assignments]) => {
        const [weekStart, weekEnd] = weekKey.split('_');
        return { weekStart, weekEnd, assignments };
      })
      .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());
  };

  // Stats calculation
  const stats = calculateStats();
  const staffAssignments = getStaffAssignments();
  const assignmentsByWeek = getAssignmentsByWeek();

  // Mobile breakpoint
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-2 md:p-4">
      {/* Mobile Header */}
      <div className="md:hidden mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-xl bg-white shadow-sm hover:shadow transition-shadow"
            >
              <Menu className="w-5 h-5 text-slate-700" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Weekly Staff Inventory</h1>
              <p className="text-xs text-slate-600">Manage weekly product assignments</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchData}
              className="p-2 rounded-xl bg-white shadow-sm hover:shadow transition-shadow"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAssignModal(true)}
              className="p-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl shadow-sm hover:shadow transition-all hover:scale-105"
              title="Assign Weekly Inventory"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <Link 
            href="/admin/staff"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-2 text-sm font-medium group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Back to Staff Management
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg">
              <CalendarDays className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Weekly Staff Inventory Management</h1>
              <p className="text-slate-600">Assign and track products with staff members on a weekly basis</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleCloseWeek()}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all shadow-sm"
          >
            <CheckSquare className="w-4 h-4" />
            Close Current Week
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all text-slate-700 font-medium group"
          >
            <RefreshCw className="w-4 h-4 transition-transform group-hover:rotate-180" />
            Refresh Data
          </button>
          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-2.5 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl font-medium group hover:scale-[1.02]"
          >
            <Plus className="w-5 h-5 transition-transform group-hover:scale-110" />
            <span>Assign Weekly Inventory</span>
          </button>
        </div>
      </div>

      {/* Stats Dashboard with Weekly Focus */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">Current Week</p>
              <p className="text-2xl font-bold text-blue-700">{stats.currentWeekAssignments}</p>
              <p className="text-xs text-slate-500 mt-1">
                Active assignments this week
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50">
              <CalendarDays className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-3 h-1 bg-blue-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
              style={{ width: `${(stats.currentWeekAssignments / Math.max(stats.totalAssignments, 1)) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">This Week Sales</p>
              <p className="text-2xl font-bold text-emerald-700">{stats.currentWeekSales}</p>
              <p className="text-xs text-slate-500 mt-1">
                Items sold this week
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50">
              <ShoppingBag className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <div className="mt-3 h-1 bg-emerald-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full"
              style={{ width: `${Math.min((stats.currentWeekSales / 100) * 100, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-white rounded-2xl border border-green-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">Total Sales Value</p>
              <p className="text-2xl font-bold text-green-700">
                KES {stats.totalSalesValue.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Profit: KES {stats.totalProfit.toLocaleString()}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-100 to-green-50">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-3 h-1 bg-green-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full"
              style={{ width: `${Math.min((stats.totalSalesValue / 100000) * 100, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl border border-amber-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">Sell-through Rate</p>
              <p className="text-2xl font-bold text-amber-700">
                {stats.averageCompletionRate.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Weekly performance average
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <div className="mt-3 h-1 bg-amber-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full"
              style={{ width: `${stats.averageCompletionRate}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Weekly Performance Preview */}
      {stats.weeklyPerformance.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4">
          <h3 className="font-semibold text-slate-900 mb-3">Weekly Performance History</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.weeklyPerformance.slice(0, 3).map((week, index) => (
              <div key={index} className="border border-slate-200 rounded-xl p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-900">
                    {formatWeekRange(week.weekStart, week.weekEnd)}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${week.sellThroughRate >= 70 ? 'bg-green-100 text-green-800' : week.sellThroughRate >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                    {week.sellThroughRate.toFixed(0)}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="text-slate-600">Assigned</div>
                    <div className="font-bold">{week.totalGiven}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-600">Sold</div>
                    <div className="font-bold text-green-600">{week.totalSold}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-600">Returned</div>
                    <div className="font-bold text-orange-600">{week.totalReturned}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filter Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff, product, week, SKU, category, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm placeholder-slate-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as any)}
                className="px-3 py-2 border-2 border-slate-300 rounded-xl bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border-2 border-slate-300 rounded-xl bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="week">Sort by Week</option>
                <option value="staff">Sort by Staff</option>
                <option value="totalValue">Sort by Value</option>
                <option value="priority">Sort by Priority</option>
              </select>
            </div>

            <div className="flex bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => setViewMode('weeks')}
                className={`p-2 rounded-lg ${viewMode === 'weeks' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
                title="Week View"
              >
                <CalendarDays className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 rounded-lg ${viewMode === 'cards' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
                title="Cards View"
              >
                <Users className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
                title="Grid View"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Chips */}
        {searchTerm && (
          <div className="mt-3 flex items-center gap-2">
            <div className="text-sm text-slate-600">Active filters:</div>
            <div className="flex flex-wrap gap-2">
              {searchTerm && (
                <div className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm">
                  <Search className="w-3 h-3" />
                  {searchTerm}
                  <button
                    onClick={() => setSearchTerm('')}
                    className="ml-1 hover:text-blue-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {activeFilter !== 'all' && (
                <div className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm">
                  <Filter className="w-3 h-3" />
                  {activeFilter}
                  <button
                    onClick={() => setActiveFilter('all')}
                    className="ml-1 hover:text-slate-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 bg-gradient-to-r from-red-50 to-red-50/50 border-l-4 border-red-500 text-red-700 p-4 rounded-xl shadow-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
          <div className="flex-1">
            <div className="font-medium">Error</div>
            <div className="text-sm">{error}</div>
          </div>
          <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-gradient-to-r from-emerald-50 to-emerald-50/50 border-l-4 border-emerald-500 text-emerald-700 p-4 rounded-xl shadow-sm flex items-start gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
          <div className="flex-1">
            <div className="font-medium">Success</div>
            <div className="text-sm">{success}</div>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-700 hover:text-emerald-900">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="inline-flex items-center justify-center">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-blue-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
            </div>
          </div>
          <p className="mt-4 text-slate-600 font-medium">Loading weekly inventory assignments...</p>
          <p className="text-sm text-slate-500">Fetching data from server</p>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
            <CalendarDays className="w-10 h-10 text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No weekly inventory assignments found</h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            {searchTerm 
              ? "No results match your search. Try different keywords or clear filters."
              : "Get started by assigning products to your staff members for the current week."
            }
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowAssignModal(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl font-medium"
            >
              <Plus className="w-5 h-5" />
              Assign Products for This Week
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Summary Bar */}
          <div className="mb-4 flex items-center justify-between text-sm text-slate-600">
            <div>
              Showing <span className="font-bold text-slate-900">{filteredAssignments.length}</span> assignments
              <span className="ml-2">
                across <span className="font-bold">{new Set(filteredAssignments.map(a => a.weekStartDate)).size}</span> weeks
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span>Active ({filteredAssignments.filter(a => a.status === 'ACTIVE').length})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span>Pending ({filteredAssignments.filter(a => a.status === 'PENDING').length})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Overdue ({filteredAssignments.filter(a => a.status === 'OVERDUE').length})</span>
              </div>
            </div>
          </div>

          {/* Assignments Views */}
          {viewMode === 'weeks' ? (
            <div className="space-y-4">
              {assignmentsByWeek.map((week) => (
                <WeekViewComponent
                  key={`${week.weekStart}_${week.weekEnd}`}
                  weekStart={week.weekStart}
                  weekEnd={week.weekEnd}
                  assignments={week.assignments}
                  onCloseWeek={() => {
                    const staffIds = new Set(week.assignments.map(a => a.staffId));
                    if (staffIds.size === 1) {
                      handleCloseWeek(Array.from(staffIds)[0]);
                    } else {
                      handleCloseWeek();
                    }
                  }}
                />
              ))}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAssignments.map((assignment) => {
                const remaining = assignment.quantityGiven - assignment.quantitySold - assignment.quantityReturned;
                const daysRemaining = assignment.weekEndDate ? getDaysRemainingInWeek(assignment.weekEndDate) : 0;
                const progress = calculateSalesProgress(assignment);
                const weekRange = assignment.weekStartDate && assignment.weekEndDate 
                  ? formatWeekRange(assignment.weekStartDate, assignment.weekEndDate)
                  : 'No week assigned';

                return (
                  <div key={assignment.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-blue-300 group">
                    {/* Status Badge */}
                    <div className="absolute top-4 right-4 z-10">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                        {assignment.status}
                      </span>
                    </div>

                    {/* Priority Badge */}
                    {assignment.priority && (
                      <div className="absolute top-4 left-4 z-10">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(assignment.priority)}`}>
                          {assignment.priority}
                        </span>
                      </div>
                    )}

                    <div className="p-5">
                      {/* Staff Info */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                          <User className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-slate-900 group-hover:text-blue-700">{assignment.staff?.name}</h3>
                          {assignment.staff?.phone && (
                            <p className="text-sm text-slate-600">{assignment.staff.phone}</p>
                          )}
                        </div>
                      </div>

                      {/* Week Info */}
                      <div className="mb-3">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <CalendarDays className="w-4 h-4" />
                          <span>{weekRange}</span>
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                            <Package className="w-4 h-4 text-slate-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 text-sm">{assignment.product?.name}</h4>
                            {assignment.product?.category && (
                              <p className="text-xs text-slate-500">{assignment.product.category}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quantity Progress */}
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-slate-50 rounded-lg p-2">
                            <div className="text-xs text-slate-600 mb-1">Given</div>
                            <div className="font-bold text-slate-900">{assignment.quantityGiven}</div>
                          </div>
                          <div className="bg-emerald-50 rounded-lg p-2">
                            <div className="text-xs text-emerald-600 mb-1">Sold</div>
                            <div className="font-bold text-emerald-700">{assignment.quantitySold}</div>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-2">
                            <div className="text-xs text-blue-600 mb-1">Left</div>
                            <div className="font-bold text-blue-700">{remaining}</div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div>
                          <div className="flex justify-between text-xs text-slate-600 mb-1">
                            <span>Sales Progress</span>
                            <span>{progress.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500"
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Value & Days */}
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-slate-600">
                            Value: <span className="font-bold text-green-600">
                              KES {assignment.totalSalesAmount.toLocaleString()}
                            </span>
                          </div>
                          {daysRemaining > 0 && (
                            <div className="text-sm font-medium text-emerald-600">
                              {daysRemaining}d left in week
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-5 pt-4 border-t border-slate-100">
                        <div className="flex gap-2">
                          {remaining > 0 && assignment.isCurrentWeek && (
                            <button
                              onClick={() => {
                                setSelectedStaff(assignment.staff);
                                setReturnForm({
                                  items: [{
                                    assignmentId: assignment.id,
                                    quantityReturned: "1",
                                    productName: assignment.product?.name || '',
                                    productId: assignment.productId,
                                    maxReturnable: remaining,
                                    weekStartDate: assignment.weekStartDate ?? undefined,
                                    weekEndDate: assignment.weekEndDate ?? undefined
                                  }],
                                  notes: ""
                                });
                                setShowReturnModal(true);
                              }}
                              className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all text-sm font-medium"
                            >
                              Return
                            </button>
                          )}
                          <button
                            onClick={() => handleCompleteAssignment(assignment.id)}
                            className="flex-1 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all text-sm font-medium"
                          >
                            Complete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {staffAssignments.map((group) => (
                <div key={group.staff.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300">
                  {/* Header */}
                  <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                          <User className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900">{group.staff.name}</h3>
                          {group.staff.phone && (
                            <p className="text-sm text-slate-600">{group.staff.phone}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => openReturnModal(group.staff)}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all shadow-sm font-medium text-sm"
                      >
                        Return Items
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="p-5">
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <div className="text-xs text-slate-600 mb-1">Weeks</div>
                        <div className="text-lg font-bold text-slate-900">
                          {new Set(group.assignments.map(a => a.weekStartDate)).size}
                        </div>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3 text-center">
                        <div className="text-xs text-emerald-600 mb-1">Sold</div>
                        <div className="text-lg font-bold text-emerald-700">
                          {group.assignments.reduce((sum, a) => sum + a.quantitySold, 0)}
                        </div>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-3 text-center">
                        <div className="text-xs text-blue-600 mb-1">Remaining</div>
                        <div className="text-lg font-bold text-blue-700">
                          {group.assignments.reduce((sum, a) => sum + (a.quantityGiven - a.quantitySold - a.quantityReturned), 0)}
                        </div>
                      </div>
                      <div className="bg-green-50 rounded-xl p-3 text-center">
                        <div className="text-xs text-green-600 mb-1">Value</div>
                        <div className="text-lg font-bold text-green-700">
                          KES {group.totalValue.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Assignment List */}
                    <div className="space-y-3">
                      {group.assignments.slice(0, 3).map((assignment) => {
                        const weekRange = assignment.weekStartDate && assignment.weekEndDate 
                          ? formatWeekRange(assignment.weekStartDate, assignment.weekEndDate)
                          : 'No week';
                        
                        return (
                          <div key={assignment.id} className="bg-gradient-to-r from-slate-50/50 to-white border border-slate-100 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-slate-500" />
                                <span className="font-medium text-slate-900 text-sm">{assignment.product?.name}</span>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                                {assignment.status}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mb-2">{weekRange}</div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="text-center">
                                <div className="text-slate-600">Given</div>
                                <div className="font-bold">{assignment.quantityGiven}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-slate-600">Sold</div>
                                <div className="font-bold text-emerald-600">{assignment.quantitySold}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-slate-600">Left</div>
                                <div className="font-bold text-blue-600">
                                  {assignment.quantityGiven - assignment.quantitySold - assignment.quantityReturned}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {group.assignments.length > 3 && (
                        <div className="text-center text-sm text-blue-600 font-medium">
                          +{group.assignments.length - 3} more weekly assignments
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List View */
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-slate-50 to-slate-100/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Staff
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Week
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAssignments.map((assignment) => {
                      const remaining = assignment.quantityGiven - assignment.quantitySold - assignment.quantityReturned;
                      const weekRange = assignment.weekStartDate && assignment.weekEndDate 
                        ? formatWeekRange(assignment.weekStartDate, assignment.weekEndDate)
                        : 'No week';

                      return (
                        <tr key={assignment.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                                <User className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <div className="font-medium text-slate-900">{assignment.staff?.name}</div>
                                {assignment.staff?.phone && (
                                  <div className="text-sm text-slate-600">{assignment.staff.phone}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-slate-900">{weekRange}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">{assignment.product?.name}</div>
                            {assignment.product?.sku && (
                              <div className="text-xs text-slate-500 font-mono">{assignment.product.sku}</div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-6">
                              <div className="text-center">
                                <div className="text-xs text-slate-600">Given</div>
                                <div className="font-bold text-slate-900">{assignment.quantityGiven}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-slate-600">Sold</div>
                                <div className="font-bold text-emerald-600">{assignment.quantitySold}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-slate-600">Left</div>
                                <div className="font-bold text-blue-600">{remaining}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-2">
                              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                                {assignment.status}
                              </span>
                              {assignment.priority && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(assignment.priority)}`}>
                                  {assignment.priority}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {remaining > 0 && assignment.isCurrentWeek && (
                                <button
                                  onClick={() => {
                                    setSelectedStaff(assignment.staff);
                                    setReturnForm({
                                      items: [{
                                        assignmentId: assignment.id,
                                        quantityReturned: "1",
                                        productName: assignment.product?.name || '',
                                        productId: assignment.productId,
                                        maxReturnable: remaining,
                                        weekStartDate: assignment.weekStartDate ?? undefined,
                                        weekEndDate: assignment.weekEndDate ?? undefined
                                      }],
                                      notes: ""
                                    });
                                    setShowReturnModal(true);
                                  }}
                                  className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                  title="Return"
                                >
                                  <Package className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleCompleteAssignment(assignment.id)}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Complete"
                              >
                                <CheckSquare className="w-4 h-4" />
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
        </>
      )}

      {/* Footer */}
      <div className="mt-8 text-center text-slate-500 text-sm">
        <p>© {new Date().getFullYear()} Swift Metals POS • Weekly Staff Inventory Management System v2.0</p>
        <p className="text-xs mt-1">Total weekly assignments: {stats.totalAssignments} • Current week: {formatWeekRange(currentWeek.weekStartDate, currentWeek.weekEndDate)}</p>
      </div>

      {/* Product Search Modal */}
      <ProductSearchModal
        isOpen={showProductSearch}
        onClose={() => setShowProductSearch(false)}
        onSelect={handleProductSelect}
        products={products}
        excludedIds={excludedProductIds}
      />

      {/* Assign Weekly Inventory Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-2 md:p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 md:p-5 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <CalendarDays className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold">Assign Products for the Week</h2>
                    <p className="text-blue-100 text-sm">Select products and assign to staff member for the week</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setForm({ 
                      staffId: "", 
                      items: [],
                      weekStartDate: currentWeek.weekStartDate,
                      weekEndDate: currentWeek.weekEndDate,
                      notes: "",
                      priority: 'MEDIUM'
                    });
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-5">
              {/* Staff Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Select Staff Member *
                </label>
                <select
                  value={form.staffId}
                  onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm"
                  disabled={submitting}
                >
                  <option value="">Choose staff member...</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} {staff.phone && `(${staff.phone})`} {staff.role && `- ${staff.role}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Week Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Week Dates *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-600 mb-1">Week Start (Monday)</div>
                    <input
                      type="date"
                      value={form.weekStartDate}
                      onChange={(e) => {
                        const startDate = e.target.value;
                        const endDate = new Date(startDate);
                        endDate.setDate(endDate.getDate() + 6);
                        setForm({ 
                          ...form, 
                          weekStartDate: startDate,
                          weekEndDate: endDate.toISOString().split('T')[0]
                        });
                      }}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm"
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-slate-600 mb-1">Week End (Sunday)</div>
                    <input
                      type="date"
                      value={form.weekEndDate}
                      onChange={(e) => setForm({ ...form, weekEndDate: e.target.value })}
                      min={form.weekStartDate}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm"
                      disabled={submitting}
                    />
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Week: {form.weekStartDate} to {form.weekEndDate}
                </div>
              </div>

              {/* Product Search Section */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Add Products for this Week
                </label>
                <ProductSearchInput
                  value=""
                  onChange={() => {}}
                  onSearchClick={() => setShowProductSearch(true)}
                  placeholder="Click browse to search products..."
                  disabled={submitting}
                />
              </div>

              {/* Selected Products */}
              {form.items.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-semibold text-slate-900">
                      Selected Products ({form.items.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, items: [] })}
                      className="text-sm text-red-600 hover:text-red-800 font-medium"
                    >
                      Clear All
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {form.items.map((item, index) => (
                      <ProductSelectionCard
                        key={index}
                        product={item.product!}
                        onRemove={() => removeItemFromForm(index)}
                        quantity={parseInt(item.quantity)}
                        onQuantityChange={(qty) => updateItemQuantity(index, qty)}
                        availableStock={getRemainingStockAfterAssignments(parseInt(item.productId), form.weekStartDate)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Priority */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Priority Level
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(priority => (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => setForm({ ...form, priority: priority as any })}
                      className={`px-4 py-3 rounded-xl border-2 transition-all ${form.priority === priority 
                        ? getPriorityColor(priority) + ' border-blue-500 scale-[1.02]' 
                        : 'border-slate-200 hover:border-slate-300'}`}
                      disabled={submitting}
                    >
                      <div className="text-sm font-medium">{priority}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Add any special instructions, guidelines, or notes for this weekly assignment..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm"
                  disabled={submitting}
                />
              </div>

              {/* Summary */}
              {form.items.length > 0 && (
                <div className="mb-6 bg-gradient-to-r from-slate-50 to-blue-50/50 rounded-xl p-4">
                  <h4 className="font-semibold text-slate-900 mb-3">Weekly Assignment Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="text-center">
                      <div className="text-xs text-slate-600">Total Items</div>
                      <div className="text-xl font-bold text-slate-900">
                        {form.items.reduce((sum, item) => sum + parseInt(item.quantity), 0)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-slate-600">Unique Products</div>
                      <div className="text-xl font-bold text-slate-900">{form.items.length}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-slate-600">Total Value</div>
                      <div className="text-xl font-bold text-green-600">
                        KES {form.items.reduce((sum, item) => sum + ((item.product?.price || 0) * parseInt(item.quantity)), 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-slate-600">Week</div>
                      <div className="text-xl font-bold text-blue-600">
                        {new Date(form.weekStartDate).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 border-t border-slate-200 p-4 md:p-5 bg-white rounded-b-2xl">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setForm({ 
                      staffId: "", 
                      items: [],
                      weekStartDate: currentWeek.weekStartDate,
                      weekEndDate: currentWeek.weekEndDate,
                      notes: "",
                      priority: 'MEDIUM'
                    });
                  }}
                  type="button"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-medium text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignInventory}
                  type="button"
                  disabled={submitting || !form.staffId || form.items.length === 0}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Assigning...
                    </>
                  ) : (
                    <>
                      <CalendarDays className="w-5 h-5" />
                      Assign for the Week
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return Inventory Modal */}
      {showReturnModal && selectedStaff && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-2 md:p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-amber-500 to-orange-600 text-white p-4 md:p-5 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Package className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold">Return Inventory</h2>
                    <p className="text-amber-100 text-sm">Return items from {selectedStaff.name} (Current Week)</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowReturnModal(false);
                    setSelectedStaff(null);
                    setReturnForm({ items: [], notes: "" });
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-5">
              {/* Items to Return */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-900 mb-3">
                  Select items to return from {selectedStaff.name} (Current Week)
                </label>
                
                <div className="space-y-3">
                  {returnForm.items.map((item, index) => {
                    const weekRange = item.weekStartDate && item.weekEndDate 
                      ? formatWeekRange(item.weekStartDate, item.weekEndDate)
                      : 'Current Week';
                    
                    return (
                      <div key={item.assignmentId} className="border-2 border-slate-200 rounded-xl p-4 bg-slate-50/50">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-medium text-slate-900">{item.productName}</div>
                            <div className="text-xs text-slate-500">{weekRange}</div>
                          </div>
                          <div className="text-sm font-semibold text-slate-700">
                            Max: {item.maxReturnable}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="text-xs text-slate-600 mb-1">Quantity to Return</div>
                            <input
                              type="range"
                              min="0"
                              max={item.maxReturnable}
                              value={parseInt(item.quantityReturned) || 0}
                              onChange={(e) => {
                                const newItems = [...returnForm.items];
                                newItems[index].quantityReturned = e.target.value;
                                setReturnForm({ ...returnForm, items: newItems });
                              }}
                              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500"
                              disabled={submitting}
                            />
                          </div>
                          <div className="w-20">
                            <input
                              type="number"
                              min="0"
                              max={item.maxReturnable}
                              value={item.quantityReturned}
                              onChange={(e) => {
                                const newItems = [...returnForm.items];
                                newItems[index].quantityReturned = e.target.value;
                                setReturnForm({ ...returnForm, items: newItems });
                              }}
                              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-sm text-center"
                              disabled={submitting}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newItems = [...returnForm.items];
                              newItems[index].quantityReturned = item.maxReturnable.toString();
                              setReturnForm({ ...returnForm, items: newItems });
                            }}
                            className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 text-sm font-medium"
                            disabled={submitting}
                          >
                            Max
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Return */}
              {returnForm.items.length > 0 && (
                <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50/50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Total Items to Return</div>
                      <div className="text-xs text-slate-600">
                        {returnForm.items.filter(item => parseInt(item.quantityReturned) > 0).length} items selected
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-amber-600">
                      {returnForm.items.reduce((sum, item) => sum + parseInt(item.quantityReturned), 0)}
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Return Notes (Optional)
                </label>
                <textarea
                  value={returnForm.notes}
                  onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                  placeholder="Add notes about why items are being returned..."
                  rows={2}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-sm"
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 border-t border-slate-200 p-4 md:p-5 bg-white rounded-b-2xl">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setShowReturnModal(false);
                    setSelectedStaff(null);
                    setReturnForm({ items: [], notes: "" });
                  }}
                  type="button"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-medium text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReturnInventory}
                  type="button"
                  disabled={submitting || returnForm.items.every(item => parseInt(item.quantityReturned) === 0)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:from-amber-600 hover:to-orange-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Package className="w-5 h-5" />
                      Return Selected Items
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}