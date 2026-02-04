"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  User,
  Mail,
  Phone,
  ArrowLeft,
  Edit,
  Trash2,
  Eye,
  Users,
  AlertCircle,
  CheckCircle,
  X,
  RefreshCw,
  PackageCheck,
  BarChart3,
  Package,
  Shield,
  Calendar,
  Key,
  Lock,
  MoreVertical,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  quantityGiven: number;
  quantitySold: number;
  quantityReturned: number;
  product: Product;
  productId: number;
}

interface Sale {
  id: number;
  amount: number;
  createdAt: Date;
  saleitem?: SaleItem[];
}

interface SaleItem {
  id: number;
  quantity: number;
  price: number;
  total: number;
  product: Product;
}

interface Product {
  id: number;
  name: string;
  price: number;
  productionCost?: number;
  category?: string;
  inStock: boolean;
  quantity?: number;
}

interface NewStaffForm {
  name: string;
  email: string;
  phone: string;
}

interface StaffKPIs {
  totalStaff: number;
  activeStaff: number;
  inventoryValue: number;
  totalSales: number;
}

interface SessionUser {
  uid?: string;
  email?: string;
  name?: string;
  role?: string;
  [key: string]: any;
}

// Admin configuration - ONLY YOUR EMAIL
const ADMIN_EMAILS = ["mburuian188@gmail.com"];

