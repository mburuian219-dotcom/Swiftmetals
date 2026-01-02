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
  Layers
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

// Main Component
const StaffManagementPage = () => {
  const router = useRouter();
  
  // States
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingKPIs, setLoadingKPIs] = useState(false);
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
  
  // KPI states
  const [kpis, setKpis] = useState<StaffKPIs>({
    totalStaff: 0,
    activeStaff: 0,
    inventoryValue: 0,
    totalSales: 0
  });

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
        // Continue with empty products data
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
      setError("Failed to calculate KPIs");
    } finally {
      setLoadingKPIs(false);
    }
  };

  // Fetch all data including KPIs
  const fetchAllData = async () => {
    await fetchStaff();
  };

  // Initial load
  useEffect(() => {
    fetchAllData();
  }, []);

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

  // Navigate to assign inventory page - UPDATED ROUTE
  const handleAssignInventory = () => {
    router.push("/admin/staff/inventory");
  };

  // Add new staff
  const handleAddStaff = async () => {
    // Validation
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

    // Basic email validation
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

      // Reset form and close modal
      setNewStaff({ name: "", email: "", phone: "" });
      setShowAddModal(false);
      setSuccess("Staff member added successfully!");

      // Refresh all data including KPIs
      setTimeout(() => {
        fetchAllData();
        setSuccess(null);
      }, 2000);

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

      // Refresh all data
      fetchAllData();
      setEditingStaff(null);
      setSuccess("Staff member updated successfully!");
      setTimeout(() => setSuccess(null), 3000);

    } catch (err: any) {
      console.error("Error updating staff:", err);
      setError(err.message || "Failed to update staff member");
      setTimeout(() => setError(null), 5000);
    } finally {
      setAddingStaff(false);
    }
  };

  // Delete staff with loading state
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

      // Refresh all data
      await fetchAllData();
      setShowDeleteConfirm(false);
      setSelectedStaff(null);
      setSuccess("Staff member deleted successfully!");
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

  // Render component
  return (
    <div className="min-h-screen bg-gray-50 pt-16 px-2 pb-4">
      {/* Fixed Header with Back Button - Positioned to avoid top nav */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm z-40 px-3 py-3">
        <div className="max-w-full mx-auto">
          <div className="flex items-center justify-between">
            <Link 
              href="/admin"
              className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Admin</span>
            </Link>
            
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-900 text-sm">Staff</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-full mt-2">
        {/* Title Section - Now below fixed header */}
        <div className="mb-3">
          <div className="bg-white rounded-lg p-3 shadow border border-gray-200">
            <h1 className="text-lg font-bold text-gray-900">Staff Management</h1>
            <p className="text-gray-600 text-xs">Manage staff members and their inventory</p>
          </div>
        </div>

        {/* Action Buttons Row - Two buttons side by side */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* Add New Staff Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-3 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all font-bold shadow-lg hover:shadow-xl"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">ADD STAFF</span>
          </button>

          {/* Assign Inventory Button - UPDATED: Goes to /admin/staff/inventory */}
          <button
            onClick={handleAssignInventory}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-bold shadow-lg hover:shadow-xl"
          >
            <Package className="w-4 h-4" />
            <span className="text-sm">ASSIGN INVENTORY</span>
          </button>
        </div>

        {/* KPI Summary Cards - Compact Grid for Mobile */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* Total Staff Card */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-500 font-medium">Total Staff</div>
                <div className="text-lg font-bold text-gray-900 mt-1">
                  {loadingKPIs ? (
                    <div className="animate-pulse h-6 w-10 bg-gray-200 rounded"></div>
                  ) : (
                    kpis.totalStaff
                  )}
                </div>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Active Staff Card */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-500 font-medium">Active</div>
                <div className="text-lg font-bold text-green-600 mt-1">
                  {loadingKPIs ? (
                    <div className="animate-pulse h-6 w-10 bg-gray-200 rounded"></div>
                  ) : (
                    kpis.activeStaff
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">
                  With inventory
                </div>
              </div>
              <div className="p-2 bg-green-50 rounded-lg flex-shrink-0">
                <User className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </div>

          {/* Inventory Value Card */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-500 font-medium">Inventory Value</div>
                <div className="text-sm font-bold text-purple-600 mt-1 truncate">
                  {loadingKPIs ? (
                    <div className="animate-pulse h-6 w-16 bg-gray-200 rounded"></div>
                  ) : (
                    formatCurrency(kpis.inventoryValue)
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">
                  At cost
                </div>
              </div>
              <div className="p-2 bg-purple-50 rounded-lg flex-shrink-0">
                <PackageCheck className="w-4 h-4 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Total Sales Card */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-500 font-medium">Total Sales</div>
                <div className="text-sm font-bold text-orange-600 mt-1 truncate">
                  {loadingKPIs ? (
                    <div className="animate-pulse h-6 w-16 bg-gray-200 rounded"></div>
                  ) : (
                    formatCurrency(kpis.totalSales)
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">
                  All staff
                </div>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg flex-shrink-0">
                <BarChart3 className="w-4 h-4 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Section - Compact */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-3 mb-3">
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all text-sm text-gray-900 placeholder-gray-500"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <button
                onClick={fetchAllData}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <div className="text-xs text-gray-700 font-medium px-2 py-1 rounded bg-gray-100">
                {filteredStaff.length} of {staffList.length}
              </div>
            </div>
          </div>
        </div>

        {/* Alerts - Compact */}
        {error && (
          <div className="mb-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg flex items-start gap-2 text-xs">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-medium">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
              <X size={14} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg flex items-start gap-2 text-xs">
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="font-medium">{success}</span>
          </div>
        )}

        {/* Staff List - Card Layout for Mobile */}
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">Staff Members</div>
              <div className="text-xs text-gray-600">
                {filteredStaff.length} staff
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              <div className="mt-2 text-gray-600 text-sm">Loading staff...</div>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="p-4 text-center">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <div className="text-sm font-medium text-gray-900 mb-1">No staff found</div>
              <div className="text-gray-600 text-xs mb-3">
                {searchTerm ? "Try different search terms" : "Add your first staff member"}
              </div>
              {!searchTerm && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1.5 rounded-lg hover:from-green-600 hover:to-emerald-700 text-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Staff
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredStaff.map((staff) => {
                const totalInventoryGiven = staff.staffInventories?.reduce(
                  (sum, inv) => sum + inv.quantityGiven, 0
                ) || 0;
                
                const isActive = totalInventoryGiven > 0;
                const totalSalesAmount = staff.sales?.reduce((sum, sale) => sum + sale.amount, 0) || 0;
                const salesCount = staff.sales?.length || 0;

                return (
                  <div key={staff.id} className="p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      {/* Staff Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">{staff.name}</div>
                            <div className="text-xs text-gray-500">
                              ID: {staff.id} • {formatDate(staff.createdAt)}
                            </div>
                          </div>
                        </div>
                        
                        {/* Contact Info */}
                        <div className="ml-10 space-y-1">
                          {staff.email && (
                            <div className="flex items-center text-xs text-gray-600">
                              <Mail className="w-3 h-3 mr-1.5 text-gray-400 flex-shrink-0" />
                              <span className="truncate">{staff.email}</span>
                            </div>
                          )}
                          {staff.phone && (
                            <div className="flex items-center text-xs text-gray-600">
                              <Phone className="w-3 h-3 mr-1.5 text-gray-400 flex-shrink-0" />
                              <span className="truncate">{staff.phone}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Stats */}
                        <div className="ml-10 mt-2">
                          <div className="flex flex-wrap gap-1.5 mb-1">
                            <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              isActive 
                                ? 'bg-green-100 text-green-800 border border-green-200' 
                                : 'bg-gray-100 text-gray-800 border border-gray-200'
                            }`}>
                              {totalInventoryGiven} items
                            </div>
                            <div className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium border border-blue-200">
                              {salesCount} sales
                            </div>
                          </div>
                          <div className="text-xs font-medium text-gray-900">
                            Sales: {formatCurrency(totalSalesAmount)}
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions - Stacked Vertically for Mobile */}
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleViewStaffDetails(staff)}
                          className="inline-flex items-center justify-center p-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-medium rounded hover:from-blue-700 hover:to-blue-800 transition-all"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        
                        <button
                          onClick={() => setEditingStaff(staff)}
                          className="inline-flex items-center justify-center p-1.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white text-xs font-medium rounded hover:from-purple-700 hover:to-purple-800 transition-all"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        
                        <button
                          onClick={() => {
                            setSelectedStaff(staff);
                            setShowDeleteConfirm(true);
                          }}
                          className="inline-flex items-center justify-center p-1.5 bg-gradient-to-r from-red-600 to-red-700 text-white text-xs font-medium rounded hover:from-red-700 hover:to-red-800 transition-all"
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
        <div className="mt-3 text-center text-gray-500 text-xs py-2">
          <div>Staff Dashboard • {new Date().getFullYear()}</div>
        </div>
      </div>

      {/* MODALS - Optimized for Mobile */}
      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-lg w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  <div>
                    <div className="text-base font-bold">Add Staff</div>
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
                  Full Name *
                </div>
                <input
                  type="text"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  placeholder="Full name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-200 transition-all text-sm text-gray-900"
                  disabled={addingStaff}
                />
              </div>

              <div>
                <div className="block text-xs font-semibold text-gray-900 mb-1">
                  Email Address *
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
                  Phone Number
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
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 text-sm"
                >
                  {addingStaff ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-lg w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit className="w-5 h-5" />
                  <div>
                    <div className="text-base font-bold">Edit Staff</div>
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
                  Full Name *
                </div>
                <input
                  type="text"
                  value={editingStaff.name}
                  onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all text-sm text-gray-900"
                  disabled={addingStaff}
                />
              </div>

              <div>
                <div className="block text-xs font-semibold text-gray-900 mb-1">
                  Email Address
                </div>
                <input
                  type="email"
                  value={editingStaff.email || ""}
                  onChange={(e) => setEditingStaff({ ...editingStaff, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all text-sm text-gray-900"
                  disabled={addingStaff}
                />
              </div>

              <div>
                <div className="block text-xs font-semibold text-gray-900 mb-1">
                  Phone Number
                </div>
                <input
                  type="tel"
                  value={editingStaff.phone || ""}
                  onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all text-sm text-gray-900"
                  disabled={addingStaff}
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handleUpdateStaff}
                  type="button"
                  disabled={addingStaff || !editingStaff.name.trim()}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 text-sm"
                >
                  {addingStaff ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 z-[60]">
          <div className="bg-white rounded-lg w-full max-w-sm">
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <div>
                    <div className="text-base font-bold">Delete Staff</div>
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
                <div className="text-sm font-semibold text-gray-900 mb-2">
                  Delete <span className="text-red-600">{selectedStaff.name}</span>?
                </div>
                <div className="text-gray-600 text-xs mb-3">
                  This will permanently remove the staff member and all associated records.
                </div>

                <div className="bg-red-50 border border-red-200 rounded p-2 mb-3">
                  <div className="text-xs text-red-700 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    ⚠️ Warning: Cannot be undone!
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleDeleteStaff}
                    disabled={deletingStaff}
                    className="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 text-sm"
                  >
                    {deletingStaff ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
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