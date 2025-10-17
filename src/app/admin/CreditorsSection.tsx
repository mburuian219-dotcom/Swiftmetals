import { CreditCard, Plus, Trash2, Edit2, ChevronDown, ChevronUp, X, Loader } from "lucide-react";
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

  // Fetch creditors
  useEffect(() => {
    fetchCreditors();
  }, []);

  const fetchCreditors = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/creditors");
      if (!response.ok) throw new Error("Failed to fetch creditors");
      const data = await response.json();
      setCreditors(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 flex items-center gap-3">
              <div className="bg-blue-600 p-3 rounded-lg">
                <CreditCard className="w-8 h-8 text-white" />
              </div>
              Accounts Payable
            </h1>
            <p className="text-gray-600 text-sm sm:text-base mt-2">Manage suppliers and creditors</p>
          </div>
          <button
            onClick={() => openModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition flex items-center gap-2 shadow-lg hover:shadow-xl"
          >
            <Plus className="w-5 h-5" /> Add Creditor
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-blue-600">
                  <p className="text-gray-600 text-sm font-medium mb-2">Total Creditors</p>
                  <p className="text-3xl font-bold text-gray-900">{creditors.length}</p>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-red-500">
                  <p className="text-gray-600 text-sm font-medium mb-2">Total Outstanding</p>
                  <p className="text-3xl font-bold text-red-600">
                    KES {formatCurrency(creditors.reduce((sum, c) => sum + (c.totalOwed - calculatePaid(c)), 0))}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-green-500">
                  <p className="text-gray-600 text-sm font-medium mb-2">Total Paid</p>
                  <p className="text-3xl font-bold text-green-600">
                    KES {formatCurrency(creditors.reduce((sum, c) => sum + calculatePaid(c), 0))}
                  </p>
                </div>
              </div>
            )}

            {/* Creditors List */}
            <div className="space-y-4">
              {creditors.length === 0 ? (
                <div className="bg-white rounded-lg p-12 text-center shadow-md">
                  <CreditCard className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 text-lg">No creditors yet. Add one to get started.</p>
                </div>
              ) : (
                creditors.map((creditor) => {
                  const paid = calculatePaid(creditor);
                  const balance = creditor.totalOwed - paid;
                  const paymentPercentage = creditor.totalOwed > 0 ? Math.round((paid / creditor.totalOwed) * 100) : 0;

                  return (
                    <div key={creditor.id} className="bg-white rounded-lg shadow-md overflow-hidden transition hover:shadow-lg">
                      {/* Creditor Card Header */}
                      <div
                        onClick={() => setExpandedId(expandedId === creditor.id ? null : creditor.id)}
                        className="p-6 cursor-pointer hover:bg-gray-50 transition"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900">{creditor.name}</h3>
                            <div className="flex flex-col gap-1 mt-2 text-sm text-gray-600">
                              {creditor.email && <p>📧 {creditor.email}</p>}
                              {creditor.phone && <p>📱 {creditor.phone}</p>}
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 w-full sm:w-auto">
                            <div className="text-left">
                              <p className="text-xs text-gray-600 uppercase tracking-wide font-medium">Balance Owed</p>
                              <p className="text-2xl font-bold text-red-600">KES {formatCurrency(balance)}</p>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openModal(creditor);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="Edit"
                              >
                                <Edit2 className="w-5 h-5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(creditor.id);
                                }}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Delete"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                              <button className="p-2 text-gray-400">
                                {expandedId === creditor.id ? (
                                  <ChevronUp className="w-5 h-5 text-gray-600" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-gray-600" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Summary Stats */}
                      <div className="px-6 pb-6 flex flex-col sm:flex-row gap-4 border-t border-gray-200 pt-6">
                        <div className="flex-1 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                          <p className="text-xs text-gray-600 uppercase tracking-wide font-medium mb-1">Total Owed</p>
                          <p className="text-xl sm:text-2xl font-bold text-blue-600">KES {formatCurrency(creditor.totalOwed)}</p>
                        </div>
                        <div className="flex-1 bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                          <p className="text-xs text-gray-600 uppercase tracking-wide font-medium mb-1">Paid</p>
                          <p className="text-xl sm:text-2xl font-bold text-green-600">KES {formatCurrency(paid)}</p>
                        </div>
                        <div className="flex-1 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4">
                          <p className="text-xs text-gray-600 uppercase tracking-wide font-medium mb-1">Payment %</p>
                          <p className="text-xl sm:text-2xl font-bold text-amber-600">{paymentPercentage}%</p>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedId === creditor.id && (
                        <div className="px-6 pb-6 space-y-6 border-t border-gray-200 pt-6 bg-gray-50">
                          {/* Restock History */}
                          <div>
                            <h4 className="text-lg font-bold text-gray-900 mb-4">Restock History</h4>
                            {creditor.restocks.length > 0 ? (
                              <div className="space-y-3">
                                {creditor.restocks.map((restock) => (
                                  <div key={restock.id} className="bg-white rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div>
                                      <p className="font-semibold text-gray-900">{restock.product.name}</p>
                                      <p className="text-sm text-gray-500">{formatDate(restock.createdAt)}</p>
                                    </div>
                                    <p className="font-bold text-gray-900">KES {formatCurrency(restock.amount)}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-500 text-sm">No restocks recorded</p>
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