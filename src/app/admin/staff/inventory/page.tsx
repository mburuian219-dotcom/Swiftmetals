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
  PackagePlus,
  PackageMinus,
  TrendingUp,
  Smartphone as SmartphoneIcon,
  Tablet as TabletIcon2,
  Home,
  Briefcase,
  Settings,
  HelpCircle,
  Info,
  Star,
  Award,
  Crown,
  Rocket,
  TrendingDown,
  Percent as PercentIcon,
  PackageCheck,
  PackageX,
  PackageSearch,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  Minimize2,
  Columns,
  Rows,
  Layout,
  Grid3x3,
  Table,
  Database,
  HardDriveIcon,
  CpuIcon,
  MemoryStickIcon,
  Monitor,
  PrinterIcon,
  Network,
  WifiIcon,
  BluetoothIcon,
  LaptopIcon,
  ServerIcon,
  RouterIcon,
  CameraIcon,
  VideoIcon,
  MicIcon,
  GamepadIcon,
  WatchIcon,
  HeadphonesIcon,
  SpeakerIcon,
  KeyboardIcon,
  MouseIcon,
  Copy,
  XSquare,
  PlusSquare,
  MinusSquare,
  ListChecks,
  GridIcon,
  ColumnsIcon,
  Building2,
  Phone,
  Mail,
  Banknote,
  Wallet,
  Landmark,
  Receipt,
  FileTextIcon,
  Calendar,
  ClockIcon,
  Building,
  UserCircle,
  BriefcaseIcon,
  UsersIcon,
  ShoppingBagIcon,
  PieChartIcon,
  BarChartIcon,
  Activity,
  GitBranch,
  History,
  Save,
  Send,
  DownloadCloud,
  UploadCloud,
  Shield,
  Lock,
  Unlock,
  Key,
  Fingerprint,
  Scan,
  QrCode,
  Barcode,
  Tag,
  Ticket,
  Gift
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
  assignedQuantity?: number;
  availableQuantity?: number;
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

interface AssignmentForm {
  staffId: string;
  items: AssignmentItem[];
  weekStartDate: string;
  weekEndDate: string;
  notes?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

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

interface RestockForm {
  productId: number;
  quantity: string;
  costPrice: string;
  supplier?: string;
  notes?: string;
  productName?: string;
  paymentSource: string;
  creditorId: string;
  isNewCreditor?: boolean;
  newCreditorName?: string;
  newCreditorPhone?: string;
  newCreditorEmail?: string;
}

interface Creditor {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  totalOwed: number;
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
  onSelectBulk: (products: Product[]) => void;
  products: Product[];
  excludedIds?: number[];
  bulkMode?: boolean;
}

interface BatchAssignmentItem {
  productId: number;
  quantityGiven: number;
}

// Helper: Get current week dates (Monday to Sunday)
const getCurrentWeekDates = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
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

// Helper: Calculate available stock (total - assigned)
const calculateAvailableStock = (product: Product, assignments: StaffInventory[]): number => {
  const totalStock = product.stockQuantity || 0;
  
  const totalAssigned = assignments
    .filter(a => a.productId === product.id && a.status !== 'COMPLETED')
    .reduce((sum, a) => sum + (a.quantityGiven - a.quantitySold - a.quantityReturned), 0);
  
  return Math.max(0, totalStock - totalAssigned);
};

// Product Selection Card Component - Updated with black text
const ProductSelectionCard: React.FC<{
  product: Product;
  onRemove?: () => void;
  quantity?: number;
  onQuantityChange?: (quantity: number) => void;
  availableStock: number;
  totalStock: number;
  assignedStock: number;
  onSetMax?: () => void;
  onSetMin?: () => void;
  onRestock?: () => void;
}> = ({ 
  product, 
  onRemove, 
  quantity = 1, 
  onQuantityChange, 
  availableStock,
  totalStock,
  assignedStock,
  onSetMax, 
  onSetMin, 
  onRestock 
}) => {
  const handleQuantityChange = (newQty: number) => {
    if (newQty < 1) return;
    if (newQty > availableStock) {
      newQty = availableStock;
    }
    onQuantityChange?.(newQty);
  };

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-gradient-to-br from-white to-slate-50/50 hover:shadow-sm transition-shadow group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0">
            <Package className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-black text-sm truncate">{product.name}</h4>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {product.category && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-xs text-black">
                  {product.category}
                </span>
              )}
              {product.sku && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 rounded text-xs text-blue-800 font-mono">
                  <Hash className="w-3 h-3" />
                  {product.sku}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {onRestock && (
            <button
              onClick={onRestock}
              className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
              title="Restock this product"
            >
              <PackagePlus className="w-4 h-4" />
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1.5 text-black hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-black mb-1">Price</div>
          <div className="text-lg font-bold text-green-700">
            KES {product.price.toLocaleString()}
          </div>
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-black">Quantity</span>
            <div className="flex items-center gap-1">
              <button
                onClick={onSetMin}
                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-0.5 rounded hover:bg-blue-50"
                title="Set to 1"
              >
                Min
              </button>
              <button
                onClick={onSetMax}
                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-0.5 rounded hover:bg-blue-50"
                title={`Set to max (${availableStock})`}
              >
                Max
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleQuantityChange(quantity - 1)}
              disabled={quantity <= 1}
              className="w-8 h-8 flex items-center justify-center border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-black"
            >
              <span className="text-lg">-</span>
            </button>
            <input
              type="number"
              min="1"
              max={availableStock}
              value={quantity}
              onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
              className="w-16 text-center py-1 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-black"
            />
            <button
              onClick={() => handleQuantityChange(quantity + 1)}
              disabled={quantity >= availableStock}
              className="w-8 h-8 flex items-center justify-center border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-black"
            >
              <span className="text-lg">+</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-black">Total:</span>
          <span className="font-bold text-black">
            KES {(product.price * quantity).toLocaleString()}
          </span>
        </div>
        
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center p-1.5 bg-blue-50 rounded-lg">
            <span className="text-black block">Total</span>
            <span className="font-bold text-blue-700">{totalStock}</span>
          </div>
          <div className="text-center p-1.5 bg-amber-50 rounded-lg">
            <span className="text-black block">Assigned</span>
            <span className="font-bold text-amber-700">{assignedStock}</span>
          </div>
          <div className="text-center p-1.5 bg-green-50 rounded-lg">
            <span className="text-black block">Available</span>
            <span className={`font-bold ${availableStock > 0 ? 'text-green-700' : 'text-red-700'}`}>
              {availableStock}
            </span>
          </div>
        </div>

        {availableStock === 0 && totalStock > 0 && (
          <div className="text-xs text-amber-600 bg-amber-50 p-1.5 rounded-lg text-center">
            All stock is currently assigned to staff
          </div>
        )}
        
        {availableStock === 0 && totalStock === 0 && (
          <div className="text-xs text-red-600 bg-red-50 p-1.5 rounded-lg text-center">
            No stock available. Please restock.
          </div>
        )}
      </div>
    </div>
  );
};