// Main Component
const StaffManagementPage = () => {
  const router = useRouter();
  
  // States
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingKPIs, setLoadingKPIs] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [newStaff, setNewStaff] = useState<NewStaffForm>({
    name: "",
    email: "",
    phone: ""
  });
  const [addingStaff, setAddingStaff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingStaff, setDeletingStaff] = useState(false);
  
  // User session state
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Hidden feature states
  const [secretClickCount, setSecretClickCount] = useState(0);
  const [showInventoryButton, setShowInventoryButton] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // KPI states
  const [kpis, setKpis] = useState<StaffKPIs>({
    totalStaff: 0,
    activeStaff: 0,
    inventoryValue: 0,
    totalSales: 0
  });

  // Get user session from your existing auth endpoint
  const fetchUserSession = useCallback(async () => {
    setLoadingSession(true);
    try {
      const response = await fetch("/api/auth/session");
      
      if (!response.ok) {
        const verifyResponse = await fetch("/api/auth/verify");
        if (verifyResponse.ok) {
          const userData = await verifyResponse.json();
          setSessionUser(userData);
          checkAdminStatus(userData);
        } else {
          setSessionUser({ email: "user@example.com" });
          setIsAdmin(false);
        }
      } else {
        const sessionData = await response.json();
        setSessionUser(sessionData.user || sessionData);
        checkAdminStatus(sessionData.user || sessionData);
      }
    } catch (err) {
      console.error("Error fetching session:", err);
      setSessionUser(null);
      setIsAdmin(false);
    } finally {
      setLoadingSession(false);
    }
  }, []);

  // Check if user is admin
  const checkAdminStatus = (user: SessionUser) => {
    const userEmail = user?.email?.toLowerCase()?.trim();
    const userIsAdmin = ADMIN_EMAILS.some(adminEmail => 
      adminEmail.toLowerCase() === userEmail
    );
    setIsAdmin(userIsAdmin);
    
    // Store in localStorage for quick access
    if (userEmail) {
      localStorage.setItem("currentUser", JSON.stringify({
        email: userEmail,
        name: user.name,
        isAdmin: userIsAdmin
      }));
    }
  };

  // Check stored user data
  const checkStoredUser = () => {
    const storedUser = localStorage.getItem("currentUser");
    
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setSessionUser(user);
        setIsAdmin(user.isAdmin);
        return true;
      } catch (err) {
        console.error("Error parsing stored user:", err);
        return false;
      }
    }
    return false;
  };

  // Fetch staff data
  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/staff");
      
      if (!response.ok) {
        throw new Error(`Failed to fetch staff: ${response.statusText}`);
      }
      
      const data = await response.json();
      setStaffList(data);
      setFilteredStaff(data);
      
      // Calculate KPIs after fetching staff
      await calculateKPIs(data);
    } catch (err: any) {
      console.error("Error fetching staff:", err);
      setError(err.message || "Failed to load staff data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate KPIs from staff data
  const calculateKPIs = async (staffData: Staff[]) => {
    setLoadingKPIs(true);
    try {
      // Fetch products with production cost for inventory value calculation
      let productsData: Product[] = [];
      try {
        const productsResponse = await fetch("/api/products");
        if (productsResponse.ok) {
          productsData = await productsResponse.json();
        }
      } catch (err) {
        console.error("Error fetching products:", err);
      }
      
      // Calculate total staff
      const totalStaff = staffData.length;
      
      // Calculate active staff (staff with inventory assigned)
      const activeStaff = staffData.filter(staff => {
        const totalInventoryGiven = staff.staffInventories?.reduce(
          (sum, inv) => sum + inv.quantityGiven, 0
        ) || 0;
        return totalInventoryGiven > 0;
      }).length;
      
      // Calculate inventory value (production cost × total quantity assigned to staff)
      let inventoryValue = 0;
      
      staffData.forEach(staff => {
        staff.staffInventories?.forEach(inventory => {
          const product = productsData.find((p: Product) => p.id === inventory.productId);
          if (product && product.productionCost) {
            inventoryValue += product.productionCost * inventory.quantityGiven;
          }
        });
      });
      
      // Calculate total sales (sum of all sales linked to staff accounts)
      let totalSales = 0;
      
      staffData.forEach(staff => {
        if (staff.sales) {
          totalSales += staff.sales.reduce((sum, sale) => sum + sale.amount, 0);
        }
      });
      
      setKpis({
        totalStaff,
        activeStaff,
        inventoryValue,
        totalSales
      });
    } catch (err) {
      console.error("Error calculating KPIs:", err);
    } finally {
      setLoadingKPIs(false);
    }
  };

  // Fetch all data
  const fetchAllData = async () => {
    await fetchStaff();
  };

  // Refresh data
  const handleRefresh = () => {
    fetchAllData();
    setSuccess("Data refreshed!");
    setTimeout(() => setSuccess(null), 2000);
  };

  // Secret click handler - Click the Users icon in header 3 times
  const handleSecretClick = () => {
    const newCount = secretClickCount + 1;
    setSecretClickCount(newCount);
    
    // Triple click (0 -> 1 -> 2 = 3 clicks) reveals the hidden button
    if (newCount >= 3) {
      setShowInventoryButton(true);
      setSecretClickCount(0);
      setSuccess("🎉 Secret unlocked! Inventory button active for 30s");
      
      // Hide button after 30 seconds
      setTimeout(() => {
        setShowInventoryButton(false);
        setSuccess(null);
      }, 30000);
    }
    
    // Reset counter after 2 seconds of inactivity
    setTimeout(() => {
      setSecretClickCount(0);
    }, 2000);
  };

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Press 'I' key three times quickly to show inventory button
      if (e.key === 'i' || e.key === 'I') {
        const newCount = secretClickCount + 1;
        setSecretClickCount(newCount);
        
        if (newCount >= 3) {
          setShowInventoryButton(true);
          setSecretClickCount(0);
          setSuccess("⌨️ Keyboard shortcut activated! Inventory button visible for 30s");
          
          setTimeout(() => {
            setShowInventoryButton(false);
            setSuccess(null);
          }, 30000);
        }
        
        setTimeout(() => {
          setSecretClickCount(0);
        }, 1000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [secretClickCount]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      const hasStoredUser = checkStoredUser();
      
      if (!hasStoredUser) {
        await fetchUserSession();
      } else {
        setLoadingSession(false);
      }
      
      await fetchAllData();
    };
    
    loadData();
  }, []);

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    router.push("/admin");
  };

  // Filter staff based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredStaff(staffList);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = staffList.filter(staff =>
      staff.name.toLowerCase().includes(term) ||
      (staff.email && staff.email.toLowerCase().includes(term)) ||
      (staff.phone && staff.phone.includes(term))
    );
    setFilteredStaff(filtered);
  }, [searchTerm, staffList]);

  // Navigate to staff details page
  const handleViewStaffDetails = (staff: Staff) => {
    router.push(`/admin/staff/${staff.id}`);
  };

  // Navigate to assign inventory page
  const handleAssignInventory = () => {
    router.push("/admin/staff/inventory");
  };

  // Add new staff
  const handleAddStaff = async () => {
    if (!newStaff.name.trim()) {
      setError("Staff name is required");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!newStaff.email.trim()) {
      setError("Email is required");
      setTimeout(() => setError(null), 3000);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newStaff.email)) {
      setError("Please enter a valid email address");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setAddingStaff(true);
    setError(null);

    try {
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newStaff)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add staff member");
      }

      setNewStaff({ name: "", email: "", phone: "" });
      setShowAddModal(false);
      setSuccess("Staff member added!");

      setTimeout(() => {
        fetchAllData();
        setSuccess(null);
      }, 1500);

    } catch (err: any) {
      console.error("Error adding staff:", err);
      setError(err.message || "Failed to add staff member");
      setTimeout(() => setError(null), 5000);
    } finally {
      setAddingStaff(false);
    }
  };

  // Update staff
  const handleUpdateStaff = async () => {
    if (!editingStaff) return;

    if (!editingStaff.name.trim()) {
      setError("Staff name is required");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setAddingStaff(true);
    setError(null);

    try {
      const response = await fetch(`/api/staff/${editingStaff.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editingStaff.name,
          email: editingStaff.email,
          phone: editingStaff.phone
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update staff member");
      }

      fetchAllData();
      setEditingStaff(null);
      setSuccess("Staff member updated!");
      setTimeout(() => setSuccess(null), 3000);

    } catch (err: any) {
      console.error("Error updating staff:", err);
      setError(err.message || "Failed to update staff member");
      setTimeout(() => setError(null), 5000);
    } finally {
      setAddingStaff(false);
    }
  };

  // Delete staff
  const handleDeleteStaff = async () => {
    if (!selectedStaff) return;

    setDeletingStaff(true);
    setError(null);

    try {
      const response = await fetch(`/api/staff/${selectedStaff.id}`, {
        method: "DELETE"
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete staff member");
      }

      await fetchAllData();
      setShowDeleteConfirm(false);
      setSelectedStaff(null);
      setSuccess("Staff member deleted!");
      setTimeout(() => setSuccess(null), 3000);

    } catch (err: any) {
      console.error("Error deleting staff:", err);
      setError(err.message || "Failed to delete staff member");
      setTimeout(() => setError(null), 5000);
    } finally {
      setDeletingStaff(false);
    }
  };

  // Format currency for display
  const formatCurrency = (amount: number) => {
    return `KSh ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Show loading state while checking session
  if (loadingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-3 border-blue-200 border-t-blue-600 mb-4"></div>
            <Users className="w-6 h-6 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">Loading Staff</h2>
          <p className="text-gray-600 text-xs">Checking your session...</p>
        </div>
      </div>
    );
  }

  // Main component render
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-16 px-2 pb-4">
      {/* Fixed Header - Slimmed down for mobile */}
      <div className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm z-50 px-3 py-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            {/* Left side - Back button and Title */}
            <div className="flex items-center gap-2">
              <Link 
                href="/admin"
                className="inline-flex items-center gap-1 px-2 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all text-xs font-medium"
              >
                <ArrowLeft className="w-3 h-3" />
                <span className="hidden xs:inline">Back</span>
              </Link>
              
              <div className="flex items-center gap-2">
                {/* SECRET BUTTON LOCATION: Click the Users icon 3 times */}
                <div 
                  onClick={handleSecretClick}
                  className="p-1.5 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg cursor-pointer hover:from-blue-200 hover:to-blue-300 transition-all relative group"
                  title="Secret: Click 3 times"
                >
                  <Users className="w-4 h-4 text-blue-700" />
                  {/* Hidden click counter */}
                  {secretClickCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                      {secretClickCount}
                    </div>
                  )}
                </div>
                <div className="flex flex-col">
                  <h1 className="text-sm font-bold text-gray-900 leading-tight">Staff Management</h1>
                  <p className="text-gray-600 text-[10px] hidden xs:block">Manage staff & inventory</p>
                </div>
              </div>
            </div>
            
            {/* Right side - User info and mobile menu */}
            <div className="flex items-center gap-2">
              {/* Admin Badge - Shows if you're logged in as admin */}
              {isAdmin && (
                <div className="hidden xs:flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full text-[10px] font-bold">
                  <Shield className="w-3 h-3" />
                  <span>ADMIN</span>
                </div>
              )}
              
              {/* Mobile menu button */}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors md:hidden"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              
              {/* User Info - Desktop */}
              {sessionUser && (
                <div className="hidden md:flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-[10px] text-gray-500">Logged in as</div>
                    <div className="text-xs font-semibold text-gray-900 max-w-[120px] truncate">
                      {sessionUser.email || "User"}
                    </div>
                  </div>
                  
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {(sessionUser.email?.charAt(0) || sessionUser.name?.charAt(0) || "U").toUpperCase()}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Mobile User Info - Expanded on menu click */}
          {showMobileMenu && sessionUser && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {(sessionUser.email?.charAt(0) || sessionUser.name?.charAt(0) || "U").toUpperCase()}
                  </div>
                  <div className="text-xs">
                    <div className="text-gray-900 font-medium truncate max-w-[140px]">
                      {sessionUser.email || sessionUser.name || "User"}
                    </div>
                    <div className="text-[10px] text-gray-600">
                      {isAdmin ? "Administrator" : "Staff"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Hidden Features Notification */}
        {showInventoryButton && !isAdmin && (
          <div className="mb-3 bg-gradient-to-r from-purple-100 to-indigo-100 border border-purple-300 rounded-xl p-3 animate-pulse">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-700 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-xs font-bold text-purple-900">Secret Unlocked!</div>
                <div className="text-[10px] text-purple-800">
                  Inventory button active for 30s • Press 'I' key 3x to reveal again
                </div>
              </div>
              <button 
                onClick={() => setShowInventoryButton(false)}
                className="text-purple-700 hover:text-purple-900 p-0.5"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Admin Status Banner - Compact */}
        {!loadingSession && (
          <div className={`mb-4 rounded-xl border ${isAdmin ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200' : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'} p-3 shadow-xs`}>
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${isAdmin ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold truncate">
                    {isAdmin ? "Administrator Access" : "Staff Access"}
                  </span>
                  {isAdmin && (
                    <span className="px-1.5 py-0.5 bg-gradient-to-r from-red-600 to-red-700 text-white text-[10px] font-bold rounded-full">
                      FULL
                    </span>
                  )}
                </div>
                <p className={`text-[10px] mt-0.5 ${isAdmin ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {isAdmin 
                    ? "Full access to staff & inventory"
                    : "View only - cannot assign inventory"}
                </p>
              </div>
              
              {/* Hidden Feature Hint */}
              {!isAdmin && (
                <div 
                  className="text-gray-500 hover:text-gray-700 transition-colors cursor-help relative group"
                  title="Psst... click the blue icon in header 3 times"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block">
                    <div className="bg-gray-900 text-white text-[10px] rounded py-1 px-1.5 whitespace-nowrap">
                      Tip: Click header icon 3x
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons - Compact Grid */}
        <div className={`grid ${showInventoryButton || isAdmin ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mb-4`}>
          {/* Add New Staff Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="group relative bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-2.5 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">ADD STAFF</span>
            <span className="xs:hidden">ADD</span>
          </button>

          {/* HIDDEN INVENTORY BUTTON */}
          {(showInventoryButton || isAdmin) && (
            <button
              onClick={handleAssignInventory}
              className={`group relative ${
                showInventoryButton 
                  ? 'bg-gradient-to-r from-purple-600 to-purple-700 animate-pulse' 
                  : 'bg-gradient-to-r from-blue-600 to-blue-700'
              } text-white px-3 py-2.5 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 text-xs`}
            >
              <Package className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">INVENTORY</span>
              <span className="xs:hidden">STOCK</span>
              
              {/* Secret indicator */}
              {showInventoryButton && !isAdmin && (
                <div className="absolute -top-1 -right-1">
                  <Key className="w-3 h-3 text-yellow-400" />
                </div>
              )}
              
              {/* Admin badge */}
              {isAdmin && (
                <div className="absolute -top-1 -right-1">
                  <Shield className="w-3 h-3 text-yellow-400" />
                </div>
              )}
            </button>
          )}

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="bg-white border border-gray-300 text-gray-700 px-3 py-2.5 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all font-medium shadow-sm hover:shadow flex items-center justify-center gap-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline">REFRESH</span>
            <span className="xs:hidden">SYNC</span>
          </button>
        </div>

        {/* KPI Cards - Compact 2x2 grid for mobile */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {/* Total Staff Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 hover:shadow transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-gray-500 font-medium mb-0.5">Total Staff</div>
                <div className="text-lg font-bold text-gray-900">
                  {loadingKPIs ? (
                    <div className="animate-pulse h-5 w-10 bg-gray-200 rounded"></div>
                  ) : (
                    kpis.totalStaff
                  )}
                </div>
              </div>
              <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg">
                <Users className="w-4 h-4 text-blue-700" />
              </div>
            </div>
          </div>

          {/* Active Staff Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 hover:shadow transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-gray-500 font-medium mb-0.5">Active</div>
                <div className="text-lg font-bold text-green-600">
                  {loadingKPIs ? (
                    <div className="animate-pulse h-5 w-10 bg-gray-200 rounded"></div>
                  ) : (
                    kpis.activeStaff
                  )}
                </div>
              </div>
              <div className="p-2 bg-gradient-to-br from-green-100 to-green-200 rounded-lg">
                <User className="w-4 h-4 text-green-700" />
              </div>
            </div>
          </div>

          {/* Inventory Value Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 hover:shadow transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-gray-500 font-medium mb-0.5">Stock Value</div>
                <div className="text-sm font-bold text-purple-600">
                  {loadingKPIs ? (
                    <div className="animate-pulse h-4 w-14 bg-gray-200 rounded"></div>
                  ) : (
                    formatCurrency(kpis.inventoryValue).split(' ')[1]
                  )}
                </div>
                <div className="text-[8px] text-gray-500 mt-0.5">At cost</div>
              </div>
              <div className="p-2 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg">
                <PackageCheck className="w-4 h-4 text-purple-700" />
              </div>
            </div>
          </div>

          {/* Total Sales Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 hover:shadow transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-gray-500 font-medium mb-0.5">Total Sales</div>
                <div className="text-sm font-bold text-orange-600">
                  {loadingKPIs ? (
                    <div className="animate-pulse h-4 w-14 bg-gray-200 rounded"></div>
                  ) : (
                    formatCurrency(kpis.totalSales).split(' ')[1]
                  )}
                </div>
                <div className="text-[8px] text-gray-500 mt-0.5">All staff</div>
              </div>
              <div className="p-2 bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg">
                <BarChart3 className="w-4 h-4 text-orange-700" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Section - Compact */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search staff..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all text-sm text-gray-900 placeholder-gray-500"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                {filteredStaff.length}/{staffList.length}
              </div>
            </div>
          </div>
        </div>

        {/* Alerts - Compact */}
        {error && (
          <div className="mb-3 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 text-red-800 px-3 py-2 rounded-xl flex items-start gap-2 text-xs">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-red-900">Error</div>
              <div className="mt-0.5">{error}</div>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-red-800 hover:text-red-900 p-0.5 hover:bg-red-200 rounded transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-3 bg-gradient-to-r from-emerald-50 to-green-100 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-xl flex items-start gap-2 text-xs">
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-emerald-900">Success</div>
              <div className="mt-0.5">{success}</div>
            </div>
            <button 
              onClick={() => setSuccess(null)}
              className="text-emerald-800 hover:text-emerald-900 p-0.5 hover:bg-emerald-200 rounded transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Staff List - Card Layout */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-gray-900">Staff Members</h2>
              </div>
              <div className="text-xs text-gray-700 font-medium">
                {filteredStaff.length} {filteredStaff.length === 1 ? 'staff' : 'staff'}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-blue-200 border-t-blue-600"></div>
              <div className="mt-3 text-gray-700 text-sm font-medium">Loading staff...</div>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-gray-400" />
              </div>
              <div className="text-sm font-bold text-gray-900 mb-1">
                {searchTerm ? "No matching staff" : "No staff yet"}
              </div>
              <div className="text-gray-600 text-xs mb-4 max-w-xs mx-auto">
                {searchTerm 
                  ? "Try different search terms"
                  : "Add your first staff member to begin"}
              </div>
              {!searchTerm && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-emerald-700 font-bold text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add First Staff
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredStaff.map((staff) => {
                const totalInventoryGiven = staff.staffInventories?.reduce(
                  (sum, inv) => sum + inv.quantityGiven, 0
                ) || 0;
                
                const isActive = totalInventoryGiven > 0;
                const totalSalesAmount = staff.sales?.reduce((sum, sale) => sum + sale.amount, 0) || 0;
                const salesCount = staff.sales?.length || 0;

                return (
                  <div key={staff.id} className="p-3 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-start gap-3">
                      {/* Staff Avatar */}
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                          {staff.name.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      
                      {/* Staff Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <h3 className="text-sm font-bold text-gray-900 truncate">{staff.name}</h3>
                          <div className="flex items-center gap-1">
                            <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                            }`}>
                              {isActive ? 'ACTIVE' : 'INACTIVE'}
                            </div>
                            <div className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold">
                              ID: {staff.id}
                            </div>
                          </div>
                        </div>
                        
                        {/* Contact Info */}
                        <div className="space-y-1 mb-2">
                          {staff.email && (
                            <div className="flex items-center text-xs text-gray-700">
                              <Mail className="w-3 h-3 mr-1.5 text-gray-500 flex-shrink-0" />
                              <span className="truncate">{staff.email}</span>
                            </div>
                          )}
                          {staff.phone && (
                            <div className="flex items-center text-xs text-gray-700">
                              <Phone className="w-3 h-3 mr-1.5 text-gray-500 flex-shrink-0" />
                              <span className="truncate">{staff.phone}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Stats Row - Horizontal for mobile */}
                        <div className="flex items-center gap-2">
                          <div className="px-2 py-1 bg-gradient-to-r from-purple-50 to-purple-100 rounded border border-purple-200">
                            <div className="text-[10px] text-purple-700 font-medium">Inventory</div>
                            <div className="text-sm font-bold text-purple-900">{totalInventoryGiven}</div>
                          </div>
                          <div className="px-2 py-1 bg-gradient-to-r from-blue-50 to-blue-100 rounded border border-blue-200">
                            <div className="text-[10px] text-blue-700 font-medium">Sales</div>
                            <div className="text-sm font-bold text-blue-900">{salesCount}</div>
                          </div>
                          <div className="px-2 py-1 bg-gradient-to-r from-orange-50 to-orange-100 rounded border border-orange-200">
                            <div className="text-[10px] text-orange-700 font-medium">Revenue</div>
                            <div className="text-xs font-bold text-orange-900">
                              {formatCurrency(totalSalesAmount).split(' ')[1]}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions - Vertical for mobile */}
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleViewStaffDetails(staff)}
                          className="p-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        
                        <button
                          onClick={() => setEditingStaff(staff)}
                          className="p-1.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        
                        <button
                          onClick={() => {
                            setSelectedStaff(staff);
                            setShowDeleteConfirm(true);
                          }}
                          className="p-1.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 text-center text-gray-500 text-xs py-2">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-1">
            <div>Staff Management • {new Date().getFullYear()}</div>
            <div className="hidden sm:block">•</div>
            <div className="text-[10px]">Access: <span className="font-semibold text-gray-900">{isAdmin ? "Admin" : "Staff"}</span></div>
          </div>
        </div>
      </div>

      {/* MODALS - Optimized for mobile */}
      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-xl w-full max-w-sm max-h-[85vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white/20 rounded-lg">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">Add New Staff</div>
                    <div className="text-green-100 text-xs">Enter details</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewStaff({ name: "", email: "", phone: "" });
                  }}
                  className="text-white hover:bg-white/20 p-1 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <div className="block text-xs font-semibold text-gray-900 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </div>
                <input
                  type="text"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-200 transition-all text-sm text-gray-900"
                  disabled={addingStaff}
                />
              </div>

              <div>
                <div className="block text-xs font-semibold text-gray-900 mb-1">
                  Email <span className="text-red-500">*</span>
                </div>
                <input
                  type="email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  placeholder="staff@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-200 transition-all text-sm text-gray-900"
                  disabled={addingStaff}
                />
              </div>

              <div>
                <div className="block text-xs font-semibold text-gray-900 mb-1">
                  Phone
                </div>
                <input
                  type="tel"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  placeholder="+254 7XX XXX XXX"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-200 transition-all text-sm text-gray-900"
                  disabled={addingStaff}
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handleAddStaff}
                  type="button"
                  disabled={addingStaff || !newStaff.name.trim() || !newStaff.email.trim()}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-sm"
                >
                  {addingStaff ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                      Adding...
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4" />
                      Add Staff
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewStaff({ name: "", email: "", phone: "" });
                  }}
                  type="button"
                  disabled={addingStaff}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-xl w-full max-w-sm max-h-[85vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white/20 rounded-lg">
                    <Edit className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">Edit Staff</div>
                    <div className="text-purple-100 text-xs">Update details</div>
                  </div>
                </div>
                <button
                  onClick={() => setEditingStaff(null)}
                  className="text-white hover:bg-white/20 p-1 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <div className="block text-xs font-semibold text-gray-900 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </div>
                <input
                  type="text"
                  value={editingStaff.name}
                  onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all text-sm"
                  disabled={addingStaff}
                />
              </div>

              <div>
                <div className="block text-xs font-semibold text-gray-900 mb-1">
                  Email
                </div>
                <input
                  type="email"
                  value={editingStaff.email || ""}
                  onChange={(e) => setEditingStaff({ ...editingStaff, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all text-sm"
                  disabled={addingStaff}
                />
              </div>

              <div>
                <div className="block text-xs font-semibold text-gray-900 mb-1">
                  Phone
                </div>
                <input
                  type="tel"
                  value={editingStaff.phone || ""}
                  onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all text-sm"
                  disabled={addingStaff}
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handleUpdateStaff}
                  type="button"
                  disabled={addingStaff || !editingStaff.name.trim()}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-sm"
                >
                  {addingStaff ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Update Staff
                    </>
                  )}
                </button>
                <button
                  onClick={() => setEditingStaff(null)}
                  type="button"
                  disabled={addingStaff}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedStaff && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 z-[60]">
          <div className="bg-white rounded-xl w-full max-w-sm">
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white/20 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">Delete Staff</div>
                    <div className="text-red-100 text-xs">Cannot be undone</div>
                  </div>
                </div>
                <button
                  onClick={() => !deletingStaff && setShowDeleteConfirm(false)}
                  className="text-white hover:bg-white/20 p-1 rounded transition-colors disabled:opacity-50"
                  disabled={deletingStaff}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div className="text-sm font-bold text-gray-900 mb-2">
                  Delete <span className="text-red-600">{selectedStaff.name}</span>?
                </div>
                <div className="text-gray-600 text-xs mb-4">
                  This will permanently remove the staff member and all associated records.
                </div>

                <div className="bg-red-50 border border-red-200 rounded p-2 mb-4">
                  <div className="text-xs text-red-700 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    ⚠️ Warning: Cannot be undone!
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleDeleteStaff}
                    disabled={deletingStaff}
                    className="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-sm"
                  >
                    {deletingStaff ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete Staff
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deletingStaff}
                    className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagementPage;