import { CreditCard, Plus, Trash2, Edit2, ChevronDown, ChevronUp, X, Loader, Package } from "lucide-react";
import { useState, useEffect } from "react";

type Restock = {
  id: number;
  createdAt: string;
  amount: number;
  product: {
    name: string;
  };
};

type Creditor = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  totalOwed: number;
  restocks: Restock[];
};

type FormData = {
  name: string;
  phone: string;
  email: string;
  totalOwed: number;
};

export default function CreditorsSection() {
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    email: "",
    totalOwed: 0,
  });

  useEffect(() => {
    fetchCreditors();
  }, []);

  const fetchCreditors = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch("/api/creditors", { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error("Failed to fetch creditors");
      const data = await response.json();
      setCreditors(data);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError("Request timed out. Please try again.");
      } else {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
      console.error("Error fetching creditors:", err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (creditor?: Creditor) => {
    if (creditor) {
      setEditingId(creditor.id);
      setFormData({
        name: creditor.name,
        phone: creditor.phone || "",
        email: creditor.email || "",
        totalOwed: creditor.totalOwed,
      });
    } else {
      setEditingId(null);
      setFormData({ name: "", phone: "", email: "", totalOwed: 0 });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert("Creditor name is required");
      return;
    }

    try {
      setSubmitting(true);
      let response;

      if (editingId !== null) {
        response = await fetch("/api/creditors", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...formData }),
        });
      } else {
        response = await fetch("/api/creditors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save creditor");
      }

      await fetchCreditors();
      setShowModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this creditor?")) return;

    try {
      const response = await fetch("/api/creditors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete creditor");
      }

      await fetchCreditors();
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const calculatePaid = (creditor: Creditor) => {
    return creditor.restocks.reduce((sum, restock) => sum + restock.amount, 0);
  };

  const formatCurrency = (amount: number) =>
    Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col items-start justify-between mb-6 gap-4 md:flex-row md:items-center md:mb-8">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 flex items-center gap-2 md:gap-3">
              <div className="bg-blue-600 p-2 md:p-3 rounded-lg">
                <CreditCard className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              Accounts Payable
            </h1>
            <p className="text-gray-600 text-xs md:text-sm lg:text-base mt-1 md:mt-2">Manage suppliers and creditors</p>
          </div>
          <button
            onClick={() => openModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-6 py-2 md:py-3 rounded-lg font-medium transition flex items-center gap-2 shadow-lg hover:shadow-xl text-sm md:text-base w-full md:w-auto justify-center"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5" /> Add Creditor
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            {creditors.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4 mb-6 md:mb-8">
                <div className="bg-white rounded-lg p-3 md:p-6 shadow-md border-l-4 border-blue-600">
                  <p className="text-gray-600 text-xs md:text-sm font-medium mb-1 md:mb-2">Total Creditors</p>
                  <p className="text-2xl md:text-3xl font-bold text-gray-900">{creditors.length}</p>
                </div>
                <div className="bg-white rounded-lg p-3 md:p-6 shadow-md border-l-4 border-red-500">
                  <p className="text-gray-600 text-xs md:text-sm font-medium mb-1 md:mb-2">Outstanding</p>
                  <p className="text-sm md:text-base font-bold text-red-600 break-all">
                    KES {formatCurrency(creditors.reduce((sum, c) => sum + (c.totalOwed - calculatePaid(c)), 0))}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 md:p-6 shadow-md border-l-4 border-green-500">
                  <p className="text-gray-600 text-xs md:text-sm font-medium mb-1 md:mb-2">Total Paid</p>
                  <p className="text-sm md:text-base font-bold text-green-600 break-all">
                    KES {formatCurrency(creditors.reduce((sum, c) => sum + calculatePaid(c), 0))}
                  </p>
                </div>
              </div>
            )}

            {/* Creditors List */}
            <div className="space-y-2">
              {creditors.length === 0 ? (
                <div className="bg-white rounded-lg p-8 md:p-12 text-center shadow-sm">
                  <CreditCard className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 text-gray-300" />
                  <p className="text-gray-500 text-sm md:text-lg">No creditors yet. Add one to get started.</p>
                </div>
              ) : (
                creditors.map((creditor) => {
                  const paid = calculatePaid(creditor);
                  const balance = creditor.totalOwed - paid;
                  const paymentPercentage = creditor.totalOwed > 0 ? Math.round((paid / creditor.totalOwed) * 100) : 0;

                  return (
                    <div key={creditor.id} className="bg-white rounded-lg shadow-sm hover:shadow-md overflow-hidden transition-all border border-gray-100">
                      <div
                        onClick={() => setExpandedId(expandedId === creditor.id ? null : creditor.id)}
                        className="p-3 md:p-4 cursor-pointer hover:bg-gray-50 transition"
                      >
                        <div className="flex items-center justify-between gap-3">
                          {/* Left: Name & Contact */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm md:text-base font-bold text-gray-900 truncate">{creditor.name}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                              {creditor.phone && (
                                <span className="flex items-center gap-1">
                                  📱 {creditor.phone}
                                </span>
                              )}
                              {creditor.email && (
                                <span className="flex items-center gap-1 truncate">
                                  📧 <span className="truncate">{creditor.email}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Center: Stats Grid */}
                          <div className="hidden lg:grid grid-cols-3 gap-4 flex-shrink-0">
                            <div className="text-center">
                              <p className="text-xs text-gray-500 mb-1">Total Owed</p>
                              <p className="text-sm font-bold text-blue-600">KES {formatCurrency(creditor.totalOwed)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-500 mb-1">Paid</p>
                              <p className="text-sm font-bold text-green-600">KES {formatCurrency(paid)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-500 mb-1">Rate</p>
                              <p className="text-sm font-bold text-amber-600">{paymentPercentage}%</p>
                            </div>
                          </div>

                          {/* Right: Balance & Actions */}
                          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-xs text-gray-500 mb-1">Balance</p>
                              <p className="text-sm md:text-base font-bold text-red-600 whitespace-nowrap">
                                KES {formatCurrency(balance)}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openModal(creditor);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(creditor.id);
                                }}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <button className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition">
                                {expandedId === creditor.id ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Mobile Stats - Show only on small screens */}
                        <div className="grid grid-cols-3 gap-2 mt-3 lg:hidden">
                          <div className="bg-blue-50 rounded p-2">
                            <p className="text-xs text-gray-600 mb-1">Owed</p>
                            <p className="text-xs font-bold text-blue-600">KES {formatCurrency(creditor.totalOwed)}</p>
                          </div>
                          <div className="bg-green-50 rounded p-2">
                            <p className="text-xs text-gray-600 mb-1">Paid</p>
                            <p className="text-xs font-bold text-green-600">KES {formatCurrency(paid)}</p>
                          </div>
                          <div className="bg-amber-50 rounded p-2">
                            <p className="text-xs text-gray-600 mb-1">Rate</p>
                            <p className="text-xs font-bold text-amber-600">{paymentPercentage}%</p>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedId === creditor.id && (
                        <div className="px-3 md:px-4 pb-3 md:pb-4 space-y-3 border-t border-gray-200 bg-gray-50">
                          {/* Restock History */}
                          <div>
                            <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                              <Package className="w-4 h-4 text-blue-600" />
                              Restock History
                            </h4>
                            {creditor.restocks.length > 0 ? (
                              <div className="space-y-1.5">
                                {creditor.restocks.map((restock) => (
                                  <div key={restock.id} className="bg-white rounded p-2.5 flex items-center justify-between gap-2 hover:bg-gray-50 transition">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-semibold text-gray-900 text-xs truncate">{restock.product.name}</p>
                                        <span className="text-xs text-gray-400">•</span>
                                        <p className="text-xs text-gray-500">{formatDate(restock.createdAt)}</p>
                                      </div>
                                    </div>
                                    <p className="font-bold text-gray-900 text-xs whitespace-nowrap">KES {formatCurrency(restock.amount)}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-500 text-xs py-2">No restocks recorded</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingId ? "Edit Creditor" : "Add New Creditor"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition"
                disabled={submitting}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Creditor Name *</label>
                <input
                  type="text"
                  placeholder="Enter creditor name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  placeholder="creditor@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  placeholder="Enter phone number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Total Owed (KES)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={formData.totalOwed}
                  onChange={(e) => setFormData({ ...formData, totalOwed: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium disabled:opacity-50"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium disabled:opacity-50 flex items-center gap-2"
                disabled={submitting}
              >
                {submitting && <Loader className="w-4 h-4 animate-spin" />}
                {editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}