// Product Search Modal Component - Updated with black text
const ProductSearchModal: React.FC<ProductSearchModalProps> = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  onSelectBulk,
  products,
  excludedIds = [],
  bulkMode = true
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'category'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean) as string[]);
    return Array.from(cats);
  }, [products]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
    setSelectedProducts([]);
    setSelectAll(false);
  }, [isOpen]);

  useEffect(() => {
    let result = products.filter(product => !excludedIds.includes(product.id));

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

    if (selectedCategory !== "all") {
      result = result.filter(product => product.category === selectedCategory);
    }

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
          aVal = a.availableQuantity || 0;
          bVal = b.availableQuantity || 0;
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

  const handleProductSelect = (product: Product) => {
    if (selectedProducts.some(p => p.id === product.id)) {
      setSelectedProducts(selectedProducts.filter(p => p.id !== product.id));
    } else {
      setSelectedProducts([...selectedProducts, product]);
    }
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts);
    }
    setSelectAll(!selectAll);
  };

  const handleBulkAdd = () => {
    if (bulkMode && onSelectBulk) {
      onSelectBulk(selectedProducts);
    } else {
      selectedProducts.forEach(product => onSelect(product));
    }
    setSelectedProducts([]);
    setSelectAll(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-2 md:p-4 z-[100]">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Select Products</h2>
                <p className="text-blue-100 text-sm">
                  {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-black" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by name, SKU, category, brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm text-black"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-black" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-sm text-black"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              {sortOrder === 'asc' ? <SortAsc className="w-4 h-4 text-black" /> : <SortDesc className="w-4 h-4 text-black" />}
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
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-black mb-2">No products found</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map(product => {
                const isSelected = selectedProducts.some(p => p.id === product.id);
                const available = product.availableQuantity || 0;
                return (
                  <div
                    key={product.id}
                    onClick={() => handleProductSelect(product)}
                    className={`cursor-pointer border-2 rounded-xl p-4 transition-all ${
                      isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-500 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                        <Package className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className={`font-bold text-sm ${isSelected ? 'text-blue-800' : 'text-black'}`}>
                          {product.name}
                        </h4>
                        {product.category && (
                          <span className="inline-block px-2 py-0.5 bg-slate-100 rounded text-xs mt-1 text-black">
                            {product.category}
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className="w-5 h-5 text-blue-600" />}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-black text-sm">Price:</span>
                        <span className="font-bold text-green-700">KES {product.price.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-black text-sm">Available:</span>
                        <span className={`font-medium ${available > 10 ? 'text-green-700' : available > 0 ? 'text-orange-700' : 'text-red-700'}`}>
                          {available} units
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-black">
                        <span>Total: {product.stockQuantity || 0}</span>
                        <span>Assigned: {product.assignedQuantity || 0}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 p-4 bg-slate-50 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <div className="text-sm text-black">
              {filteredProducts.length} products • {selectedProducts.length} selected
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-white text-black">
                Cancel
              </button>
              {selectedProducts.length > 0 && (
                <button
                  onClick={handleBulkAdd}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add {selectedProducts.length} Product{selectedProducts.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Quick Restock Modal Component - Enhanced with Creditor Management and black text
const QuickRestockModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onRestock: (data: RestockForm) => Promise<boolean>;
  product: Product | null;
  creditors: Creditor[];
  onRefreshCreditors: () => void;
}> = ({ isOpen, onClose, onRestock, product, creditors, onRefreshCreditors }) => {
  const [form, setForm] = useState<RestockForm>({
    productId: 0,
    quantity: "",
    costPrice: "",
    supplier: "",
    notes: "",
    paymentSource: "CASH",
    creditorId: "",
    isNewCreditor: false,
    newCreditorName: "",
    newCreditorPhone: "",
    newCreditorEmail: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [loadingCreditors, setLoadingCreditors] = useState(false);
  const [showNewCreditorForm, setShowNewCreditorForm] = useState(false);

  useEffect(() => {
    if (isOpen && form.paymentSource === "CREDIT") {
      onRefreshCreditors();
    }
  }, [isOpen, form.paymentSource, onRefreshCreditors]);

  useEffect(() => {
    if (product && isOpen) {
      setForm({
        productId: product.id,
        quantity: "",
        costPrice: product.productionCost?.toString() || "",
        supplier: "",
        notes: "",
        paymentSource: "CASH",
        creditorId: "",
        isNewCreditor: false,
        newCreditorName: "",
        newCreditorPhone: "",
        newCreditorEmail: "",
        productName: product.name
      });
      setShowNewCreditorForm(false);
    }
  }, [product, isOpen]);

  const handleSubmit = async () => {
    if (!form.quantity || !form.costPrice) {
      alert("Please fill in quantity and cost price");
      return;
    }

    if (form.paymentSource === "CREDIT") {
      if (form.isNewCreditor) {
        if (!form.newCreditorName) {
          alert("Please enter the new creditor's name");
          return;
        }
      } else if (!form.creditorId) {
        alert("Please select a creditor or add a new one");
        return;
      }
    }

    setSubmitting(true);
    try {
      const success = await onRestock(form);
      if (success) {
        onClose();
      }
    } catch (error) {
      console.error("Restock error:", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[150]">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4 rounded-t-2xl sticky top-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <PackagePlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Quick Restock</h2>
                <p className="text-green-100 text-sm">{product.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-black mb-2">
              Current Stock
            </label>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-black">
                {product.stockQuantity || 0} units
              </span>
              <span className="text-sm text-black">
                Assigned: {product.assignedQuantity || 0}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-black mb-2">
              Quantity to Add *
            </label>
            <input
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              placeholder="Enter quantity"
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 text-sm text-black"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-black mb-2">
              Cost Price (per unit) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-black">KES</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                placeholder="0.00"
                className="w-full pl-16 pr-4 py-3 border-2 border-slate-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 text-sm text-black"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-black mb-2">
              Payment Source *
            </label>
            <select
              value={form.paymentSource}
              onChange={(e) => {
                setForm({ ...form, paymentSource: e.target.value, creditorId: "", isNewCreditor: false });
                setShowNewCreditorForm(false);
              }}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 text-sm text-black"
            >
              <option value="CASH">Cash</option>
              <option value="BANK">Bank Transfer</option>
              <option value="MPESA">M-Pesa</option>
              <option value="CREDIT">Credit (Pay Later)</option>
            </select>
          </div>

          {form.paymentSource === "CREDIT" && (
            <div className="space-y-3 bg-amber-50 p-3 rounded-xl border border-amber-200">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-black">
                  Creditor Selection
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCreditorForm(!showNewCreditorForm);
                    if (!showNewCreditorForm) {
                      setForm({ ...form, isNewCreditor: true, creditorId: "" });
                    } else {
                      setForm({ ...form, isNewCreditor: false, newCreditorName: "", newCreditorPhone: "", newCreditorEmail: "" });
                    }
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {showNewCreditorForm ? "Select Existing" : "+ New Creditor"}
                </button>
              </div>

              {showNewCreditorForm ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={form.newCreditorName}
                    onChange={(e) => setForm({ ...form, newCreditorName: e.target.value })}
                    placeholder="Creditor Name *"
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:border-green-500 text-sm text-black"
                  />
                  <input
                    type="text"
                    value={form.newCreditorPhone}
                    onChange={(e) => setForm({ ...form, newCreditorPhone: e.target.value })}
                    placeholder="Phone Number"
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:border-green-500 text-sm text-black"
                  />
                  <input
                    type="email"
                    value={form.newCreditorEmail}
                    onChange={(e) => setForm({ ...form, newCreditorEmail: e.target.value })}
                    placeholder="Email (Optional)"
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:border-green-500 text-sm text-black"
                  />
                </div>
              ) : (
                <select
                  value={form.creditorId}
                  onChange={(e) => setForm({ ...form, creditorId: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-green-500 text-sm text-black"
                  disabled={loadingCreditors}
                >
                  <option value="">Select creditor...</option>
                  {creditors.map((creditor: Creditor) => (
                    <option key={creditor.id} value={creditor.id}>
                      {creditor.name} (Owed: KES {creditor.totalOwed.toLocaleString()})
                    </option>
                  ))}
                </select>
              )}

              <p className="text-xs text-black">
                {showNewCreditorForm 
                  ? "A new creditor will be created and the balance updated" 
                  : "The creditor's balance will be updated automatically"}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-black mb-2">
              Supplier (Optional)
            </label>
            <input
              type="text"
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              placeholder="Supplier name"
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 text-sm text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-black mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Add notes about this restock..."
              rows={2}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 text-sm text-black"
            />
          </div>

          <div className="bg-blue-50 rounded-xl p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-black">New Stock After Restock:</span>
              <span className="font-bold text-green-700">
                {(product.stockQuantity || 0) + (parseInt(form.quantity) || 0)} units
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-black">Total Cost:</span>
              <span className="font-bold text-blue-700">
                KES {((parseInt(form.quantity) || 0) * (parseFloat(form.costPrice) || 0)).toLocaleString()}
              </span>
            </div>
            {form.paymentSource === "CREDIT" && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-black">Payment:</span>
                <span className="font-medium text-amber-700">
                  {form.isNewCreditor 
                    ? `New Creditor: ${form.newCreditorName || 'Unnamed'}` 
                    : `Credit - ${creditors.find((c: Creditor) => c.id === parseInt(form.creditorId))?.name || 'Selected'}`
                  }
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-slate-200 p-4 bg-white rounded-b-2xl">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-3 border-2 border-slate-300 text-black rounded-xl hover:bg-slate-50 font-medium text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                submitting || 
                !form.quantity || 
                !form.costPrice || 
                (form.paymentSource === "CREDIT" && !form.isNewCreditor && !form.creditorId) ||
                (form.paymentSource === "CREDIT" && form.isNewCreditor && !form.newCreditorName)
              }
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 font-medium text-sm flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Restocking...
                </>
              ) : (
                <>
                  <PackagePlus className="w-5 h-5" />
                  Restock Product
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Component
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
  const [showQuickRestock, setShowQuickRestock] = useState(false);
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch creditors
  const fetchCreditors = useCallback(async () => {
    try {
      const response = await fetch("/api/creditors");
      if (response.ok) {
        const data = await response.json();
        setCreditors(data);
      }
    } catch (error) {
      console.error("Error fetching creditors:", error);
    }
  }, []);

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
        
        productsData = productsData.map(product => {
          const totalStock = product.stock?.reduce((sum, s) => sum + s.quantity, 0) || 0;
          return {
            ...product,
            stockQuantity: totalStock,
            avgCostPrice: product.stock?.reduce((sum, s) => sum + (s.costPrice * s.quantity), 0) / 
                          (product.stock?.reduce((sum, s) => sum + s.quantity, 0) || 1) || 0
          };
        });
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
      
      const productsWithAssignment = productsData.map(product => {
        const assignedQty = inventoryData
          .filter(a => a.productId === product.id && a.status !== 'COMPLETED')
          .reduce((sum, a) => sum + (a.quantityGiven - a.quantitySold - a.quantityReturned), 0);
        
        return {
          ...product,
          assignedQuantity: assignedQty,
          availableQuantity: Math.max(0, product.stockQuantity - assignedQty)
        };
      });
      
      setProducts(productsWithAssignment);
      setInventoryAssignments(inventoryData);
      setFilteredAssignments(inventoryData);

      // Also fetch creditors
      await fetchCreditors();

    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [fetchCreditors]);

  const calculateAssignmentStatus = (assignment: any): StaffInventory['status'] => {
    const remaining = (assignment.quantityGiven || 0) - 
                     (assignment.quantitySold || 0) - 
                     (assignment.quantityReturned || 0);
    
    if (remaining === 0) return 'COMPLETED';
    
    const now = new Date();
    const weekEnd = assignment.weekEndDate ? new Date(assignment.weekEndDate) : null;
    
    if (weekEnd && now > weekEnd) {
      return 'OVERDUE';
    }
    
    if (assignment.quantitySold === 0) return 'PENDING';
    return 'ACTIVE';
  };

  // Handle restock from within assignment using the restock API
  const handleQuickRestock = async (restockData: RestockForm): Promise<boolean> => {
    try {
      const totalCost = parseInt(restockData.quantity) * parseFloat(restockData.costPrice);
      
      // Prepare request body to match API expectations
      const requestBody: any = {
        productId: parseInt(restockData.productId.toString()),
        quantity: parseInt(restockData.quantity),
        totalCost: totalCost,
        paymentSource: restockData.paymentSource.toLowerCase(), // API expects "cash" or "credit"
      };

      // Handle creditor logic based on API expectations
      if (restockData.paymentSource === "CREDIT") {
        if (restockData.isNewCreditor) {
          // For new creditor, send the name, phone, email directly
          requestBody.creditorName = restockData.newCreditorName;
          requestBody.creditorPhone = restockData.newCreditorPhone || "";
          requestBody.creditorEmail = restockData.newCreditorEmail || "";
        } else if (restockData.creditorId) {
          // For existing creditor, find the creditor in the list
          const selectedCreditor = creditors.find((c: Creditor) => c.id === parseInt(restockData.creditorId));
          if (selectedCreditor) {
            requestBody.creditorName = selectedCreditor.name;
            requestBody.creditorPhone = selectedCreditor.phone || "";
            requestBody.creditorEmail = selectedCreditor.email || "";
          } else {
            throw new Error("Selected creditor not found");
          }
        } else {
          throw new Error("Please select a creditor or add a new one");
        }
      }

      console.log("Sending restock request:", requestBody);

      // Create the restock record
      const response = await fetch("/api/restock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to restock");
      }

      const result = await response.json();

      let successMessage = `✅ Restocked ${restockData.quantity} units of ${restockData.productName}`;
      if (restockData.paymentSource === "CREDIT") {
        const creditorName = restockData.isNewCreditor ? restockData.newCreditorName : 
                           (restockData.creditorId ? creditors.find((c: Creditor) => c.id === parseInt(restockData.creditorId))?.name : "");
        successMessage += ` on credit from ${creditorName || 'creditor'}`;
        successMessage += ` (Added KES ${totalCost.toLocaleString()} to balance)`;
      }
      
      setSuccess(successMessage);
      setTimeout(() => setSuccess(null), 3000);
      
      // Refresh data to update stock levels and creditor balances
      await fetchData();
      
      return true;
    } catch (err: any) {
      console.error("Restock error:", err);
      setError(err.message || "Failed to restock");
      setTimeout(() => setError(null), 5000);
      return false;
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let filtered = [...inventoryAssignments];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(assignment =>
        assignment.staff?.name?.toLowerCase().includes(term) ||
        assignment.product?.name?.toLowerCase().includes(term) ||
        assignment.product?.sku?.toLowerCase().includes(term) ||
        (assignment.product?.category?.toLowerCase() || '').includes(term)
      );
    }

    if (activeFilter !== 'all') {
      filtered = filtered.filter(assignment => 
        assignment.status === activeFilter.toUpperCase()
      );
    }

    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch(sortBy) {
        case 'staff':
          aVal = a.staff?.name?.toLowerCase() || '';
          bVal = b.staff?.name?.toLowerCase() || '';
          break;
        case 'week':
          aVal = new Date(a.weekStartDate || '').getTime();
          bVal = new Date(b.weekStartDate || '').getTime();
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
          aVal = new Date(a.weekStartDate || '').getTime();
          bVal = new Date(b.weekStartDate || '').getTime();
      }

      return bVal - aVal;
    });

    setFilteredAssignments(filtered);
  }, [searchTerm, activeFilter, inventoryAssignments, sortBy]);

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
    
    const currentWeekAssignments = assignments.filter(inv => inv.isCurrentWeek).length;
    const currentWeekSales = assignments
      .filter(inv => inv.isCurrentWeek)
      .reduce((sum, inv) => sum + inv.quantitySold, 0);
    const currentWeekReturns = assignments
      .filter(inv => inv.isCurrentWeek)
      .reduce((sum, inv) => sum + inv.quantityReturned, 0);
    
    const staffIds = new Set(assignments.map(inv => inv.staffId));
    const productIds = new Set(assignments.map(inv => inv.productId));

    const completionRates = assignments
      .filter(inv => inv.quantityGiven > 0)
      .map(inv => ((inv.quantitySold + inv.quantityReturned) / inv.quantityGiven) * 100);
    const averageCompletionRate = completionRates.length > 0 
      ? completionRates.reduce((sum, rate) => sum + rate, 0) / completionRates.length 
      : 0;

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

  const getTotalStock = (productId: number): number => {
    const product = products.find(p => p.id === productId);
    return product?.stockQuantity || 0;
  };

  const getAssignedStock = (productId: number, weekStartDate?: string): number => {
    const targetWeekStart = weekStartDate || form.weekStartDate;
    
    const totalAssigned = inventoryAssignments
      .filter(inv => {
        if (inv.productId !== productId) return false;
        if (inv.status === 'COMPLETED') return false;
        
        if (targetWeekStart && inv.weekStartDate) {
          return inv.weekStartDate === targetWeekStart;
        }
        
        const weekEnd = inv.weekEndDate ? new Date(inv.weekEndDate) : null;
        return weekEnd && new Date() <= weekEnd;
      })
      .reduce((sum, inv) => {
        const remaining = (inv.quantityGiven || 0) - (inv.quantitySold || 0) - (inv.quantityReturned || 0);
        return sum + remaining;
      }, 0);

    return totalAssigned;
  };

  const getAvailableStock = (productId: number, weekStartDate?: string): number => {
    const totalStock = getTotalStock(productId);
    const assignedStock = getAssignedStock(productId, weekStartDate);
    return Math.max(0, totalStock - assignedStock);
  };

  const handleBulkProductSelect = (selectedProducts: Product[]) => {
    const newItems: AssignmentItem[] = selectedProducts.map(product => ({
      productId: product.id.toString(),
      quantity: "1",
      product
    }));
    
    const existingIds = new Set(form.items.map(item => item.productId));
    const itemsToAdd = newItems.filter(item => !existingIds.has(item.productId));
    
    setForm(prev => ({ ...prev, items: [...prev.items, ...itemsToAdd] }));
    setSuccess(`Added ${itemsToAdd.length} products to assignment`);
    setTimeout(() => setSuccess(null), 3000);
  };

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

  const updateItemQuantity = (index: number, newQuantity: number) => {
    const newItems = [...form.items];
    newItems[index].quantity = newQuantity.toString();
    setForm({ ...form, items: newItems });
  };

  const removeItemFromForm = (index: number) => {
    const newItems = form.items.filter((_, i) => i !== index);
    setForm({ ...form, items: newItems });
  };

  const setAllQuantitiesToMax = () => {
    const newItems = form.items.map(item => {
      const availableStock = getAvailableStock(parseInt(item.productId), form.weekStartDate);
      return {
        ...item,
        quantity: Math.max(1, availableStock).toString()
      };
    });
    setForm({ ...form, items: newItems });
    setSuccess("Set all quantities to maximum available");
    setTimeout(() => setSuccess(null), 3000);
  };

  const setAllQuantitiesToOne = () => {
    const newItems = form.items.map(item => ({
      ...item,
      quantity: "1"
    }));
    setForm({ ...form, items: newItems });
    setSuccess("Set all quantities to 1");
    setTimeout(() => setSuccess(null), 3000);
  };

  const clearAllItems = () => {
    setForm(prev => ({ ...prev, items: [] }));
    setSuccess("Cleared all items");
    setTimeout(() => setSuccess(null), 3000);
  };

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
          const availableStock = getAvailableStock(parseInt(item.productId), form.weekStartDate);
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
      const batchItems: BatchAssignmentItem[] = form.items
        .filter(item => item.productId && item.quantity)
        .map(item => ({
          productId: parseInt(item.productId),
          quantityGiven: parseInt(item.quantity)
        }));

      const response = await fetch("/api/staff-inventory/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: parseInt(form.staffId),
          items: batchItems,
          weekStartDate: form.weekStartDate,
          weekEndDate: form.weekEndDate,
          notes: form.notes,
          priority: form.priority
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to assign inventory");
      }

      const result = await response.json();

      setForm({ 
        staffId: "", 
        items: [],
        weekStartDate: currentWeek.weekStartDate,
        weekEndDate: currentWeek.weekEndDate,
        notes: "",
        priority: 'MEDIUM'
      });
      setShowAssignModal(false);
      
      setSuccess(`✅ Successfully assigned ${batchItems.length} items for the week!`);
      
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
      const promises = validItems.map(item =>
        fetch(`/api/staff-inventory/${item.assignmentId}/return`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantityReturned: parseInt(item.quantityReturned)
          })
        })
      );

      const responses = await Promise.all(promises);
      const errors = responses.filter(res => !res.ok);
      if (errors.length > 0) {
        throw new Error(`Failed to return ${errors.length} items`);
      }

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

  const handleCompleteAssignment = async (assignmentId: number) => {
    if (!confirm("Are you sure you want to complete this assignment?")) return;

    try {
      const assignment = inventoryAssignments.find(a => a.id === assignmentId);
      if (!assignment) throw new Error("Assignment not found");

      const remaining = assignment.quantityGiven - assignment.quantitySold - assignment.quantityReturned;
      
      if (remaining > 0) {
        const response = await fetch(`/api/staff-inventory/${assignmentId}/return`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantityReturned: remaining })
        });

        if (!response.ok) throw new Error("Failed to complete assignment");
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

  const handleCloseWeek = async (staffId?: number) => {
    let message = staffId ? "Close current week for this staff?" : "Close current week for all staff?";
    if (!confirm(message)) return;

    try {
      let url = "/api/staff/close-week";
      if (staffId) url = `/api/staff/${staffId}/close-week`;

      const response = await fetch(url, { method: 'POST' });

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

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'ACTIVE': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'COMPLETED': return 'bg-green-100 text-green-800 border border-green-200';
      case 'OVERDUE': return 'bg-red-100 text-red-800 border border-red-200';
      case 'PENDING': return 'bg-amber-100 text-amber-800 border border-amber-200';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border border-orange-200';
      case 'MEDIUM': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'LOW': return 'bg-slate-100 text-slate-800 border border-slate-200';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const openReturnModal = (staff: Staff) => {
    setSelectedStaff(staff);
    
    const staffAssignments = inventoryAssignments.filter(
      inv => inv.staffId === staff.id && inv.status !== 'COMPLETED' && inv.isCurrentWeek
    );
    
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

  const excludedProductIds = useMemo(() => {
    return form.items.map(item => parseInt(item.productId)).filter(id => !isNaN(id));
  }, [form.items]);

  const stats = calculateStats();

  const AssignmentCard = ({ assignment }: { assignment: StaffInventory }) => {
    const remaining = assignment.quantityGiven - assignment.quantitySold - assignment.quantityReturned;
    const weekRange = assignment.weekStartDate && assignment.weekEndDate 
      ? formatWeekRange(assignment.weekStartDate, assignment.weekEndDate)
      : 'No week';

    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="font-semibold text-black">{assignment.staff?.name}</div>
              <div className="text-xs text-black">{weekRange}</div>
            </div>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
            {assignment.status}
          </span>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-black">{assignment.product?.name}</div>
              {assignment.product?.sku && (
                <div className="text-xs text-black font-mono">{assignment.product.sku}</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div>
              <div className="text-xs text-black">Given</div>
              <div className="font-bold text-black">{assignment.quantityGiven}</div>
            </div>
            <div>
              <div className="text-xs text-black">Sold</div>
              <div className="font-bold text-emerald-700">{assignment.quantitySold}</div>
            </div>
            <div>
              <div className="text-xs text-black">Left</div>
              <div className="font-bold text-blue-700">{remaining}</div>
            </div>
          </div>

          <div className="flex gap-2">
            {remaining > 0 && assignment.isCurrentWeek && (
              <button
                onClick={() => openReturnModal(assignment.staff)}
                className="flex-1 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium"
              >
                Return
              </button>
            )}
            <button
              onClick={() => handleCompleteAssignment(assignment.id)}
              className="flex-1 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium"
            >
              Complete
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-2 md:p-4">
      {/* Mobile Header */}
      <div className="md:hidden mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-xl bg-white shadow-sm"
            >
              <Menu className="w-5 h-5 text-black" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-black">Staff Inventory</h1>
              <p className="text-xs text-black">Weekly assignments</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchData}
              className="p-2 bg-white rounded-xl shadow-sm"
            >
              <RefreshCw className="w-4 h-4 text-black" />
            </button>
            <button
              onClick={() => setShowAssignModal(true)}
              className="p-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl shadow-sm"
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
              <h1 className="text-2xl font-bold text-black">Weekly Staff Inventory Management</h1>
              <p className="text-black">Assign and track products with staff members on a weekly basis</p>
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
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all text-black font-medium group"
          >
            <RefreshCw className="w-4 h-4 transition-transform group-hover:rotate-180" />
            Refresh
          </button>
          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-2.5 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg font-medium"
          >
            <Plus className="w-5 h-5" />
            Assign Inventory
          </button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100 shadow-sm p-3 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-black mb-1">Current Week</p>
              <p className="text-xl md:text-2xl font-bold text-blue-700">{stats.currentWeekAssignments}</p>
              <p className="text-xs text-black mt-1 hidden md:block">Active assignments</p>
            </div>
            <div className="p-2 md:p-3 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50">
              <CalendarDays className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-100 shadow-sm p-3 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-black mb-1">Week Sales</p>
              <p className="text-xl md:text-2xl font-bold text-emerald-700">{stats.currentWeekSales}</p>
              <p className="text-xs text-black mt-1 hidden md:block">Items sold</p>
            </div>
            <div className="p-2 md:p-3 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50">
              <ShoppingBag className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-white rounded-2xl border border-green-100 shadow-sm p-3 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-black mb-1">Sales Value</p>
              <p className="text-lg md:text-2xl font-bold text-green-700">
                KES {(stats.totalSalesValue / 1000).toFixed(1)}K
              </p>
              <p className="text-xs text-black mt-1 hidden md:block">Total sales</p>
            </div>
            <div className="p-2 md:p-3 rounded-xl bg-gradient-to-br from-green-100 to-green-50">
              <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl border border-amber-100 shadow-sm p-3 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-black mb-1">Sell-through</p>
              <p className="text-xl md:text-2xl font-bold text-amber-700">
                {stats.averageCompletionRate.toFixed(1)}%
              </p>
              <p className="text-xs text-black mt-1 hidden md:block">Weekly average</p>
            </div>
            <div className="p-2 md:p-3 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50">
              <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 md:p-4 mb-4">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-black" />
            <input
              type="text"
              placeholder="Search staff, product, SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 text-sm text-black"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-black" />
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as any)}
                className="px-3 py-1.5 border-2 border-slate-300 rounded-xl bg-white text-sm text-black"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 ml-auto">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
              >
                <List className="w-4 h-4 text-black" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg ${viewMode === 'cards' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
              >
                <Grid className="w-4 h-4 text-black" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 bg-gradient-to-r from-red-50 to-red-50/50 border-l-4 border-red-500 text-red-800 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
          <div className="flex-1 text-sm">{error}</div>
          <button onClick={() => setError(null)} className="text-red-800">
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-gradient-to-r from-emerald-50 to-emerald-50/50 border-l-4 border-emerald-500 text-emerald-800 p-4 rounded-xl flex items-start gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
          <div className="flex-1 text-sm">{success}</div>
          <button onClick={() => setSuccess(null)} className="text-emerald-800">
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
          <p className="mt-4 text-black font-medium">Loading inventory assignments...</p>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
            <CalendarDays className="w-10 h-10 text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-black mb-2">No assignments found</h3>
          <p className="text-black mb-6 max-w-md mx-auto">
            {searchTerm ? "No results match your search." : "Get started by assigning products to your staff."}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowAssignModal(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-xl font-medium"
            >
              <Plus className="w-5 h-5" />
              Start Assigning
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 md:p-4">
          {isMobile || viewMode === 'cards' ? (
            <div>
              {filteredAssignments.map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-slate-50 to-slate-100/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-black">Staff</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-black">Week</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-black">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-black">Quantity</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-black">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-black">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAssignments.map((assignment) => {
                    const remaining = assignment.quantityGiven - assignment.quantitySold - assignment.quantityReturned;
                    const weekRange = assignment.weekStartDate && assignment.weekEndDate 
                      ? formatWeekRange(assignment.weekStartDate, assignment.weekEndDate)
                      : 'No week';

                    return (
                      <tr key={assignment.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                              <User className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium text-black text-sm">{assignment.staff?.name}</div>
                              {assignment.staff?.phone && (
                                <div className="text-xs text-black">{assignment.staff.phone}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-black">{weekRange}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-black text-sm">{assignment.product?.name}</div>
                          {assignment.product?.sku && (
                            <div className="text-xs text-black font-mono">{assignment.product.sku}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <div className="text-xs text-black">Given</div>
                              <div className="font-bold text-black">{assignment.quantityGiven}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-black">Sold</div>
                              <div className="font-bold text-emerald-700">{assignment.quantitySold}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-black">Left</div>
                              <div className="font-bold text-blue-700">{remaining}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                              {assignment.status}
                            </span>
                            {assignment.priority && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(assignment.priority)}`}>
                                {assignment.priority}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {remaining > 0 && assignment.isCurrentWeek && (
                              <button
                                onClick={() => openReturnModal(assignment.staff)}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg"
                                title="Return"
                              >
                                <Package className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleCompleteAssignment(assignment.id)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
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
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 text-center text-black text-sm">
        <p>© {new Date().getFullYear()} Swift Metals POS • Weekly Staff Inventory Management</p>
        <p className="text-xs mt-1">Total assignments: {stats.totalAssignments} • Current week: {formatWeekRange(currentWeek.weekStartDate, currentWeek.weekEndDate)}</p>
      </div>

      {/* Modals */}
      <ProductSearchModal
        isOpen={showProductSearch}
        onClose={() => setShowProductSearch(false)}
        onSelect={handleProductSelect}
        onSelectBulk={handleBulkProductSelect}
        products={products}
        excludedIds={excludedProductIds}
        bulkMode={true}
      />

      <QuickRestockModal
        isOpen={showQuickRestock}
        onClose={() => {
          setShowQuickRestock(false);
          setRestockProduct(null);
        }}
        onRestock={handleQuickRestock}
        product={restockProduct}
        creditors={creditors}
        onRefreshCreditors={fetchCreditors}
      />

      {/* Assign Inventory Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-2 md:p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-bold">Assign Products for Week</h2>
                    <p className="text-blue-100 text-sm">Select multiple products - Restock directly from here</p>
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
                  className="p-2 hover:bg-white/20 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Select Staff *</label>
                <select
                  value={form.staffId}
                  onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-500 text-sm text-black"
                  disabled={submitting}
                >
                  <option value="">Choose staff...</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} {staff.phone && `(${staff.phone})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-black mb-2">Week Dates *</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-black mb-1">Start (Monday)</div>
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
                      className="w-full px-3 py-2 border-2 border-slate-300 rounded-xl text-sm text-black"
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-black mb-1">End (Sunday)</div>
                    <input
                      type="date"
                      value={form.weekEndDate}
                      onChange={(e) => setForm({ ...form, weekEndDate: e.target.value })}
                      min={form.weekStartDate}
                      className="w-full px-3 py-2 border-2 border-slate-300 rounded-xl text-sm text-black"
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-black mb-2">Add Products</label>
                <button
                  type="button"
                  onClick={() => setShowProductSearch(true)}
                  disabled={submitting}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  Browse & Select Products
                </button>
                <p className="text-xs text-black mt-2">💡 Select multiple products at once. Need more stock? Click the restock button on any product card.</p>
              </div>

              {form.items.length > 0 && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <label className="text-sm font-semibold text-black">
                        Selected ({form.items.length})
                      </label>
                      <p className="text-xs text-black">
                        Total items: {form.items.reduce((sum, item) => sum + parseInt(item.quantity), 0)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={setAllQuantitiesToOne}
                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs"
                      >
                        Set 1
                      </button>
                      <button
                        type="button"
                        onClick={setAllQuantitiesToMax}
                        className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs"
                      >
                        Set Max
                      </button>
                      <button
                        type="button"
                        onClick={clearAllItems}
                        className="px-2 py-1 bg-red-100 text-red-800 rounded-lg text-xs"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto">
                    {form.items.map((item, index) => {
                      const product = item.product!;
                      const totalStock = getTotalStock(parseInt(item.productId));
                      const assignedStock = getAssignedStock(parseInt(item.productId), form.weekStartDate);
                      const availableStock = getAvailableStock(parseInt(item.productId), form.weekStartDate);
                      
                      return (
                        <ProductSelectionCard
                          key={index}
                          product={product}
                          onRemove={() => removeItemFromForm(index)}
                          quantity={parseInt(item.quantity)}
                          onQuantityChange={(qty) => updateItemQuantity(index, qty)}
                          availableStock={availableStock}
                          totalStock={totalStock}
                          assignedStock={assignedStock}
                          onSetMax={() => {
                            const maxStock = getAvailableStock(parseInt(item.productId), form.weekStartDate);
                            updateItemQuantity(index, Math.max(1, maxStock));
                          }}
                          onSetMin={() => updateItemQuantity(index, 1)}
                          onRestock={() => {
                            setRestockProduct(product);
                            setShowQuickRestock(true);
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {form.items.length === 0 && (
                <div className="bg-gradient-to-r from-slate-50 to-blue-50/50 rounded-xl p-6 text-center border border-slate-200">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="font-medium text-black mb-2">No products selected</h4>
                  <p className="text-sm text-black mb-4">
                    Click "Browse & Select Products" to add products in bulk.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowProductSearch(true)}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-medium"
                  >
                    <Search className="w-4 h-4 inline mr-2" />
                    Select Products
                  </button>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-black mb-2">Priority Level</label>
                <div className="grid grid-cols-4 gap-2">
                  {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(priority => (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => setForm({ ...form, priority: priority as any })}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        form.priority === priority 
                        ? getPriorityColor(priority) + ' border-blue-500' 
                        : 'border-2 border-slate-200'
                      }`}
                    >
                      {priority}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-black mb-2">Notes (Optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Add any special instructions or notes for this assignment..."
                  rows={2}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-500 text-sm text-black"
                  disabled={submitting}
                />
              </div>

              {form.items.length > 0 && (
                <div className="bg-gradient-to-r from-slate-50 to-blue-50/50 rounded-xl p-3">
                  <h4 className="font-semibold text-black mb-2 text-sm">Summary</h4>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-xs text-black">Products</div>
                      <div className="text-lg font-bold text-black">{form.items.length}</div>
                    </div>
                    <div>
                      <div className="text-xs text-black">Total Items</div>
                      <div className="text-lg font-bold text-black">
                        {form.items.reduce((sum, item) => sum + parseInt(item.quantity), 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-black">Total Value</div>
                      <div className="text-lg font-bold text-green-700">
                        KES {form.items.reduce((sum, item) => sum + ((item.product?.price || 0) * parseInt(item.quantity)), 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 border-t border-slate-200 p-4 bg-white rounded-b-2xl">
              <div className="flex gap-3">
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
                  className="flex-1 px-4 py-3 border-2 border-slate-300 rounded-xl font-medium text-sm text-black"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignInventory}
                  disabled={submitting || !form.staffId || form.items.length === 0}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Assigning...
                    </>
                  ) : (
                    <>
                      <CalendarDays className="w-4 h-4" />
                      Assign {form.items.length} Product{form.items.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && selectedStaff && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-2 md:p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-amber-500 to-orange-600 text-white p-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Return Inventory</h2>
                    <p className="text-amber-100 text-sm">Return from {selectedStaff.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowReturnModal(false);
                    setSelectedStaff(null);
                    setReturnForm({ items: [], notes: "" });
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {returnForm.items.map((item, index) => (
                <div key={item.assignmentId} className="border-2 border-slate-200 rounded-xl p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium text-black text-sm">{item.productName}</div>
                      <div className="text-xs text-black">Max: {item.maxReturnable}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newItems = [...returnForm.items];
                        newItems[index].quantityReturned = item.maxReturnable.toString();
                        setReturnForm({ ...returnForm, items: newItems });
                      }}
                      className="px-2 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs"
                    >
                      Max
                    </button>
                  </div>
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
                    className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-center text-sm text-black"
                  />
                </div>
              ))}

              <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-black">Total to Return</div>
                    <div className="text-xs text-black">
                      {returnForm.items.filter(i => parseInt(i.quantityReturned) > 0).length} items
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-amber-700">
                    {returnForm.items.reduce((sum, i) => sum + parseInt(i.quantityReturned), 0)}
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-slate-200 p-4 bg-white rounded-b-2xl">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowReturnModal(false);
                    setSelectedStaff(null);
                    setReturnForm({ items: [], notes: "" });
                  }}
                  className="flex-1 px-4 py-3 border-2 border-slate-300 rounded-xl font-medium text-sm text-black"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReturnInventory}
                  disabled={submitting || returnForm.items.every(i => parseInt(i.quantityReturned) === 0)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium text-sm disabled:opacity-50"
                >
                  {submitting ? "Processing..." : "Return Items"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}