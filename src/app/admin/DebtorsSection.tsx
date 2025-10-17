import { Users, Mail, Phone, Send, FileText, Plus, Trash2, Edit2, ChevronDown, ChevronUp, X, Loader, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";

type Sale = {
  id: number;
  date: string;
  items: string;
  amount: number;
};

type Payment = {
  date: string;
  amount: number;
  method: string;
};

type Debtor = {
  id: number;
  name: string;
  email: string;
  phone: string;
  totalSales: number;
  paid: number;
  balance: number;
  sales: Sale[];
  payments: Payment[];
};

type FormData = {
  name: string;
  email: string;
  phone: string;
  totalSales: number;
};

export default function DebtorsSection() {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    totalSales: 0,
  });

  useEffect(() => {
    fetchDebtors();
  }, []);

  const fetchDebtors = async () => {
    try {
      setLoading(true);
      // Fetch all sales
      const response = await fetch("/api/sales");
      if (!response.ok) throw new Error("Failed to fetch sales");
      const sales = await response.json();

      // Filter and group sales by customer where payment is not PAID
      const debtorMap = new Map<number, Debtor>();

      sales.forEach((sale: any) => {
        // Only include unpaid or partially paid sales
        if ((sale.status === "UNPAID" || sale.status === "PARTIAL") && sale.customer) {
          const customerId = sale.customer.id;

          if (!debtorMap.has(customerId)) {
            debtorMap.set(customerId, {
              id: customerId,
              name: sale.customer.name || "Unknown",
              email: sale.customer.email || "",
              phone: sale.customer.phone || "",
              totalSales: 0,
              paid: 0,
              balance: 0,
              sales: [],
              payments: [],
            });
          }

          const debtor = debtorMap.get(customerId)!;
          debtor.totalSales += sale.amount;
          debtor.paid += sale.totalPaid;
          debtor.balance = debtor.totalSales - debtor.paid;

          // Build items string from saleitems
          const itemsStr = sale.saleitems
            ?.map((item: any) => `${item.product?.name || "Item"} x${item.quantity}`)
            .join(", ") || "Items";

          debtor.sales.push({
            id: sale.id,
            date: sale.date,
            items: itemsStr,
            amount: sale.amount,
          });

          // Add payment history - filter only cleared payments
          if (sale.payments && Array.isArray(sale.payments)) {
            sale.payments.forEach((payment: any) => {
              if (payment.status === "CLEARED") {
                debtor.payments.push({
                  date: payment.paidAt || payment.createdAt,
                  amount: payment.amount,
                  method: payment.method || "Payment",
                });
              }
            });
          }
        }
      });

      setDebtors(Array.from(debtorMap.values()));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching debtors:", err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (debtor?: Debtor) => {
    if (debtor) {
      setEditingId(debtor.id);
      setFormData({
        name: debtor.name,
        email: debtor.email,
        phone: debtor.phone,
        totalSales: debtor.totalSales,
      });
    } else {
      setEditingId(null);
      setFormData({ name: "", email: "", phone: "", totalSales: 0 });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    alert("Debtors are managed through sales. Please create or edit a sale for this customer instead.");
    setShowModal(false);
  };

  const handleDelete = async (id: number) => {
    alert("To remove a debtor, delete all their associated sales from the Sales section.");
  };

  const handleViewReceipt = (debtor: Debtor, sale: Sale) => {
    // Open receipt in new tab/window
    const receiptUrl = `/api/receipt/${sale.id}`;
    window.open(receiptUrl, '_blank');
  };

  const generateReminderMessage = (debtor: Debtor): string => {
    const dueDateDays = 7; // Set your due date logic here
    const dueDate = new Date(Date.now() + dueDateDays * 24 * 60 * 60 * 1000);

    return `Hello ${debtor.name},

We hope this message finds you well. As a valued customer, we appreciate your continued business.

This is to inform you that your outstanding account balance with us is:

*KES ${Number(debtor.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}*

We kindly request that you settle this outstanding balance at your earliest convenience to maintain smooth business relations. The payment is expected by *${dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}*.

Should you have any questions regarding this invoice or require payment arrangements, please don't hesitate to contact us.

Thank you for your prompt attention to this matter.

Best regards,
Safe to Metals`;
  };

  const formatPhoneToKenyaCode = (phone: string): string => {
    if (!phone) return '';
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with 0 and length is 10 (local format), convert to 254
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      return '254' + cleaned.slice(1);
    }
    
    // If already starts with 254, return as is
    if (cleaned.startsWith('254')) {
      return cleaned;
    }
    
    // If starts with +254, remove the +
    if (phone.startsWith('+254')) {
      return cleaned;
    }
    
    // Otherwise assume it needs 254 prefix
    return '254' + cleaned;
  };

  const sendWhatsAppMessage = (phone: string, message: string) => {
    const formattedPhone = formatPhoneToKenyaCode(phone);
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const sendSMSMessage = (phone: string, message: string) => {
    const formattedPhone = formatPhoneToKenyaCode(phone);
    const encodedMessage = encodeURIComponent(message);
    const smsUrl = `sms:${formattedPhone}?body=${encodedMessage}`;
    window.location.href = smsUrl;
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
              <div className="bg-amber-600 p-2 md:p-3 rounded-lg">
                <Users className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              Accounts Receivable
            </h1>
            <p className="text-gray-600 text-xs md:text-sm lg:text-base mt-1 md:mt-2">Manage customers and debtors</p>
          </div>
          <button
            onClick={() => openModal()}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 md:px-6 py-2 md:py-3 rounded-lg font-medium transition flex items-center gap-2 shadow-lg hover:shadow-xl text-sm md:text-base w-full md:w-auto justify-center"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5" /> Add Debtor
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
            <Loader className="w-8 h-8 animate-spin text-amber-600" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            {debtors.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4 mb-6 md:mb-8">
                <div className="bg-white rounded-lg p-3 md:p-6 shadow-md border-l-4 border-amber-600">
                  <p className="text-gray-600 text-xs md:text-sm font-medium mb-1 md:mb-2">Total Customers</p>
                  <p className="text-2xl md:text-3xl font-bold text-gray-900">{debtors.length}</p>
                </div>
                <div className="bg-white rounded-lg p-3 md:p-6 shadow-md border-l-4 border-orange-500">
                  <p className="text-gray-600 text-xs md:text-sm font-medium mb-1 md:mb-2">Total Sales</p>
                  <p className="text-sm md:text-base font-bold text-orange-600 break-all">
                    KES {formatCurrency(debtors.reduce((sum, d) => sum + d.totalSales, 0))}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 md:p-6 shadow-md border-l-4 border-red-500">
                  <p className="text-gray-600 text-xs md:text-sm font-medium mb-1 md:mb-2">Outstanding</p>
                  <p className="text-sm md:text-base font-bold text-red-600 break-all">
                    KES {formatCurrency(debtors.reduce((sum, d) => sum + d.balance, 0))}
                  </p>
                </div>
              </div>
            )}

            {/* Debtors List */}
            <div className="space-y-4">
              {debtors.length === 0 ? (
                <div className="bg-white rounded-lg p-12 text-center shadow-md">
                  <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 text-lg">No debtors yet. Add one to get started.</p>
                </div>
              ) : (
                debtors.map((debtor) => (
                  <div key={debtor.id} className="bg-white rounded-lg shadow-md overflow-hidden transition hover:shadow-lg">
                  <div
                      onClick={() => setExpandedId(expandedId === debtor.id ? null : debtor.id)}
                      className="p-4 md:p-6 cursor-pointer hover:bg-gray-50 transition"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base md:text-xl font-bold text-gray-900 break-words">{debtor.name}</h3>
                            <div className="flex flex-col gap-1 mt-2 text-xs md:text-sm text-gray-600">
                              {debtor.email && <p className="break-all">📧 {debtor.email}</p>}
                              {debtor.phone && <p>📱 {debtor.phone}</p>}
                            </div>
                          </div>
                          <button className="flex-shrink-0 p-1 text-gray-400">
                            {expandedId === debtor.id ? (
                              <ChevronUp className="w-5 h-5 md:w-6 md:h-6 text-gray-600" />
                            ) : (
                              <ChevronDown className="w-5 h-5 md:w-6 md:h-6 text-gray-600" />
                            )}
                          </button>
                        </div>

                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-t border-gray-200 pt-3">
                          <div>
                            <p className="text-xs text-gray-600 uppercase tracking-wide font-medium">Outstanding Balance</p>
                            <p className="text-xl md:text-2xl font-bold text-red-600">KES {formatCurrency(debtor.balance)}</p>
                          </div>

                          <div className="flex gap-1 md:gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openModal(debtor);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(debtor.id);
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="px-4 md:px-6 pb-4 md:pb-6 flex flex-col gap-2 md:gap-4 border-t border-gray-200 pt-4 md:pt-6 md:flex-row">
                      <div className="flex-1 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 md:p-4">
                        <p className="text-xs md:text-sm text-gray-600 uppercase tracking-wide font-medium mb-1">Total Sales</p>
                        <p className="text-lg md:text-2xl font-bold text-blue-600 break-all">KES {formatCurrency(debtor.totalSales)}</p>
                      </div>
                      <div className="flex-1 bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 md:p-4">
                        <p className="text-xs md:text-sm text-gray-600 uppercase tracking-wide font-medium mb-1">Paid</p>
                        <p className="text-lg md:text-2xl font-bold text-green-600 break-all">KES {formatCurrency(debtor.paid)}</p>
                      </div>
                      <div className="flex-1 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 md:p-4">
                        <p className="text-xs md:text-sm text-gray-600 uppercase tracking-wide font-medium mb-1">Collection %</p>
                        <p className="text-lg md:text-2xl font-bold text-purple-600">
                          {debtor.totalSales > 0 ? Math.round((debtor.paid / debtor.totalSales) * 100) : 0}%
                        </p>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedId === debtor.id && (
                      <div className="px-4 md:px-6 pb-4 md:pb-6 space-y-4 md:space-y-6 border-t border-gray-200 pt-4 md:pt-6 bg-gray-50">
                        {/* Sales History */}
                        <div>
                          <h4 className="text-base md:text-lg font-bold text-gray-900 mb-3 md:mb-4">Sales History</h4>
                          {debtor.sales.length > 0 ? (
                            <div className="space-y-2 md:space-y-3">
                              {debtor.sales.map((sale) => (
                                <div key={sale.id} className="bg-white rounded-lg p-3 md:p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 text-sm md:text-base">Sale #{sale.id}</p>
                                    <p className="text-xs md:text-sm text-gray-600 mt-1 break-words">{sale.items}</p>
                                    <p className="text-xs md:text-sm text-gray-500 mt-1">{formatDate(sale.date)}</p>
                                  </div>
                                  <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                                    <p className="font-bold text-gray-900 text-sm md:text-base">KES {formatCurrency(sale.amount)}</p>
                                    <button
                                      onClick={() => handleViewReceipt(debtor, sale)}
                                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition flex-shrink-0"
                                      title="View Receipt"
                                    >
                                      <FileText className="w-4 h-4 md:w-5 md:h-5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-xs md:text-sm">No sales recorded</p>
                          )}
                        </div>

                        {/* Payment History */}
                        {debtor.payments.length > 0 && (
                          <div>
                            <h4 className="text-base md:text-lg font-bold text-gray-900 mb-3 md:mb-4">Payment History</h4>
                            <div className="space-y-2 md:space-y-3">
                              {debtor.payments.map((payment, idx) => (
                                <div key={idx} className="bg-white rounded-lg p-3 md:p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3">
                                  <div>
                                    <p className="font-semibold text-gray-900 text-sm md:text-base">{payment.method}</p>
                                    <p className="text-xs md:text-sm text-gray-500">{formatDate(payment.date)}</p>
                                  </div>
                                  <p className="font-bold text-green-600 text-sm md:text-base">KES {formatCurrency(payment.amount)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        {debtor.balance > 0 && (
                          <div className="flex flex-col gap-2 md:gap-3 pt-3 md:pt-4 border-t border-gray-200">
                            <button
                              onClick={() => sendWhatsAppMessage(debtor.phone, generateReminderMessage(debtor))}
                              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-2 md:py-3 px-3 md:px-4 rounded-lg transition-all flex items-center justify-center gap-2 text-sm md:text-base"
                            >
                              <MessageCircle className="w-4 h-4 md:w-5 md:h-5" />
                              Send WhatsApp Reminder
                            </button>
                            <button
                              onClick={() => sendSMSMessage(debtor.phone, generateReminderMessage(debtor))}
                              className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold py-2 md:py-3 px-3 md:px-4 rounded-lg transition-all flex items-center justify-center gap-2 text-sm md:text-base"
                            >
                              <Mail className="w-4 h-4 md:w-5 md:h-5" />
                              Send SMS Reminder
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Info Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Manage Debtors
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-gray-600 text-sm">
                Debtors are automatically managed through the <strong>Sales section</strong>. 
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>To add a debtor:</strong> Create a new sale for a customer with any payment status other than fully paid.
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>To remove a debtor:</strong> Delete all their associated sales or mark them as fully paid.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition font-medium"
              >
                Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}