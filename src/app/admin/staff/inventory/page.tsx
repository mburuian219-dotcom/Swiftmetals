"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Smartphone,
  Tablet,
  Monitor
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
}

interface Staff {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

interface StaffInventory {
  id: number;
  staffId: number;
  productId: number;
  quantityGiven: number;
  quantitySold: number;
  quantityReturned: number;
  staff: Staff;
  product: Product;
  createdAt: string;
  updatedAt: string;
  assignmentDate: string;
  dueDate: string;
  status: 'ACTIVE' | 'COMPLETED' | 'OVERDUE';
  totalSalesAmount: number;
}

interface AssignmentItem {
  productId: string;
  quantity: string;
  product?: Product;
}

interface AssignmentForm {
  staffId: string;
  items: AssignmentItem[];
  assignmentDate: string;
  dueDate: string;
  notes?: string;
}

interface ReturnForm {
  items: {
    assignmentId: number;
    quantityReturned: string;
    productName: string;
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
  staffWithInventory: number;
  totalProductsAssigned: number;
}

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
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [form, setForm] = useState<AssignmentForm>({
    staffId: "",
    items: [{ productId: "", quantity: "" }],
    assignmentDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: ""
  });
  const [returnForm, setReturnForm] = useState<ReturnForm>({
    items: [],
    notes: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'completed' | 'overdue'>('all');
  const [expandedAssignment, setExpandedAssignment] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'staff' | 'dueDate' | 'totalValue'>('staff');
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');
  const [mobileView, setMobileView] = useState<'list' | 'details'>('list');
  const [selectedAssignment, setSelectedAssignment] = useState<StaffInventory | null>(null);

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
        inventoryData = rawData.map((assignment: any) => ({
          ...assignment,
          assignmentDate: assignment.assignmentDate || assignment.createdAt,
          dueDate: assignment.dueDate || new Date(new Date(assignment.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: calculateAssignmentStatus(assignment),
          totalSalesAmount: (assignment.quantitySold || 0) * (assignment.product?.price || 0)
        }));
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

  // Helper to calculate assignment status
  const calculateAssignmentStatus = (assignment: any): 'ACTIVE' | 'COMPLETED' | 'OVERDUE' => {
    const remaining = (assignment.quantityGiven || 0) - 
                     (assignment.quantitySold || 0) - 
                     (assignment.quantityReturned || 0);
    
    if (remaining === 0) return 'COMPLETED';
    
    const dueDate = new Date(assignment.dueDate || new Date(new Date(assignment.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000));
    const now = new Date();
    
    if (dueDate < now) return 'OVERDUE';
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
        (assignment.product?.category?.toLowerCase() || '').includes(term)
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
        case 'dueDate':
          aVal = new Date(a.dueDate).getTime();
          bVal = new Date(b.dueDate).getTime();
          break;
        case 'totalValue':
          aVal = a.totalSalesAmount || 0;
          bVal = b.totalSalesAmount || 0;
          break;
        default:
          aVal = a.staff?.name?.toLowerCase() || '';
          bVal = b.staff?.name?.toLowerCase() || '';
      }

      return aVal > bVal ? 1 : -1;
    });

    setFilteredAssignments(filtered);
  }, [searchTerm, activeFilter, inventoryAssignments, sortBy]);

  // Calculate comprehensive stats
  const calculateStats = (): AssignmentStats => {
    const assignments = inventoryAssignments;
    const totalItemsGiven = assignments.reduce((sum, inv) => sum + (inv.quantityGiven || 0), 0);
    const totalItemsSold = assignments.reduce((sum, inv) => sum + (inv.quantitySold || 0), 0);
    const totalItemsReturned = assignments.reduce((sum, inv) => sum + (inv.quantityReturned || 0), 0);
    const totalItemsRemaining = totalItemsGiven - totalItemsSold - totalItemsReturned;
    const totalSalesValue = assignments.reduce((sum, inv) => sum + (inv.totalSalesAmount || 0), 0);
    
    const activeAssignments = assignments.filter(inv => inv.status === 'ACTIVE');
    const completedAssignments = assignments.filter(inv => inv.status === 'COMPLETED');
    const overdueAssignments = assignments.filter(inv => inv.status === 'OVERDUE');
    
    // Count unique staff and products
    const staffIds = new Set(assignments.map(inv => inv.staffId));
    const productIds = new Set(assignments.map(inv => inv.productId));

    return { 
      totalAssignments: assignments.length,
      totalItemsGiven, 
      totalItemsSold, 
      totalItemsReturned, 
      totalItemsRemaining,
      totalSalesValue,
      activeAssignments: activeAssignments.length,
      completedAssignments: completedAssignments.length,
      overdueAssignments: overdueAssignments.length,
      staffWithInventory: staffIds.size,
      totalProductsAssigned: productIds.size
    };
  };

  // Get available stock for a product
  const getAvailableStock = (productId: number): number => {
    const product = products.find(p => p.id === productId);
    return product?.stockQuantity || 0;
  };

  // Get remaining stock after considering current active assignments
  const getRemainingStockAfterAssignments = (productId: number): number => {
    const totalAssigned = inventoryAssignments
      .filter(inv => inv.productId === productId && inv.status === 'ACTIVE')
      .reduce((sum, inv) => {
        const remaining = (inv.quantityGiven || 0) - (inv.quantitySold || 0) - (inv.quantityReturned || 0);
        return sum + remaining;
      }, 0);

    const availableStock = getAvailableStock(productId);
    return Math.max(0, availableStock - totalAssigned);
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

  // Handle adding new item to assignment form
  const handleAddItem = () => {
    setForm({
      ...form,
      items: [...form.items, { productId: "", quantity: "" }]
    });
  };

  // Handle removing item from assignment form
  const handleRemoveItem = (index: number) => {
    if (form.items.length <= 1) return;
    const newItems = form.items.filter((_, i) => i !== index);
    setForm({ ...form, items: newItems });
  };

  // Handle item change in assignment form
  const handleItemChange = (index: number, field: 'productId' | 'quantity', value: string) => {
    const newItems = [...form.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // If product is selected, add product info
    if (field === 'productId' && value) {
      const product = products.find(p => p.id === parseInt(value));
      if (product) {
        newItems[index].product = product;
        // Suggest available quantity
        const available = getRemainingStockAfterAssignments(parseInt(value));
        if (available > 0 && !newItems[index].quantity) {
          newItems[index].quantity = "1";
        }
      }
    }
    
    setForm({ ...form, items: newItems });
  };

  // Validate assignment form
  const validateAssignment = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!form.staffId) errors.push("Please select a staff member");
    
    let hasValidItems = false;
    form.items.forEach((item, index) => {
      if (item.productId && item.quantity) {
        const quantity = parseInt(item.quantity);
        if (isNaN(quantity) || quantity <= 0) {
          errors.push(`Item ${index + 1}: Quantity must be a positive number`);
        } else {
          const availableStock = getRemainingStockAfterAssignments(parseInt(item.productId));
          if (quantity > availableStock) {
            errors.push(`Item ${index + 1}: Only ${availableStock} units available`);
          }
        }
        hasValidItems = true;
      }
    });

    if (!hasValidItems) errors.push("Please add at least one item with quantity");
    if (!form.dueDate) errors.push("Please select a due date");

    return { isValid: errors.length === 0, errors };
  };

  // Handle form submission - Assign inventory (send multiple individual requests)
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

      // Send multiple individual requests
      const results = [];
      for (const item of validItems) {
        const response = await fetch("/api/staff-inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staffId: parseInt(form.staffId),
            productId: item.productId,
            quantityGiven: item.quantityGiven,
            assignmentDate: form.assignmentDate,
            dueDate: form.dueDate,
            notes: form.notes
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
        items: [{ productId: "", quantity: "" }],
        assignmentDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: ""
      });
      setShowAssignModal(false);
      setSuccess(`Successfully assigned ${results.length} items to staff!`);

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

  // Handle inventory return (send individual return requests)
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
        const response = await fetch("/api/staff-inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: 'return',
            inventoryId: item.assignmentId,
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
    if (!confirm("Are you sure you want to complete this assignment? This will mark all remaining inventory as returned.")) return;

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
        const response = await fetch("/api/staff-inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: 'return',
            inventoryId: assignmentId,
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

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'ACTIVE': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'COMPLETED': return 'bg-green-100 text-green-800 border border-green-200';
      case 'OVERDUE': return 'bg-red-100 text-red-800 border border-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Calculate days remaining
  const calculateDaysRemaining = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
      inv => inv.staffId === staff.id && inv.status === 'ACTIVE'
    );
    
    const returnItems = staffAssignments.map(assignment => {
      const remaining = (assignment.quantityGiven || 0) - 
                       (assignment.quantitySold || 0) - 
                       (assignment.quantityReturned || 0);
      
      return {
        assignmentId: assignment.id,
        quantityReturned: Math.min(remaining, 1).toString(),
        productName: assignment.product?.name || 'Product',
        remaining
      };
    }).filter(item => item.remaining > 0);
    
    if (returnItems.length === 0) {
      setError("No inventory to return for this staff");
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    setReturnForm({
      items: returnItems,
      notes: `Return for ${staff.name}`
    });
    setShowReturnModal(true);
  };

  // Stats calculation
  const stats = calculateStats();
  const staffAssignments = getStaffAssignments();

  // Mobile breakpoint
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-2 md:p-4">
      {/* Mobile Header */}
      <div className="md:hidden mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg bg-white shadow-sm"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-900">Staff Inventory</h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchData}
              className="p-2 rounded-lg bg-white shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAssignModal(true)}
              className="p-2 bg-blue-600 text-white rounded-lg shadow-sm"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        {/* Desktop Header */}
        <div className="hidden md:flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <Link 
              href="/admin/staff"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 mb-1 text-xs"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to Staff
            </Link>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Staff Inventory Management
            </h1>
            <p className="text-slate-600 text-xs">Assign products to staff members for sales</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchData}
              className="flex items-center gap-1 px-2 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-xs"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
            <button
              onClick={() => setShowAssignModal(true)}
              className="flex items-center gap-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-1.5 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow text-xs font-medium"
            >
              <Plus className="w-3 h-3" />
              Assign Inventory
            </button>
          </div>
        </div>

        {/* Mobile Stats Cards */}
        {isMobile ? (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-600">Active</p>
                  <p className="text-sm font-bold text-blue-600">{stats.activeAssignments}</p>
                </div>
                <div className="p-1 bg-blue-100 rounded">
                  <ClipboardList className="w-3 h-3 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-600">Stock</p>
                  <p className="text-sm font-bold text-purple-600">{stats.totalItemsRemaining}</p>
                </div>
                <div className="p-1 bg-purple-100 rounded">
                  <ShoppingBag className="w-3 h-3 text-purple-600" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Desktop Stats Cards
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600">Active Assignments</p>
                  <p className="text-lg font-bold text-blue-600">{stats.activeAssignments}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ClipboardList className="w-4 h-4 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600">Stock with Staff</p>
                  <p className="text-lg font-bold text-purple-600">{stats.totalItemsRemaining}</p>
                </div>
                <div className="p-2 bg-purple-100 rounded-lg">
                  <ShoppingBag className="w-4 h-4 text-purple-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600">Total Sales</p>
                  <p className="text-lg font-bold text-green-600">
                    KES {stats.totalSalesValue.toLocaleString()}
                  </p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600">Staff Active</p>
                  <p className="text-lg font-bold text-orange-600">{stats.staffWithInventory}</p>
                </div>
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Users className="w-4 h-4 text-orange-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filter Section */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 mb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff or product..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm"
              />
            </div>

            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-500" />
                <select
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value as any)}
                  className="px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                >
                  <option value="staff">Sort by Staff</option>
                  <option value="dueDate">Sort by Date</option>
                  <option value="totalValue">Sort by Value</option>
                </select>
              </div>

              {!isMobile && (
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
                  >
                    <ClipboardList className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setViewMode('cards')}
                    className={`p-1 rounded ${viewMode === 'cards' ? 'bg-white shadow-sm' : ''}`}
                  >
                    <Users className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg flex items-start gap-1 text-xs">
            <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
              <X size={12} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-3 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg flex items-start gap-1 text-xs">
            <CheckCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Mobile View - List */}
        {isMobile ? (
          mobileView === 'list' ? (
            <div className="space-y-2">
              {loading ? (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-3 text-slate-600 text-sm">Loading...</p>
                </div>
              ) : filteredAssignments.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-600 text-sm">No assignments found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {staffAssignments.map((group) => (
                    <div 
                      key={group.staff.id}
                      className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
                    >
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-900 text-sm">{group.staff.name}</h3>
                              {group.staff.phone && (
                                <p className="text-xs text-slate-500">{group.staff.phone}</p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => openReturnModal(group.staff)}
                            className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded"
                          >
                            Return
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                          <div className="bg-slate-50 p-2 rounded">
                            <p className="text-slate-600">Items</p>
                            <p className="font-bold">{group.assignments.length}</p>
                          </div>
                          <div className="bg-slate-50 p-2 rounded">
                            <p className="text-slate-600">Value</p>
                            <p className="font-bold text-green-600">KES {group.totalValue.toLocaleString()}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedAssignment(group.assignments[0]);
                            setMobileView('details');
                          }}
                          className="w-full text-xs text-blue-600 hover:text-blue-800 text-center pt-2 border-t border-slate-100"
                        >
                          View Details →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Mobile Details View */
            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
              <div className="p-3 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setMobileView('list')}
                    className="text-blue-600"
                  >
                    ← Back
                  </button>
                  <h3 className="font-semibold text-slate-900">Assignment Details</h3>
                  <div></div>
                </div>
              </div>
              
              {selectedAssignment && (
                <div className="p-3">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">{selectedAssignment.staff?.name}</h4>
                        <p className="text-xs text-slate-500">{selectedAssignment.staff?.phone}</p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 p-3 rounded-lg mb-3">
                      <p className="font-semibold text-sm mb-1">{selectedAssignment.product?.name}</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-slate-600">Given</p>
                          <p className="font-bold">{selectedAssignment.quantityGiven}</p>
                        </div>
                        <div>
                          <p className="text-slate-600">Sold</p>
                          <p className="font-bold text-green-600">{selectedAssignment.quantitySold}</p>
                        </div>
                        <div>
                          <p className="text-slate-600">Remaining</p>
                          <p className="font-bold text-blue-600">
                            {selectedAssignment.quantityGiven - selectedAssignment.quantitySold - selectedAssignment.quantityReturned}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Status:</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(selectedAssignment.status)}`}>
                          {selectedAssignment.status}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Due Date:</span>
                        <span className="font-medium">{new Date(selectedAssignment.dueDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Sales Value:</span>
                        <span className="font-medium text-green-600">
                          KES {selectedAssignment.totalSalesAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedAssignment(selectedAssignment);
                        setReturnForm({
                          items: [{
                            assignmentId: selectedAssignment.id,
                            quantityReturned: "1",
                            productName: selectedAssignment.product?.name || ''
                          }],
                          notes: ""
                        });
                        setShowReturnModal(true);
                      }}
                      className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm"
                    >
                      Return
                    </button>
                    <button
                      onClick={() => handleCompleteAssignment(selectedAssignment.id)}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm"
                    >
                      Complete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          /* Desktop View */
          viewMode === 'list' ? (
            // List View
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-3 text-slate-600">Loading assignments...</p>
                </div>
              ) : filteredAssignments.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600">No inventory assignments found</p>
                  {!searchTerm && (
                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="mt-3 inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-sm"
                    >
                      <Plus className="w-3 h-3" />
                      Create First Assignment
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 uppercase">
                          Staff
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 uppercase">
                          Product
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 uppercase">
                          Quantity
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 uppercase">
                          Progress
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 uppercase">
                          Due Date
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredAssignments.map((assignment) => {
                        const remaining = assignment.quantityGiven - assignment.quantitySold - assignment.quantityReturned;
                        const daysRemaining = calculateDaysRemaining(assignment.dueDate);
                        const progress = calculateSalesProgress(assignment);

                        return (
                          <tr key={assignment.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                                  <User className="w-3 h-3 text-blue-600" />
                                </div>
                                <div>
                                  <div className="font-medium">{assignment.staff?.name}</div>
                                  <div className="text-xs text-slate-500">{assignment.staff?.phone}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{assignment.product?.name}</div>
                              <div className="text-xs text-slate-500">
                                KES {assignment.product?.price?.toLocaleString()}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="text-xs">
                                <div className="flex justify-between">
                                  <span>Given:</span>
                                  <span className="font-medium">{assignment.quantityGiven}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Sold:</span>
                                  <span className="font-medium text-green-600">{assignment.quantitySold}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Left:</span>
                                  <span className="font-medium text-blue-600">{remaining}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="w-full bg-slate-200 rounded-full h-1.5">
                                <div 
                                  className="h-1.5 rounded-full bg-blue-500"
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                              <div className="text-xs text-slate-600 mt-0.5">
                                {progress.toFixed(0)}% sold
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="text-sm">{new Date(assignment.dueDate).toLocaleDateString()}</div>
                              <div className={`text-xs ${daysRemaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {daysRemaining > 0 ? `${daysRemaining}d left` : `${Math.abs(daysRemaining)}d overdue`}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                {remaining > 0 && (
                                  <button
                                    onClick={() => {
                                      setSelectedAssignment(assignment);
                                      setReturnForm({
                                        items: [{
                                          assignmentId: assignment.id,
                                          quantityReturned: "1",
                                          productName: assignment.product?.name || ''
                                        }],
                                        notes: ""
                                      });
                                      setShowReturnModal(true);
                                    }}
                                    className="p-1 text-orange-600 hover:bg-orange-50 rounded"
                                    title="Return"
                                  >
                                    <Package className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleCompleteAssignment(assignment.id)}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  title="Complete"
                                >
                                  <CheckSquare className="w-3 h-3" />
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
          ) : (
            // Cards View
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {staffAssignments.map((group) => (
                <div key={group.staff.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-3 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{group.staff.name}</h3>
                          <p className="text-xs text-slate-500">{group.staff.phone}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => openReturnModal(group.staff)}
                        className="text-xs bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700"
                      >
                        Return
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-3">
                    <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                      <div className="bg-slate-50 p-2 rounded">
                        <p className="text-xs text-slate-600">Assignments</p>
                        <p className="text-lg font-bold">{group.assignments.length}</p>
                      </div>
                      <div className="bg-slate-50 p-2 rounded">
                        <p className="text-xs text-slate-600">Sold</p>
                        <p className="text-lg font-bold text-green-600">
                          {group.assignments.reduce((sum, a) => sum + a.quantitySold, 0)}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-2 rounded">
                        <p className="text-xs text-slate-600">Value</p>
                        <p className="text-lg font-bold text-green-600">
                          KES {group.totalValue.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {group.assignments.slice(0, 3).map((assignment) => (
                        <div key={assignment.id} className="bg-slate-50 p-2 rounded">
                          <div className="flex justify-between items-start mb-1">
                            <div className="font-medium text-sm">{assignment.product?.name}</div>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${getStatusColor(assignment.status)}`}>
                              {assignment.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600">
                            {assignment.quantityGiven} given • {assignment.quantitySold} sold • {assignment.quantityGiven - assignment.quantitySold - assignment.quantityReturned} left
                          </div>
                        </div>
                      ))}
                      
                      {group.assignments.length > 3 && (
                        <div className="text-center text-xs text-blue-600">
                          +{group.assignments.length - 3} more items
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Footer */}
        <div className="mt-4 text-center text-slate-500 text-xs">
          <p>Staff Inventory Management • {new Date().getFullYear()} • Swift Metals POS</p>
        </div>
      </div>

      {/* Assign Inventory Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 md:p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3 md:p-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 md:w-6 md:h-6" />
                  <div>
                    <h2 className="text-lg md:text-xl font-bold">Assign Multiple Items</h2>
                    <p className="text-blue-100 text-xs">Assign multiple products to staff</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setForm({ 
                      staffId: "", 
                      items: [{ productId: "", quantity: "" }],
                      assignmentDate: new Date().toISOString().split('T')[0],
                      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                      notes: ""
                    });
                  }}
                  className="text-white hover:bg-white/20 p-1 rounded"
                >
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
            </div>

            <div className="p-3 md:p-4 space-y-3 md:space-y-4">
              {/* Staff Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Select Staff Member *
                </label>
                <select
                  value={form.staffId}
                  onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm"
                  disabled={submitting}
                >
                  <option value="">Choose staff member...</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} {staff.phone && `(${staff.phone})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Items List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-900">
                    Items to Assign *
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                  >
                    + Add Item
                  </button>
                </div>
                
                <div className="space-y-3">
                  {form.items.map((item, index) => (
                    <div key={index} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-700">Item #{index + 1}</span>
                        {form.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Product</label>
                          <select
                            value={item.productId}
                            onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-sm"
                            disabled={submitting}
                          >
                            <option value="">Select product...</option>
                            {products
                              .filter(product => getRemainingStockAfterAssignments(product.id) > 0)
                              .map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.name} (Available: {getRemainingStockAfterAssignments(product.id)})
                                </option>
                              ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Quantity</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="1"
                              max={item.productId ? getRemainingStockAfterAssignments(parseInt(item.productId)) : undefined}
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                              placeholder="Qty"
                              className="flex-1 px-2 py-1.5 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm"
                              disabled={submitting}
                            />
                            {item.productId && (
                              <span className="text-xs text-slate-500 self-center">
                                Max: {getRemainingStockAfterAssignments(parseInt(item.productId))}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {item.productId && (
                        <div className="mt-2 text-xs text-slate-600">
                          {item.product?.name} • KES {item.product?.price?.toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Date Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">
                    Assignment Date
                  </label>
                  <input
                    type="date"
                    value={form.assignmentDate}
                    onChange={(e) => setForm({ ...form, assignmentDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    min={form.assignmentDate}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm"
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Add any special instructions..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm"
                  disabled={submitting}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setForm({ 
                      staffId: "", 
                      items: [{ productId: "", quantity: "" }],
                      assignmentDate: new Date().toISOString().split('T')[0],
                      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                      notes: ""
                    });
                  }}
                  type="button"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignInventory}
                  type="button"
                  disabled={submitting || !form.staffId || form.items.every(item => !item.productId || !item.quantity)}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Assigning...
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4" />
                      Assign Items
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 md:p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-orange-700 text-white p-3 md:p-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 md:w-6 md:h-6" />
                  <div>
                    <h2 className="text-lg md:text-xl font-bold">Return Inventory</h2>
                    <p className="text-orange-100 text-xs">{selectedStaff.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowReturnModal(false);
                    setSelectedStaff(null);
                    setReturnForm({ items: [], notes: "" });
                  }}
                  className="text-white hover:bg-white/20 p-1 rounded"
                >
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
            </div>

            <div className="p-3 md:p-4 space-y-3 md:space-y-4">
              {/* Items to Return */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Select items to return
                </label>
                
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {returnForm.items.map((item, index) => (
                    <div key={index} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium text-sm">{item.productName}</div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={item.quantityReturned}
                          onChange={(e) => {
                            const newItems = [...returnForm.items];
                            newItems[index].quantityReturned = e.target.value;
                            setReturnForm({ ...returnForm, items: newItems });
                          }}
                          placeholder="Qty"
                          className="flex-1 px-2 py-1.5 border border-slate-300 rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-200 text-sm"
                          disabled={submitting}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const maxQty = inventoryAssignments.find(a => a.id === item.assignmentId);
                            if (maxQty) {
                              const remaining = maxQty.quantityGiven - maxQty.quantitySold - maxQty.quantityReturned;
                              const newItems = [...returnForm.items];
                              newItems[index].quantityReturned = remaining.toString();
                              setReturnForm({ ...returnForm, items: newItems });
                            }
                          }}
                          className="text-xs bg-orange-100 text-orange-700 px-2 py-1.5 rounded hover:bg-orange-200"
                        >
                          Max
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Return Notes (Optional)
                </label>
                <textarea
                  value={returnForm.notes}
                  onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                  placeholder="Add notes about the return..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-200 text-sm"
                  disabled={submitting}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3">
                <button
                  onClick={() => {
                    setShowReturnModal(false);
                    setSelectedStaff(null);
                    setReturnForm({ items: [], notes: "" });
                  }}
                  type="button"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReturnInventory}
                  type="button"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4" />
                      Return Items
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